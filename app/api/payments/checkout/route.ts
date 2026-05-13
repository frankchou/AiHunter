import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { createCheckout } from "@lemonsqueezy/lemonsqueezy.js";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { initLemonSqueezy, LEMON_ENABLED, LS_STORE_ID } from "@/lib/payments/client";
import { variantIdForTier, type PaidTier } from "@/lib/payments/plans";

// Create a LemonSqueezy checkout URL for the given paid tier.
// We embed { userId, tier } into the checkout's custom_data, which
// LemonSqueezy echoes back on every subscription webhook event in
// `meta.custom_data` — that's the only reliable bridge from a payment
// event to our internal user row.
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!LEMON_ENABLED || !LS_STORE_ID) {
    return NextResponse.json(
      { error: "Payments not configured. Check LEMONSQUEEZY_* env vars." },
      { status: 503 }
    );
  }

  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { tier } = (await req.json()) as { tier: PaidTier };
  const variantId = variantIdForTier(tier);
  if (!variantId) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, name: true },
  });
  if (!user?.email) {
    return NextResponse.json({ error: "User missing email" }, { status: 400 });
  }

  const origin = req.headers.get("origin") ?? "http://localhost:3000";

  initLemonSqueezy();
  const result = await createCheckout(LS_STORE_ID, variantId, {
    checkoutOptions: { embed: false, media: false, logo: true },
    checkoutData: {
      email: user.email,
      name: user.name ?? undefined,
      custom: {
        userId: session.user.id,
        tier,
      },
    },
    productOptions: {
      redirectUrl: `${origin}/settings?upgraded=1`,
      receiptButtonText: "回到 AI Hunter",
      receiptThankYouNote: "感謝訂閱，現在開始使用所有功能",
    },
  });

  const url = result.data?.data.attributes.url;
  if (!url) {
    console.error("[lemon-checkout] failed:", result);
    return NextResponse.json({ error: "Failed to create checkout" }, { status: 500 });
  }
  return NextResponse.json({ url });
}
