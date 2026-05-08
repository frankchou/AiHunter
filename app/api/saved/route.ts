import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MOCK_JOBS } from "@/lib/mock-data";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const saved = await prisma.savedJob.findMany({
      where: { userId: session.user.id },
      include: { job: true },
      orderBy: { savedAt: "desc" },
    });
    return NextResponse.json(saved);
  } catch {
    return NextResponse.json([]);
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { jobId, stage = "saved" } = await req.json();
  if (!jobId) return NextResponse.json({ error: "jobId required" }, { status: 400 });

  try {
    // Ensure job exists in DB; upsert from mock if needed
    const existingJob = await prisma.job.findUnique({ where: { id: jobId } }).catch(() => null);
    if (!existingJob) {
      const mock = MOCK_JOBS.find((j) => j.id === jobId);
      if (mock) {
        await prisma.job.upsert({
          where: { id: jobId },
          create: {
            id: mock.id,
            externalId: mock.externalId,
            title: mock.title, company: mock.company, ticker: mock.ticker,
            country: mock.country, city: mock.city, remote: mock.remote,
            type: mock.type, salaryMin: mock.salaryMin, salaryMax: mock.salaryMax, ccy: mock.ccy,
            yearsMin: mock.yearsMin, yearsMax: mock.yearsMax, industry: mock.industry,
            skills: mock.skills, description: mock.description, source: mock.source,
            sourceUrl: mock.sourceUrl, sourceHash: mock.sourceHash,
            postedAt: mock.postedAt ? new Date(mock.postedAt) : null,
            score: mock.score, matchReasons: mock.matchReasons,
          },
          update: {},
        }).catch(() => null);
      }
    }

    const saved = await prisma.savedJob.upsert({
      where: { userId_jobId: { userId: session.user.id, jobId } },
      create: { userId: session.user.id, jobId, stage },
      update: {},
      include: { job: true },
    });
    return NextResponse.json(saved);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { jobId } = await req.json();
  try {
    await prisma.savedJob.delete({
      where: { userId_jobId: { userId: session.user.id, jobId } },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
