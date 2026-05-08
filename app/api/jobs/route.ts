import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { JobFilters } from "@/lib/types";
import type { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const filters: JobFilters = {
    q: sp.get("q") ?? undefined,
    countries: sp.getAll("countries"),
    remote: sp.getAll("remote"),
    industries: sp.getAll("industries"),
    sources: sp.getAll("sources"),
    yearsMin: sp.get("yearsMin") ? Number(sp.get("yearsMin")) : undefined,
    yearsMax: sp.get("yearsMax") ? Number(sp.get("yearsMax")) : undefined,
    titles: sp.get("titles") ?? undefined,
    sort: (sp.get("sort") as JobFilters["sort"]) ?? "score",
    page: sp.get("page") ? Number(sp.get("page")) : 1,
    pageSize: sp.get("pageSize") ? Number(sp.get("pageSize")) : 10,
  };

  try {
    const where: Record<string, unknown> = {};
    if (filters.countries?.length) where.country = { in: filters.countries };
    if (filters.remote?.length) where.remote = { in: filters.remote };
    if (filters.industries?.length) where.industry = { in: filters.industries };
    if (filters.sources?.length) where.source = { in: filters.sources };
    if (filters.yearsMin) where.yearsMax = { gte: filters.yearsMin };
    if (filters.yearsMax) where.yearsMin = { lte: filters.yearsMax };
    if (filters.titles) where.title = { contains: filters.titles, mode: "insensitive" };
    if (filters.q) {
      where.OR = [
        { title: { contains: filters.q, mode: "insensitive" } },
        { company: { contains: filters.q, mode: "insensitive" } },
        { description: { contains: filters.q, mode: "insensitive" } },
      ];
    }

    const orderBy: Prisma.JobOrderByWithRelationInput =
      filters.sort === "date"   ? { postedAt: "desc" } :
      filters.sort === "salary" ? { salaryMax: "desc" } :
      { score: "desc" };

    const [total, jobs] = await Promise.all([
      prisma.job.count({ where: where as Prisma.JobWhereInput }),
      prisma.job.findMany({
        where: where as Prisma.JobWhereInput,
        orderBy,
        skip: ((filters.page ?? 1) - 1) * (filters.pageSize ?? 10),
        take: filters.pageSize ?? 10,
      }),
    ]);

    return NextResponse.json({ jobs, total, page: filters.page ?? 1, pageSize: filters.pageSize ?? 10 });
  } catch {
    // DB not available — return empty, user should crawl first
    return NextResponse.json({ jobs: [], total: 0, page: 1, pageSize: filters.pageSize ?? 10 });
  }
}
