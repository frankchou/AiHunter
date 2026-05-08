import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { INDUSTRIES } from "@/lib/mock-data";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const industry = req.nextUrl.searchParams.get("industry") ?? "tech.saas";

  try {
    // Aggregate top companies in this industry from real job data
    const jobs = await prisma.job.findMany({
      where: { industry },
      select: { company: true, ticker: true, score: true, title: true, country: true, city: true },
    });

    // Group by company, count jobs, avg score
    const companyMap = new Map<string, { count: number; scores: number[]; ticker: string | null; locations: Set<string>; titles: string[] }>();
    for (const j of jobs) {
      const key = j.company;
      if (!companyMap.has(key)) {
        companyMap.set(key, { count: 0, scores: [], ticker: j.ticker, locations: new Set(), titles: [] });
      }
      const entry = companyMap.get(key)!;
      entry.count++;
      if (j.score != null) entry.scores.push(j.score);
      if (j.city && j.country) entry.locations.add(`${j.city}, ${j.country}`);
      if (j.title) entry.titles.push(j.title);
    }

    const companies = Array.from(companyMap.entries())
      .map(([name, d]) => ({
        rank: 0,
        name,
        ticker: d.ticker ?? "—",
        jobCount: d.count,
        avgScore: d.scores.length ? Math.round((d.scores.reduce((a, b) => a + b, 0) / d.scores.length) * 100) : null,
        locations: [...d.locations].slice(0, 3).join(" · ") || "—",
        sampleTitles: [...new Set(d.titles)].slice(0, 3),
      }))
      .sort((a, b) => (b.avgScore ?? 0) - (a.avgScore ?? 0) || b.jobCount - a.jobCount)
      .slice(0, 100)
      .map((c, i) => ({ ...c, rank: i + 1 }));

    return NextResponse.json({ companies, industries: INDUSTRIES });
  } catch {
    return NextResponse.json({ companies: [], industries: INDUSTRIES });
  }
}
