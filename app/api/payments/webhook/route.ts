import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyLemonWebhook } from "@/lib/payments/webhook-verify";
import { tierForVariantId } from "@/lib/payments/plans";

// LemonSqueezy webhook receiver. Verifies HMAC signature, then updates
// the user row based on the event type. Idempotent — same event firing
// twice produces the same final DB state.
//
// Bridge from webhook to user: we embedded `userId` in custom_data at
// checkout creation, which LemonSqueezy echoes back in `meta.custom_data`
// on every subscription event. If it's missing (malformed event, or an
// event from a subscription created outside our flow), we log + accept.

export const dynamic = "force-dynamic";

interface LemonEvent {
  meta: {
    event_name: string;
    custom_data?: { userId?: string; tier?: string };
  };
  data: {
    id: string;
    type: string;
    attributes: {
      customer_id?: number | string;
      variant_id?: number | string;
      status?: string;
      renews_at?: string | null;
      ends_at?: string | null;
      cancelled?: boolean;
      [key: string]: unknown;
    };
  };
}

export async function POST(req: NextRequest) {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  const rawBody = await req.text();
  const sig = req.headers.get("x-signature");
  if (!verifyLemonWebhook(rawBody, sig, secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: LemonEvent;
  try {
    event = JSON.parse(rawBody) as LemonEvent;
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }

  const eventName = event.meta.event_name;
  const userId = event.meta.custom_data?.userId;
  if (!userId) {
    console.warn(`[lemon-webhook] ${eventName}: missing custom_data.userId — ignoring`);
    return NextResponse.json({ received: true, warning: "missing_user_id" });
  }

  const sub = event.data;
  const attrs = sub.attributes;
  const subId = sub.id;
  const customerId = attrs.customer_id != null ? String(attrs.customer_id) : null;
  const variantId = attrs.variant_id != null ? String(attrs.variant_id) : null;
  const tier = tierForVariantId(variantId);
  const renewsAt = attrs.renews_at ? new Date(attrs.renews_at) : null;
  const endsAt = attrs.ends_at ? new Date(attrs.ends_at) : null;

  try {
    switch (eventName) {
      case "subscription_created":
      case "subscription_resumed":
      case "subscription_unpaused": {
        if (!tier) {
          console.warn(`[lemon-webhook] ${eventName}: unknown variant ${variantId}`);
          break;
        }
        await prisma.user.update({
          where: { id: userId },
          data: {
            planTier: tier,
            lsCustomerId: customerId,
            lsSubscriptionId: subId,
            lsVariantId: variantId,
            lsRenewsAt: renewsAt,
            lsEndsAt: null,
            planExpiresAt: null,
            pendingPlanTier: null,
            pendingPlanAt: null,
          },
        });
        break;
      }

      case "subscription_plan_changed": {
        if (!tier) break;
        await prisma.user.update({
          where: { id: userId },
          data: {
            planTier: tier,
            lsVariantId: variantId,
            lsRenewsAt: renewsAt,
            pendingPlanTier: null,
            pendingPlanAt: null,
          },
        });
        break;
      }

      case "subscription_updated": {
        // Catch-all sync. LemonSqueezy fires this for misc subscription
        // attribute changes (card update, etc.). Pull whatever's useful.
        const data: Record<string, unknown> = { lsRenewsAt: renewsAt };
        if (tier) {
          data.planTier = tier;
          data.lsVariantId = variantId;
        }
        if (attrs.cancelled) {
          data.lsEndsAt = endsAt;
          data.pendingPlanTier = "free";
          data.pendingPlanAt = endsAt;
        }
        await prisma.user.update({ where: { id: userId }, data });
        break;
      }

      case "subscription_cancelled": {
        // User pressed cancel — subscription stays active until period
        // end (lsEndsAt). pendingPlanTier=free for UI banner.
        await prisma.user.update({
          where: { id: userId },
          data: {
            lsEndsAt: endsAt,
            pendingPlanTier: "free",
            pendingPlanAt: endsAt,
          },
        });
        break;
      }

      case "subscription_expired":
      case "subscription_paused":
      case "subscription_payment_refunded":
      case "order_refunded": {
        // Subscription effectively ended or refunded — downgrade to free.
        await prisma.user.update({
          where: { id: userId },
          data: {
            planTier: "free",
            lsEndsAt: endsAt,
            lsVariantId: null,
            pendingPlanTier: null,
            pendingPlanAt: null,
            planExpiresAt: endsAt,
          },
        });
        break;
      }

      case "subscription_payment_success":
      case "subscription_payment_recovered": {
        // Renewal succeeded — bump renewsAt, clear any planExpiresAt.
        await prisma.user.update({
          where: { id: userId },
          data: { lsRenewsAt: renewsAt, planExpiresAt: null },
        });
        break;
      }

      case "subscription_payment_failed": {
        // Stay on tier (LemonSqueezy will retry); just log for visibility.
        console.warn(`[lemon-webhook] payment_failed user=${userId} sub=${subId}`);
        break;
      }

      default:
        console.log(`[lemon-webhook] unhandled event: ${eventName}`);
    }
  } catch (err) {
    console.error("[lemon-webhook] handler error:", err);
    return NextResponse.json({ error: "Handler error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
