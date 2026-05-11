import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { consumeUsage } from "@/lib/billing";
import { draftGeneralCoverLetter } from "@/lib/ai/cover-letter";
import type { ParsedResume } from "@/lib/types";

// AI-assisted drafting / suggestion of the user's general cover letter.
// Charged against the shared `analysis` quota (free 3/mo, pro 15, max ∞).
// Does NOT save — frontend takes the returned draft, lets the user edit, then POSTs to /api/cover-letter.
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Validate prerequisites BEFORE charging — don't burn the user's ticket
  // if we can't actually deliver value (no resume → AI has nothing to use)
  const resume = await prisma.resume.findFirst({
    where: { userId: session.user.id, isActive: true },
    orderBy: { createdAt: "desc" },
  });
  if (!resume) {
    return NextResponse.json({ error: "需要先上傳履歷才能讓 AI 起草 CV" }, { status: 400 });
  }

  const bill = await consumeUsage(session.user.id, "analysis");
  if (!bill.ok) {
    return NextResponse.json({
      error: "LIMIT_REACHED",
      planTier: bill.planTier,
      tickets: bill.tickets,
      adSessionsLeft: bill.adSessionsLeft,
    }, { status: 402 });
  }

  try {
    const parsed = resume.parsed as unknown as ParsedResume;
    const content = await draftGeneralCoverLetter(parsed);
    return NextResponse.json({ content });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
