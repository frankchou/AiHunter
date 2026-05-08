import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const DEFAULT_PREFS = {
  locations: ["Taipei", "Remote"],
  salaryMin: 2_400_000,
  salaryCcy: "TWD",
  industries: ["tech.saas", "ai"],
  employment: ["ft"],
  remote: ["hybrid", "remote"],
  languages: ["zh-TW", "en"],
  titles: "Senior PM, Growth PM",
};

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const prefs = await prisma.preference.findUnique({ where: { userId: session.user.id } });
    return NextResponse.json(prefs ?? DEFAULT_PREFS);
  } catch {
    return NextResponse.json(DEFAULT_PREFS);
  }
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  try {
    const prefs = await prisma.preference.upsert({
      where: { userId: session.user.id },
      create: { userId: session.user.id, ...body },
      update: body,
    });
    return NextResponse.json(prefs);
  } catch {
    return NextResponse.json({ ...DEFAULT_PREFS, ...body });
  }
}
