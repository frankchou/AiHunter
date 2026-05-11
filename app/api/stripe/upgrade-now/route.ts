import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe, STRIPE_ENABLED } from "@/lib/stripe";

// Immediate Pro → Max upgrade with Stripe proration.
//
// Spec: Pro user who hits a paywall (e.g. Top 20 monthly per-company quota)
// wants to unlock right now. We swap the subscription item to Max immediately
// and let Stripe bill the prorated difference for the remainder of the
// current period. Renewal next cycle is at the full Max price.
//
// proration_behavior: "always_invoice" creates an invoice for the proration
// AND attempts to charge it immediately via the customer's default payment
// method. We surface a clear error if the card declines so the UI can prompt
// the user to update payment.
export async function POST() {
  if (!STRIPE_ENABLED || !stripe) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const maxPriceId = process.env.STRIPE_MAX_PRICE_ID;
  if (!maxPriceId) {
    return NextResponse.json({ error: "Stripe price IDs not configured" }, { status: 500 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      planTier:             true,
      stripeSubscriptionId: true,
      stripeScheduleId:     true,
    },
  });
  if (!user?.stripeSubscriptionId) {
    return NextResponse.json({ error: "No active subscription" }, { status: 400 });
  }
  if (user.planTier !== "pro") {
    return NextResponse.json({
      error: "Only Pro plans can upgrade to Max via this endpoint",
      currentTier: user.planTier,
    }, { status: 400 });
  }

  // Release any pending downgrade schedule — upgrading invalidates it.
  if (user.stripeScheduleId) {
    try { await stripe.subscriptionSchedules.release(user.stripeScheduleId); } catch { /* may already be released */ }
  }

  const sub = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
  const item = sub.items.data[0];
  if (!item) {
    return NextResponse.json({ error: "Subscription has no items" }, { status: 500 });
  }

  try {
    await stripe.subscriptions.update(user.stripeSubscriptionId, {
      items: [{ id: item.id, price: maxPriceId, quantity: 1 }],
      proration_behavior: "always_invoice",
      metadata: { ...(sub.metadata ?? {}), userId: session.user.id, tier: "max" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({
      error: "STRIPE_UPDATE_FAILED",
      message: msg,
    }, { status: 502 });
  }

  // Flip tier immediately. Webhook will reconcile downstream side effects.
  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      planTier:         "max",
      pendingPlanTier:  null,
      pendingPlanAt:    null,
      stripeScheduleId: null,
    },
  });

  return NextResponse.json({
    ok: true,
    tier: "max",
    message: "已升級至 Max；本期差價已按比例計算並開立發票。",
  });
}
