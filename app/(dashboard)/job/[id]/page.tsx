import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { MOCK_JOBS } from "@/lib/mock-data";
import { JobDetail } from "@/components/jobs/JobDetail";
import type { Job } from "@/lib/types";

interface Props {
  params: { id: string };
}

export async function generateMetadata() {
  return { title: "職缺詳情 — AI Hunter" };
}

export default async function JobDetailPage({ params }: Props) {
  let job: Job | null = null;
  const jobId = decodeURIComponent(params.id);

  try {
    const dbJob = await prisma.job.findUnique({ where: { id: jobId } });
    if (dbJob) {
      job = {
        id: dbJob.id,
        externalId: dbJob.externalId,
        title: dbJob.title,
        company: dbJob.company,
        ticker: dbJob.ticker,
        country: dbJob.country,
        city: dbJob.city,
        remote: dbJob.remote,
        type: dbJob.type,
        salaryMin: dbJob.salaryMin,
        salaryMax: dbJob.salaryMax,
        ccy: dbJob.ccy,
        yearsMin: dbJob.yearsMin,
        yearsMax: dbJob.yearsMax,
        industry: dbJob.industry,
        skills: dbJob.skills as string[],
        description: dbJob.description,
        source: dbJob.source,
        sourceUrl: dbJob.sourceUrl,
        sourceHash: dbJob.sourceHash,
        postedAt: dbJob.postedAt?.toISOString() ?? null,
        crawledAt: dbJob.crawledAt.toISOString(),
        score: dbJob.score,
        matchReasons: dbJob.matchReasons as string[],
      };
    }
  } catch {
    // DB not available
  }

  if (!job) {
    job = MOCK_JOBS.find((j) => j.id === params.id) ?? null;
  }

  if (!job) notFound();

  return <JobDetail job={job} />;
}
