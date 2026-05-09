import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MOCK_JOBS, getMockInsight } from "@/lib/mock-data";
import { generateInsight } from "@/lib/ai/insights";
import { consumeUsage } from "@/lib/billing";
import type { ParsedResume, Job } from "@/lib/types";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const existing = await prisma.insight.findUnique({
      where: { userId_jobId: { userId: session.user.id, jobId: params.id } },
    });
    if (existing) return NextResponse.json(existing);
  } catch { /* fall through */ }

  return NextResponse.json({ data: null });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Check plan limits (owner bypass + ticket fallback handled inside consumeUsage)
  const bill = await consumeUsage(session.user.id, "insight");
  if (!bill.ok) {
    return NextResponse.json({
      error: "LIMIT_REACHED",
      planTier: bill.planTier,
      tickets: bill.tickets,
      adSessionsLeft: bill.adSessionsLeft,
    }, { status: 402 });
  }

  try {
    // Get job
    let job = MOCK_JOBS.find((j) => j.id === params.id) ?? null;
    if (!job) {
      const dbJob = await prisma.job.findUnique({ where: { id: params.id } });
      if (dbJob) job = dbJob as unknown as Job;
    }
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

    // Get resume
    const resume = await prisma.resume.findFirst({
      where: { userId: session.user.id, isActive: true },
      orderBy: { createdAt: "desc" },
    });

    const parsedResume: ParsedResume = resume
      ? (resume.parsed as unknown as ParsedResume)
      : { name: session.user.name ?? "User", headline: "Professional", skills: [], experience: [] };

    // Try AI generation, fall back to mock
    let insight;
    try {
      insight = await generateInsight(job, parsedResume);
    } catch {
      insight = getMockInsight(params.id, job.title, job.company);
    }

    // Persist if DB is available
    const insightFields = {
      companyTrend: insight.companyTrend ?? null,
      industryTrend: insight.industryTrend ?? null,
      swot: insight.swot,
      risks: insight.risks,
      strategy: insight.strategy,
      questions: insight.questions,
      refs: insight.refs,
    };
    try {
      const saved = await prisma.insight.upsert({
        where: { userId_jobId: { userId: session.user.id, jobId: params.id } },
        create: { userId: session.user.id, jobId: params.id, ...insightFields },
        update: insightFields,
      });
      return NextResponse.json(saved);
    } catch {
      return NextResponse.json({ ...insight, id: "mock", userId: session.user.id, jobId: params.id });
    }
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
