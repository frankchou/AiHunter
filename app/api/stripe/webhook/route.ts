import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import type Stripe from "stripe";

export async function POST(req: NextRequest) {
  if (!stripe) return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });

  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !secret) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === "subscription" && session.subscription) {
          // Retrieve subscription to access its metadata (set via subscription_data.metadata)
          const sub = await stripe.subscriptions.retrieve(session.subscription as string);
          const userId = sub.metadata?.userId ?? session.metadata?.userId;
          const tier = ((sub.metadata?.tier as "pro" | "max") ?? "pro");
          if (userId) {
            await prisma.user.update({
              where: { id: userId },
              data: {
                planTier: tier,
                stripeSubscriptionId: sub.id,
                planExpiresAt: null,
              },
            });
          }
        }
        break;
      }
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.userId;
        if (!userId) break;
        // Resolve the *current* tier from the actual price item, not metadata —
        // metadata may be stale after a scheduled downgrade phase transitions.
        const proPriceId = process.env.STRIPE_PRO_PRICE_ID;
        const maxPriceId = process.env.STRIPE_MAX_PRICE_ID;
        const priceId    = sub.items.data[0]?.price?.id ?? null;
        const tierFromPrice: "pro" | "max" =
          priceId === maxPriceId ? "max" :
          priceId === proPriceId ? "pro" :
          ((sub.metadata?.tier as "pro" | "max") ?? "pro");
        const active = sub.status === "active" || sub.status === "trialing";
        const periodEnd = sub.items.data[0]?.current_period_end;

        // Clear pending fields once the actual subscription matches them
        // (Stripe scheduled transition fired, or user pressed "undo")
        const userBefore = await prisma.user.findUnique({
          where: { id: userId },
          select: { pendingPlanTier: true },
        });
        const clearPending = userBefore?.pendingPlanTier === tierFromPrice;

        await prisma.user.update({
          where: { id: userId },
          data: {
            planTier:        active ? tierFromPrice : "free",
            planExpiresAt:   active ? null : (periodEnd ? new Date(periodEnd * 1000) : null),
            ...(clearPending && {
              pendingPlanTier:  null,
              pendingPlanAt:    null,
              stripeScheduleId: null,
            }),
          },
        });
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.userId;
        if (!userId) break;
        await prisma.user.update({
          where: { id: userId },
          data: {
            planTier:             "free",
            stripeSubscriptionId: null,
            stripeScheduleId:     null,
            pendingPlanTier:      null,
            pendingPlanAt:        null,
            planExpiresAt:        null,
          },
        });
        break;
      }
      case "subscription_schedule.released":
      case "subscription_schedule.canceled": {
        const sched = event.data.object as Stripe.SubscriptionSchedule;
        const userId = sched.metadata?.userId;
        if (!userId) break;
        // Schedule released — clear our pointer so we don't try to release it again.
        await prisma.user.updateMany({
          where: { id: userId, stripeScheduleId: sched.id },
          data:  { stripeScheduleId: null },
        });
        break;
      }
    }
  } catch (err) {
    console.error("[stripe-webhook]", err);
    return NextResponse.json({ error: "Handler error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
