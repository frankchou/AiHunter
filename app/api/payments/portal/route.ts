import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getSubscription } from "@lemonsqueezy/lemonsqueezy.js";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { initLemonSqueezy, LEMON_ENABLED } from "@/lib/payments/client";

// Returns the user's LemonSqueezy customer portal URL — the hosted page
// where they can update payment method, view invoices, cancel, etc.
// LemonSqueezy generates a one-time signed URL per subscription, embedded
// inside the Subscription resource's `urls.customer_portal` attribute.
export const dynamic = "force-dynamic";

export async function GET() {
  if (!LEMON_ENABLED) {
    return NextResponse.json({ error: "Payments not configured" }, { status: 503 });
  }

  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { lsSubscriptionId: true },
  });
  if (!user?.lsSubscriptionId) {
    return NextResponse.json({ error: "No active subscription" }, { status: 404 });
  }

  initLemonSqueezy();
  const result = await getSubscription(user.lsSubscriptionId);
  const urls = result.data?.data.attributes.urls as { customer_portal?: string } | undefined;
  const portalUrl = urls?.customer_portal;
  if (!portalUrl) {
    console.error("[lemon-portal] no portal url for sub", user.lsSubscriptionId, result);
    return NextResponse.json({ error: "Portal URL unavailable" }, { status: 500 });
  }
  return NextResponse.json({ url: portalUrl });
}
