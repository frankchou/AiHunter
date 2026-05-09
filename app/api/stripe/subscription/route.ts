import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe, STRIPE_ENABLED } from "@/lib/stripe";

// Subscription summary used by the billing page: current tier, period end,
// pending plan change (downgrade / cancel), payment method last4.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      planTier:             true,
      pendingPlanTier:      true,
      pendingPlanAt:        true,
      stripeCustomerId:     true,
      stripeSubscriptionId: true,
      isSuperUser:          true,
    },
  });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let periodEnd: number | null = null;
  let cancelAtPeriodEnd = false;
  let cardBrand: string | null = null;
  let cardLast4: string | null = null;

  if (STRIPE_ENABLED && stripe && user.stripeSubscriptionId) {
    try {
      const sub = await stripe.subscriptions.retrieve(user.stripeSubscriptionId, {
        expand: ["default_payment_method"],
      });
      periodEnd = sub.items.data[0]?.current_period_end ?? null;
      cancelAtPeriodEnd = !!sub.cancel_at_period_end;
      const pm = sub.default_payment_method;
      if (pm && typeof pm !== "string" && pm.card) {
        cardBrand = pm.card.brand;
        cardLast4 = pm.card.last4;
      }
    } catch {
      /* ignore — sub may have been deleted */
    }
  }

  return NextResponse.json({
    planTier:        user.planTier,
    isSuperUser:     user.isSuperUser,
    pendingPlanTier: user.pendingPlanTier,
    pendingPlanAt:   user.pendingPlanAt?.toISOString() ?? null,
    periodEnd:       periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    cancelAtPeriodEnd,
    cardBrand,
    cardLast4,
    hasSubscription: !!user.stripeSubscriptionId,
  });
}
