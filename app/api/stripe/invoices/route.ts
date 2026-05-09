import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe, STRIPE_ENABLED } from "@/lib/stripe";

// Returns up to 24 most-recent invoices for the user. Empty list if no Stripe customer.
export async function GET() {
  if (!STRIPE_ENABLED || !stripe) {
    return NextResponse.json({ invoices: [] });
  }

  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { stripeCustomerId: true },
  });
  if (!user?.stripeCustomerId) return NextResponse.json({ invoices: [] });

  try {
    const list = await stripe.invoices.list({ customer: user.stripeCustomerId, limit: 24 });
    const invoices = list.data.map((inv) => ({
      id:        inv.id,
      number:    inv.number,
      created:   inv.created,
      total:     inv.total,
      currency:  inv.currency,
      status:    inv.status,
      hostedUrl: inv.hosted_invoice_url,
      pdfUrl:    inv.invoice_pdf,
    }));
    return NextResponse.json({ invoices });
  } catch (err) {
    return NextResponse.json({ invoices: [], error: String(err) });
  }
}
