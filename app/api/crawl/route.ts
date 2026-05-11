import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { crawlJobs } from "@/lib/job-sources";
import { consumeUsage } from "@/lib/billing";
import type { ParsedResume, JobPreference } from "@/lib/types";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // ── Billing gate ──────────────────────────────────────────────────────
  // Crawl triggers Adzuna + other source queries AND batchScoreJobs (up to
  // 25 AI calls). Without this gate, free users could spam 「更新職缺」
  // and rack up unlimited AI cost.
  //
  // Exception: a brand-new user with no prior jobs whatsoever in the
  // system gets one free auto-crawl as onboarding (so they see SOME
  // content on first /feed visit).
  const resume = await prisma.resume.findFirst({
    where: { userId: session.user.id, isActive: true },
    orderBy: { createdAt: "desc" },
  });
  if (!resume) {
    return NextResponse.json({ error: "需要先上傳履歷才能抓取職缺" }, { status: 400 });
  }

  const userJobCount = await prisma.job.count();
  const isOnboarding = userJobCount === 0; // empty DB → first-ever crawl, free

  if (!isOnboarding) {
    const bill = await consumeUsage(session.user.id, "analysis");
    if (!bill.ok) {
      return NextResponse.json({
        error: "LIMIT_REACHED",
        planTier: bill.planTier,
        tickets: bill.tickets,
        adSessionsLeft: bill.adSessionsLeft,
        message: "更新職缺需要 1 張解析券（與履歷解析共用配額）",
      }, { status: 402 });
    }
  }

  try {
    const prefs = await prisma.preference.findUnique({ where: { userId: session.user.id } });

    // `resume` already loaded above for the billing gate
    const parsedResume: ParsedResume = resume.parsed as unknown as ParsedResume;

    const jobPrefs: JobPreference = prefs
      ? {
          locations: prefs.locations,
          salaryMin: prefs.salaryMin,
          salaryMax: (prefs as unknown as { salaryMax?: number | null }).salaryMax ?? null,
          salaryCcy: prefs.salaryCcy,
          industries: prefs.industries,
          employment: prefs.employment,
          remote: prefs.remote,
          languages: prefs.languages,
          titles: prefs.titles,
        }
      : {
          locations: ["Taipei", "Remote"],
          salaryMin: 0,
          salaryMax: null,
          salaryCcy: "TWD",
          industries: [],
          employment: ["ft"],
          remote: ["hybrid", "remote"],
          languages: ["zh-TW", "en"],
          titles: "",
        };

    const { jobs, sources, errors } = await crawlJobs(jobPrefs, parsedResume);

    // Persist to DB
    let persisted = 0;
    for (const job of jobs) {
      if (job.id.startsWith("mock_")) continue; // skip mocks
      try {
        await prisma.job.upsert({
          where: { externalId: job.externalId ?? job.id },
          create: {
            id: job.id,
            externalId: job.externalId,
            title: job.title, company: job.company, ticker: job.ticker,
            country: job.country, city: job.city, remote: job.remote,
            type: job.type, salaryMin: job.salaryMin, salaryMax: job.salaryMax, ccy: job.ccy,
            yearsMin: job.yearsMin, yearsMax: job.yearsMax, industry: job.industry,
            skills: job.skills, description: job.description, source: job.source,
            sourceUrl: job.sourceUrl, sourceHash: job.sourceHash,
            postedAt: job.postedAt ? new Date(job.postedAt) : null,
            score: job.score, matchReasons: job.matchReasons,
          },
          update: { score: job.score, matchReasons: job.matchReasons, crawledAt: new Date() },
        });
        persisted++;
      } catch { /* skip individual errors */ }
    }

    return NextResponse.json({
      total: jobs.length,
      persisted,
      sources,
      errors,
      preview: jobs.slice(0, 5).map((j) => ({ id: j.id, title: j.title, score: j.score })),
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
