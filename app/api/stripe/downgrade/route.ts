import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe, STRIPE_ENABLED } from "@/lib/stripe";
import { CANCEL_REASON_KEYS, type CancelReasonKey } from "@/lib/plans";

// Schedule a Max -> Pro downgrade at the current period end. The user keeps
// Max until the period closes; webhook then flips planTier to "pro".
//
// Implementation: Stripe Subscription Schedule with two phases:
//   phase 1 = Max price, ends at current period end
//   phase 2 = Pro price, iterations 1, then end_behavior 'release' lets it
//             continue indefinitely on the Pro item it last set.
//
// Body: { reasons?: string[], note?: string }   (optional feedback)
export async function POST(req: NextRequest) {
  if (!STRIPE_ENABLED || !stripe) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const proPriceId = process.env.STRIPE_PRO_PRICE_ID;
  const maxPriceId = process.env.STRIPE_MAX_PRICE_ID;
  if (!proPriceId || !maxPriceId) {
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
  if (user.planTier !== "max") {
    return NextResponse.json({ error: "Downgrade only available from Max" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const reasons: CancelReasonKey[] = Array.isArray(body.reasons)
    ? body.reasons.filter((r: unknown): r is CancelReasonKey =>
        typeof r === "string" && (CANCEL_REASON_KEYS as readonly string[]).includes(r))
    : [];
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 2000) : null;

  // Release any prior schedule for a clean slate
  if (user.stripeScheduleId) {
    try { await stripe.subscriptionSchedules.release(user.stripeScheduleId); } catch { /* may already be released */ }
  }

  const sub = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
  const periodEnd = sub.items.data[0]?.current_period_end;
  if (!periodEnd) {
    return NextResponse.json({ error: "Cannot read current period end" }, { status: 500 });
  }

  // Build schedule from existing subscription
  const schedule = await stripe.subscriptionSchedules.create({
    from_subscription: user.stripeSubscriptionId,
  });

  // Update with two phases. Inherit metadata so the webhook still knows the user.
  const phase1Start = (schedule.phases?.[0]?.start_date as number | undefined) ?? sub.items.data[0]?.current_period_start;
  await stripe.subscriptionSchedules.update(schedule.id, {
    end_behavior: "release",
    metadata: { userId: session.user.id, tier: "pro" },
    phases: [
      {
        items: [{ price: maxPriceId, quantity: 1 }],
        start_date: phase1Start,
        end_date:   periodEnd,
        metadata:   { userId: session.user.id, tier: "max" },
      },
      {
        items:    [{ price: proPriceId, quantity: 1 }],
        // duration={month,1} bounds the phase. Schedule then releases (per
        // end_behavior) and the subscription continues normally on Pro.
        duration: { interval: "month", interval_count: 1 },
        metadata: { userId: session.user.id, tier: "pro" },
      },
    ],
  });

  const effectiveAt = new Date(periodEnd * 1000);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: session.user.id },
      data: {
        pendingPlanTier:  "pro",
        pendingPlanAt:    effectiveAt,
        stripeScheduleId: schedule.id,
      },
    }),
    prisma.cancellationFeedback.create({
      data: {
        userId:      session.user.id,
        fromTier:    "max",
        toTier:      "pro",
        reasons,
        freeText:    note,
        effectiveAt,
      },
    }),
  ]);

  return NextResponse.json({
    ok: true,
    effectiveAt: effectiveAt.toISOString(),
    message: "已排程在當期結束時降級為 Pro",
  });
}

// Undo a pending downgrade — release the schedule, subscription continues on Max.
export async function DELETE() {
  if (!STRIPE_ENABLED || !stripe) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { stripeScheduleId: true, pendingPlanTier: true },
  });
  if (!user?.stripeScheduleId || user.pendingPlanTier !== "pro") {
    return NextResponse.json({ error: "No pending downgrade" }, { status: 400 });
  }

  try { await stripe.subscriptionSchedules.release(user.stripeScheduleId); } catch { /* already released */ }
  await prisma.user.update({
    where: { id: session.user.id },
    data: { pendingPlanTier: null, pendingPlanAt: null, stripeScheduleId: null },
  });
  return NextResponse.json({ ok: true });
}
