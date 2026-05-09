import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe, STRIPE_ENABLED } from "@/lib/stripe";
import { PLANS } from "@/lib/plans";

export async function POST(req: NextRequest) {
  if (!STRIPE_ENABLED || !stripe) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { tier } = await req.json() as { tier: "pro" | "max" };
  const plan = PLANS[tier];
  if (!plan || !plan.stripePriceId) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, stripeCustomerId: true },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Create or reuse Stripe customer
  let customerId = user.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      metadata: { userId: session.user.id },
    });
    customerId = customer.id;
    await prisma.user.update({
      where: { id: session.user.id },
      data: { stripeCustomerId: customerId },
    });
  }

  const origin = req.headers.get("origin") ?? "http://localhost:3000";

  const checkoutSession = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: plan.stripePriceId, quantity: 1 }],
    success_url: `${origin}/settings?upgraded=1`,
    cancel_url: `${origin}/pricing`,
    subscription_data: { metadata: { userId: session.user.id, tier } },
    allow_promotion_codes: true,
  });

  return NextResponse.json({ url: checkoutSession.url });
}
