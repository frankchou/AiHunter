import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { INDUSTRIES } from "@/lib/mock-data";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      planTier: true,
      insightsUsed: true,
      analysisUsed: true,
      isSuperUser: true,
      usageMonth: true,
      stripeCustomerId: true,
      lastViewedIndustry: true,
    },
  });

  return NextResponse.json(user ?? {});
}

// PATCH: update lightweight profile preferences. Currently only
// lastViewedIndustry — extend the schema below as new sticky prefs land.
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const data: { lastViewedIndustry?: string | null } = {};

  if ("lastViewedIndustry" in body) {
    const v = body.lastViewedIndustry;
    if (v === null) {
      data.lastViewedIndustry = null;
    } else if (typeof v === "string" && INDUSTRIES.some((i) => i.id === v)) {
      data.lastViewedIndustry = v;
    } else {
      return NextResponse.json({ error: "invalid industry id" }, { status: 400 });
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "no updatable fields" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data,
  });
  return NextResponse.json({ ok: true });
}
