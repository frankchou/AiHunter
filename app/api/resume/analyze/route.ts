import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { analyzeResume } from "@/lib/ai/resume-analyzer";
import { consumeUsage } from "@/lib/billing";
import type { ParsedResume, ResumeAnalysis } from "@/lib/types";

function hashParsed(parsed: ParsedResume): string {
  return createHash("md5").update(JSON.stringify(parsed)).digest("hex");
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { parsed } = await req.json() as { parsed: ParsedResume };
  if (!parsed) return NextResponse.json({ error: "parsed required" }, { status: 400 });

  const incomingHash = hashParsed(parsed);

  // Check for cached analysis on the user's active resume
  const resume = await prisma.resume.findFirst({
    where: { userId: session.user.id, isActive: true },
    orderBy: { createdAt: "desc" },
    select: { id: true, parsedHash: true, analysis: true },
  });

  if (resume?.analysis && resume.parsedHash === incomingHash) {
    // Content unchanged — return cached result (no ticket cost for cache hit)
    return NextResponse.json(resume.analysis);
  }

  // Content changed or no cache — check billing before running Claude
  const bill = await consumeUsage(session.user.id, "analysis");
  if (!bill.ok) {
    return NextResponse.json({
      error: "LIMIT_REACHED",
      planTier: bill.planTier,
      tickets: bill.tickets,
      adSessionsLeft: bill.adSessionsLeft,
    }, { status: 402 });
  }

  // Run Claude
  try {
    const analysis = await analyzeResume(parsed);

    // Save analysis + hash back to resume
    if (resume) {
      await prisma.resume.update({
        where: { id: resume.id },
        data: { analysis: analysis as object, parsedHash: incomingHash },
      });
    }

    return NextResponse.json(analysis);
  } catch (err) {
    console.error("[analyze route] error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
