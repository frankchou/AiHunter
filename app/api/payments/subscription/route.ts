import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getSubscription } from "@lemonsqueezy/lemonsqueezy.js";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { initLemonSqueezy, LEMON_ENABLED } from "@/lib/payments/client";
import { tierForVariantId } from "@/lib/payments/plans";

// Returns the user's subscription snapshot for BillingView. Pulls fresh
// data from LemonSqueezy (card details, renewal date, status) so the UI
// is always in sync — we don't trust our DB mirror alone since the user
// could have cancelled via LemonSqueezy's customer portal between
// webhook firings.
//
// For super users (DB `isSuperUser=true`): pretends they're on Max so
// the rest of the UI doesn't need special-casing, and includes
// `isSuperUser: true` so BillingView can show the explanatory banner.
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      planTier: true,
      isSuperUser: true,
      pendingPlanTier: true,
      pendingPlanAt: true,
      lsSubscriptionId: true,
      lsRenewsAt: true,
      lsEndsAt: true,
    },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Super user remap — display as max regardless of actual planTier.
  const effectiveTier = user.isSuperUser ? "max" : user.planTier;

  const base = {
    planTier:          effectiveTier,
    isSuperUser:       user.isSuperUser,
    pendingPlanTier:   user.pendingPlanTier as "pro" | "free" | null,
    pendingPlanAt:     user.pendingPlanAt?.toISOString() ?? null,
    periodEnd:         user.lsRenewsAt?.toISOString() ?? null,
    cancelAtPeriodEnd: !!user.lsEndsAt,
    cardBrand:         null as string | null,
    cardLast4:         null as string | null,
    hasSubscription:   !!user.lsSubscriptionId,
  };

  // No subscription (super user, or never paid) → return base data only.
  if (!LEMON_ENABLED || !user.lsSubscriptionId) {
    return NextResponse.json(base);
  }

  // Pull live data from LemonSqueezy — card details + variant resolution.
  try {
    initLemonSqueezy();
    const result = await getSubscription(user.lsSubscriptionId);
    const attrs = result.data?.data.attributes as Record<string, unknown> | undefined;
    if (attrs) {
      const variantId = attrs.variant_id;
      const tier = tierForVariantId(variantId as string | number);
      return NextResponse.json({
        ...base,
        planTier:          user.isSuperUser ? "max" : (tier ?? effectiveTier),
        cardBrand:         (attrs.card_brand as string) ?? null,
        cardLast4:         (attrs.card_last_four as string) ?? null,
        periodEnd:         (attrs.renews_at as string) ?? base.periodEnd,
        cancelAtPeriodEnd: !!(attrs.cancelled || attrs.ends_at),
      });
    }
  } catch (err) {
    console.error("[payments/subscription] lemon fetch failed:", err);
  }
  return NextResponse.json(base);
}
