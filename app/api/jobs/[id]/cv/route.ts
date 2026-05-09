import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MOCK_JOBS, getMockCV } from "@/lib/mock-data";
import { generateCVTailor } from "@/lib/ai/cv-tailor";
import { consumeUsage } from "@/lib/billing";
import type { ParsedResume, Job } from "@/lib/types";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const existing = await prisma.cVTailor.findUnique({
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
  const bill = await consumeUsage(session.user.id, "cv");
  if (!bill.ok) {
    return NextResponse.json({
      error: "LIMIT_REACHED",
      planTier: bill.planTier,
      tickets: bill.tickets,
      adSessionsLeft: bill.adSessionsLeft,
    }, { status: 402 });
  }

  try {
    let job = MOCK_JOBS.find((j) => j.id === params.id) ?? null;
    if (!job) {
      const dbJob = await prisma.job.findUnique({ where: { id: params.id } });
      if (dbJob) job = dbJob as unknown as Job;
    }
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

    const resume = await prisma.resume.findFirst({
      where: { userId: session.user.id, isActive: true },
      orderBy: { createdAt: "desc" },
    });

    const parsedResume: ParsedResume = resume
      ? (resume.parsed as unknown as ParsedResume)
      : { name: session.user.name ?? "User", headline: "Professional", skills: [], experience: [] };

    let cv;
    try {
      cv = await generateCVTailor(job, parsedResume);
    } catch {
      cv = getMockCV(job.title, job.company);
    }

    try {
      const saved = await prisma.cVTailor.upsert({
        where: { userId_jobId: { userId: session.user.id, jobId: params.id } },
        create: { userId: session.user.id, jobId: params.id, summary: cv.summary, bullets: cv.bullets, diffNote: cv.diffNote },
        update: { summary: cv.summary, bullets: cv.bullets, diffNote: cv.diffNote },
      });
      return NextResponse.json(saved);
    } catch {
      return NextResponse.json({ ...cv, id: "mock", userId: session.user.id, jobId: params.id });
    }
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
