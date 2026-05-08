import axios from "axios";
import type { Job } from "@/lib/types";
import { hashUrl } from "@/lib/utils";

interface RemotiveJob {
  id: number;
  url: string;
  title: string;
  company_name: string;
  category: string;
  tags: string[];
  job_type: string;
  publication_date: string;
  candidate_required_location: string;
  salary: string;
  description: string;
}

const CATEGORY_MAP: Record<string, string> = {
  "Product": "tech.saas",
  "Design": "tech.consumer",
  "Software Dev": "ai",
  "Finance / Legal": "fintech",
  "Data": "ai",
  "DevOps / Sysadmin": "tech.saas",
  "Marketing": "tech.consumer",
};

export async function fetchRemotiveJobs(keywords: string[] = ["product manager"]): Promise<Job[]> {
  const results: Job[] = [];

  for (const kw of keywords.slice(0, 2)) {
    try {
      const { data } = await axios.get<{ jobs: RemotiveJob[] }>(
        `https://remotive.com/api/remote-jobs`,
        { params: { category: "product", search: kw, limit: 20 }, timeout: 10_000 }
      );

      for (const j of data.jobs ?? []) {
        const sourceUrl = j.url;
        results.push({
          id: `remotive_${j.id}`,
          externalId: `remotive_${j.id}`,
          title: j.title,
          company: j.company_name,
          country: "—",
          city: j.candidate_required_location || "Remote",
          remote: "remote",
          type: j.job_type || "Full-time",
          salaryMin: null,
          salaryMax: null,
          ccy: "USD",
          yearsMin: null,
          yearsMax: null,
          industry: CATEGORY_MAP[j.category] ?? "tech.saas",
          skills: j.tags.slice(0, 6),
          description: j.description.replace(/<[^>]+>/g, "").slice(0, 2000),
          source: "remotive",
          sourceUrl,
          sourceHash: hashUrl(sourceUrl),
          postedAt: new Date(j.publication_date).toISOString(),
          crawledAt: new Date().toISOString(),
          score: null,
          matchReasons: [],
        });
      }
    } catch {
      // silently skip on error
    }
  }

  return results;
}
