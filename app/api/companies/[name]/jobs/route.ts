import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { consumeCompanyScoring, getProMonthlyUsage } from "@/lib/billing";
import { COMPANY_SCORING_PAGE_SIZE } from "@/lib/plans";
import {
  countriesForRegion, fetchCompanyJobsPage,
  type AdzunaJobRow,
} from "@/lib/job-sources/adzuna-company";
import { scoreJob } from "@/lib/ai/match";
import type { ParsedResume, JobPreference, Job as TJob } from "@/lib/types";

const PAGE_SIZE = COMPANY_SCORING_PAGE_SIZE; // 10

// ─── Shared helpers ──────────────────────────────────────────────────────────

interface RegionLookup {
  region: string | null;
}

// Read the AI Top 20 cache to find which region this company belongs to.
// We need this to know which Adzuna countries to probe when fetching pages.
async function lookupCompanyRegion(companyName: string): Promise<RegionLookup> {
  const caches = await prisma.industryCache.findMany();
  for (const c of caches) {
    const data = c.data as unknown as { companies?: Array<{ name?: string; region?: string }> };
    const hit = data.companies?.find((cc) => cc.name === companyName);
    if (hit?.region) return { region: hit.region };
  }
  return { region: null };
}

// Upsert Adzuna rows into Job table by sourceHash (dedupe across pipelines).
async function upsertJobs(rows: AdzunaJobRow[]): Promise<TJob[]> {
  const saved: TJob[] = [];
  for (const r of rows) {
    try {
      const job = await prisma.job.upsert({
        where:  { externalId: r.externalId },
        create: {
          externalId:  r.externalId,
          title:       r.title,
          company:     r.company,
          country:     r.country,
          city:        r.city,
          remote:      r.remote,
          type:        r.type,
          salaryMin:   r.salaryMin,
          salaryMax:   r.salaryMax,
          ccy:         r.ccy,
          yearsMin:    r.yearsMin,
          yearsMax:    r.yearsMax,
          industry:    r.industry,
          skills:      r.skills,
          description: r.description,
          source:      r.source,
          sourceUrl:   r.sourceUrl,
          sourceHash:  r.sourceHash,
          postedAt:    r.postedAt,
        },
        update: {
          // keep description fresh in case it changed
          description: r.description,
          salaryMin:   r.salaryMin,
          salaryMax:   r.salaryMax,
        },
      });
      saved.push(job as unknown as TJob);
    } catch {
      // best-effort dedupe
    }
  }
  return saved;
}

// ─── GET: fetch a page of jobs for a company ────────────────────────────────
// Query params:
//   page: 1-based page number
//
// Returns:
//   jobs: Job[] with score / matchReasons populated from JobScore (per-user)
//         OR score:null + locked:true if not yet unlocked / stale resume hash
//   pagination: { page, pageSize, hasMore }
//   policy: { tier, freeAvailable, ticketsAvailable, ... }
export async function GET(req: NextRequest, { params }: { params: { name: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const companyName = decodeURIComponent(params.name);
  const page = Math.max(1, parseInt(req.nextUrl.searchParams.get("page") ?? "1"));

  // 1. Find the user's active resume — we need parsedHash for staleness check
  const resume = await prisma.resume.findFirst({
    where: { userId: session.user.id, isActive: true },
    orderBy: { createdAt: "desc" },
    select: { parsedHash: true },
  });
  const currentParsedHash = resume?.parsedHash ?? null;

  // 2. Try to read this page from cached Job rows first (saves Adzuna queries)
  let jobsFromDb = await prisma.job.findMany({
    where: { company: { contains: companyName, mode: "insensitive" }, source: "adzuna" },
    orderBy: { postedAt: "desc" },
    skip:    (page - 1) * PAGE_SIZE,
    take:    PAGE_SIZE,
  });

  // If the page is empty AND we're on page 1, do a fresh Adzuna fetch.
  // For deeper pages, only fetch if we know there are more (count > skip).
  const totalCached = await prisma.job.count({
    where: { company: { contains: companyName, mode: "insensitive" }, source: "adzuna" },
  });

  const needFresh = jobsFromDb.length < PAGE_SIZE && totalCached <= (page - 1) * PAGE_SIZE + jobsFromDb.length;
  if (needFresh) {
    const { region } = await lookupCompanyRegion(companyName);
    const countries  = countriesForRegion(region);
    const adzunaRows = await fetchCompanyJobsPage(companyName, countries, { page, pageSize: PAGE_SIZE });
    if (adzunaRows.length) {
      await upsertJobs(adzunaRows);
      jobsFromDb = await prisma.job.findMany({
        where: { company: { contains: companyName, mode: "insensitive" }, source: "adzuna" },
        orderBy: { postedAt: "desc" },
        skip:    (page - 1) * PAGE_SIZE,
        take:    PAGE_SIZE,
      });
    }
  }

  // 3. Attach per-user score (locked indicator if missing / stale)
  const jobIds = jobsFromDb.map((j) => j.id);
  const scoreRows = jobIds.length
    ? await prisma.jobScore.findMany({ where: { userId: session.user.id, jobId: { in: jobIds } } })
    : [];
  const scoreByJobId = new Map(scoreRows.map((s) => [s.jobId, s]));

  const jobs = jobsFromDb.map((j) => {
    const s = scoreByJobId.get(j.id);
    const fresh = s && currentParsedHash !== null && s.parsedHash === currentParsedHash;
    return {
      ...j,
      score:        fresh ? s.score   : null,
      matchReasons: fresh ? s.reasons : [],
      locked:       !fresh,
      staleScore:   !!s && !fresh,   // had a score but resume changed
    };
  });

  // 4. Plan info for the UI
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { planTier: true, isSuperUser: true, adTickets: true },
  });
  const tier = user?.isSuperUser ? "max" : (user?.planTier ?? "free");
  const proUsage = tier === "pro"
    ? await getProMonthlyUsage(session.user.id, companyName)
    : null;

  const total = await prisma.job.count({
    where: { company: { contains: companyName, mode: "insensitive" }, source: "adzuna" },
  });

  return NextResponse.json({
    jobs,
    pagination: {
      page,
      pageSize: PAGE_SIZE,
      total,
      hasMore: page * PAGE_SIZE < total,
    },
    policy: {
      tier,
      tickets:        user?.adTickets ?? 0,
      proUsage,                                // null unless tier==="pro"
      pageSize:       PAGE_SIZE,
      currentParsedHash,
      canRecalculate: tier !== "free",          // only paid plans see the button
    },
  });
}

// ─── POST: unlock scores for the given page ─────────────────────────────────
// Body: { page: number, recalculate?: boolean }
//
// If `recalculate=true`, requires that the user's current resume parsedHash
// differs from all stored JobScores for this page — otherwise rejected with
// HASH_UNCHANGED. Pro quota is consumed equally for unlock and recalculate.
export async function POST(req: NextRequest, { params }: { params: { name: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const companyName = decodeURIComponent(params.name);
  const body = await req.json().catch(() => ({}));
  const page = Math.max(1, parseInt(body.page ?? "1"));
  const recalculate = !!body.recalculate;

  // 1. Load resume (needed to score)
  const resume = await prisma.resume.findFirst({
    where: { userId: session.user.id, isActive: true },
    orderBy: { createdAt: "desc" },
  });
  if (!resume) {
    return NextResponse.json({ error: "需要先上傳履歷才能評分" }, { status: 400 });
  }
  const parsedResume = resume.parsed as unknown as ParsedResume;
  const parsedHash   = resume.parsedHash ?? "no-hash";

  // 2. Find jobs for this page
  const jobs = await prisma.job.findMany({
    where: { company: { contains: companyName, mode: "insensitive" }, source: "adzuna" },
    orderBy: { postedAt: "desc" },
    skip:    (page - 1) * PAGE_SIZE,
    take:    PAGE_SIZE,
  });
  if (jobs.length === 0) {
    return NextResponse.json({ error: "本頁無職缺可評分" }, { status: 400 });
  }

  // 3. If recalculate, verify resume has actually changed
  if (recalculate) {
    const jobIds = jobs.map((j) => j.id);
    const existing = await prisma.jobScore.findMany({
      where: { userId: session.user.id, jobId: { in: jobIds } },
    });
    const allHashesMatch =
      existing.length === jobs.length &&
      existing.every((s) => s.parsedHash === parsedHash);
    if (allHashesMatch) {
      return NextResponse.json({
        error: "HASH_UNCHANGED",
        message: "履歷沒有新版本，無需重新計算。請先到「履歷」頁上傳新版。",
      }, { status: 400 });
    }
  }

  // 4. Consume billing (Free: ticket / Pro: quota / Max: free)
  const bill = await consumeCompanyScoring(session.user.id, companyName);
  if (!bill.ok) {
    if (bill.reason === "PRO_QUOTA_EXCEEDED") {
      return NextResponse.json({
        error: "PRO_QUOTA_EXCEEDED",
        planTier: "pro",
        pagesUnlocked: bill.pagesUnlocked,
        quotaMax: bill.quotaMax,
        resetAt: bill.resetAt,
      }, { status: 402 });
    }
    if (bill.reason === "FREE_NO_TICKETS") {
      return NextResponse.json({
        error: "FREE_NO_TICKETS",
        planTier: "free",
        tickets: bill.tickets,
        adSessionsLeft: bill.adSessionsLeft,
      }, { status: 402 });
    }
    return NextResponse.json({ error: "NO_USER" }, { status: 401 });
  }

  // 5. Load preferences for scoring
  const prefRow = await prisma.preference.findUnique({
    where: { userId: session.user.id },
  });
  const prefs: JobPreference = {
    locations:  prefRow?.locations  ?? [],
    salaryMin:  prefRow?.salaryMin  ?? 0,
    salaryMax:  prefRow?.salaryMax  ?? null,
    salaryCcy:  prefRow?.salaryCcy  ?? "TWD",
    industries: prefRow?.industries ?? [],
    employment: prefRow?.employment ?? [],
    remote:     prefRow?.remote     ?? [],
    languages:  prefRow?.languages  ?? [],
    titles:     prefRow?.titles     ?? "",
  };

  // 6. Score in parallel (small batch, OK to fire together for 10 jobs)
  const scored = await Promise.all(
    jobs.map(async (j) => {
      try {
        const { score, reasons } = await scoreJob(j as unknown as TJob, parsedResume, prefs);
        return { jobId: j.id, score, reasons };
      } catch {
        return { jobId: j.id, score: 0.5, reasons: ["AI 評分失敗，預設 50 分"] };
      }
    }),
  );

  // 7. Upsert JobScore for each
  await Promise.all(scored.map((s) =>
    prisma.jobScore.upsert({
      where:  { userId_jobId: { userId: session.user.id, jobId: s.jobId } },
      create: { userId: session.user.id, jobId: s.jobId, parsedHash, score: s.score, reasons: s.reasons },
      update: { parsedHash, score: s.score, reasons: s.reasons, createdAt: new Date() },
    }),
  ));

  return NextResponse.json({
    ok: true,
    page,
    scored: scored.map((s) => ({ jobId: s.jobId, score: s.score, reasons: s.reasons })),
    fromTicket: bill.fromTicket,
  });
}
