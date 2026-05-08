import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { INDUSTRY_TOP100, INDUSTRIES } from "@/lib/mock-data";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const industry = req.nextUrl.searchParams.get("industry") ?? "tech.saas";
  const companies = INDUSTRY_TOP100[industry] ?? [];

  return NextResponse.json({ companies, industries: INDUSTRIES });
}
