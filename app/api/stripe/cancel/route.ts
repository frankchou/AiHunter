import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe, STRIPE_ENABLED } from "@/lib/stripe";
import { CANCEL_REASON_KEYS, type CancelReasonKey } from "@/lib/plans";

// Cancel the user's subscription at the end of the current paid period.
// They keep the paid tier until the period ends; webhook then sets planTier=free.
// Body: { reasons: string[], note?: string }
export async function POST(req: NextRequest) {
  if (!STRIPE_ENABLED || !stripe) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      stripeSubscriptionId: true,
      stripeScheduleId:     true,
      planTier:             true,
    },
  });
  if (!user?.stripeSubscriptionId) {
    return NextResponse.json({ error: "No active subscription" }, { status: 400 });
  }
  if (user.planTier === "free") {
    return NextResponse.json({ error: "Already on free plan" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const reasons: CancelReasonKey[] = Array.isArray(body.reasons)
    ? body.reasons.filter((r: unknown): r is CancelReasonKey =>
        typeof r === "string" && (CANCEL_REASON_KEYS as readonly string[]).includes(r))
    : [];
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 2000) : null;

  // If a downgrade schedule is pending, release it first so we can cancel cleanly.
  if (user.stripeScheduleId) {
    try { await stripe.subscriptionSchedules.release(user.stripeScheduleId); } catch { /* may already be released */ }
  }

  // Mark Stripe subscription to cancel at period end.
  const sub = await stripe.subscriptions.update(user.stripeSubscriptionId, {
    cancel_at_period_end: true,
  });
  const periodEnd = sub.items.data[0]?.current_period_end;
  const effectiveAt = periodEnd ? new Date(periodEnd * 1000) : null;

  // Persist user-side intent + feedback.
  await prisma.$transaction([
    prisma.user.update({
      where: { id: session.user.id },
      data: {
        pendingPlanTier:  "free",
        pendingPlanAt:    effectiveAt,
        stripeScheduleId: null,
      },
    }),
    prisma.cancellationFeedback.create({
      data: {
        userId:      session.user.id,
        fromTier:    user.planTier,
        toTier:      "free",
        reasons,
        freeText:    note,
        effectiveAt,
      },
    }),
  ]);

  return NextResponse.json({
    ok: true,
    effectiveAt: effectiveAt?.toISOString() ?? null,
    message: "已排程在當期結束時取消方案",
  });
}

// Undo a pending cancellation (resume normal billing).
export async function DELETE() {
  if (!STRIPE_ENABLED || !stripe) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { stripeSubscriptionId: true, pendingPlanTier: true },
  });
  if (!user?.stripeSubscriptionId) {
    return NextResponse.json({ error: "No subscription" }, { status: 400 });
  }
  if (user.pendingPlanTier !== "free") {
    return NextResponse.json({ error: "No pending cancellation" }, { status: 400 });
  }

  await stripe.subscriptions.update(user.stripeSubscriptionId, { cancel_at_period_end: false });
  await prisma.user.update({
    where: { id: session.user.id },
    data: { pendingPlanTier: null, pendingPlanAt: null },
  });
  return NextResponse.json({ ok: true });
}
