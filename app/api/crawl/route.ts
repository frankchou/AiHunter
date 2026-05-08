import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { crawlJobs } from "@/lib/job-sources";
import type { ParsedResume, JobPreference } from "@/lib/types";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const resume = await prisma.resume.findFirst({
      where: { userId: session.user.id, isActive: true },
      orderBy: { createdAt: "desc" },
    });

    const prefs = await prisma.preference.findUnique({ where: { userId: session.user.id } });

    const parsedResume: ParsedResume = resume
      ? (resume.parsed as unknown as ParsedResume)
      : { name: session.user.name ?? "User", headline: "Professional", skills: [], experience: [] };

    const jobPrefs: JobPreference = prefs
      ? {
          locations: prefs.locations,
          salaryMin: prefs.salaryMin,
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
