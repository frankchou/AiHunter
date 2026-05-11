import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { INDUSTRIES } from "@/lib/mock-data";
import { consumeUsage } from "@/lib/billing";
import { countriesForRegion, probeAndIngestCompanyJobs } from "@/lib/job-sources/adzuna-company";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const CACHE_TTL_DAYS = 7;

const INDUSTRY_LABELS: Record<string, string> = {
  "tech.saas": "SaaS / Cloud / Enterprise Software",
  "tech.consumer": "Consumer Tech / Mobile / E-commerce",
  "ai": "Artificial Intelligence / Machine Learning",
  "fintech": "FinTech / Financial Services",
  "health": "Healthcare / BioTech / MedTech",
  "retail": "Retail / Logistics / Supply Chain",
};

async function generateIndustryTop(industry: string): Promise<object> {
  const label = INDUSTRY_LABELS[industry] ?? industry;
  const prompt = `You are a career and industry expert. List the top 20 global companies in the "${label}" industry that job seekers should target.

For each company provide honest, actionable info for job seekers. Respond in JSON only:
{
  "companies": [
    {
      "rank": 1,
      "name": "Company Name",
      "ticker": "Yahoo Finance ticker symbol only (no prefix). US stocks: MSFT AAPL NVDA. Taiwan: 2330.TW 2317.TW. Japan: 9984.T 6758.T. Korea: 005930.KS. HK: 0700.HK 9988.HK (always 4 digits with leading zero). EU: SAP.DE ASML.AS. Private companies (OpenAI, Anthropic, ByteDance): null.",
      "region": "US | TW | JP | KR | HK | EU | Global",
      "pros": ["hiring culture pro 1 in zh-TW", "pro 2", "pro 3"],
      "cons": ["hiring culture con 1 in zh-TW", "con 2"],
      "profile": "2-sentence company profile for job seekers in zh-TW",
      "trend": "1-sentence future trend / hiring outlook in zh-TW"
    }
  ]
}

Focus on: compensation, work culture, growth opportunities, job stability. Include a mix of global giants and rising companies. All text fields in zh-TW except company names and tickers.`;

  const msg = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 8192,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = (msg.content[0] as { type: string; text: string }).text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  return JSON.parse(raw.slice(start, end + 1));
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const industry = req.nextUrl.searchParams.get("industry") ?? "tech.saas";
  const forceRefresh = req.nextUrl.searchParams.get("refresh") === "1";

  // Force-refresh costs 3 tickets for free users (Pro/Max unlimited)
  if (forceRefresh) {
    const bill = await consumeUsage(session.user.id, "industryRefresh");
    if (!bill.ok) {
      return NextResponse.json({
        error: "LIMIT_REACHED",
        planTier: bill.planTier,
        tickets: bill.tickets,
        adSessionsLeft: bill.adSessionsLeft,
        ticketCost: 3,
      }, { status: 402 });
    }
  }

  try {
    // jobCount is now persisted INSIDE the IndustryCache payload (added at refresh time)
    type RawCompany = {
      name:      string;
      region?:   string;
      ticker?:   string | null;
      jobCount?: number;   // attached at refresh time via Adzuna probe
      [k: string]: unknown;
    };
    type Payload = { companies: RawCompany[] };
    let payload: Payload | undefined;
    let cached = false;

    if (!forceRefresh) {
      const row = await prisma.industryCache.findUnique({ where: { industry } });
      if (row) {
        const ageMs = Date.now() - row.updatedAt.getTime();
        if (ageMs < CACHE_TTL_DAYS * 24 * 60 * 60 * 1000) {
          payload = row.data as unknown as Payload;
          cached = true;
        }
      }
    }

    if (!payload) {
      // ── AI Top 20 generation ───────────────────────────────────────
      payload = (await generateIndustryTop(industry)) as Payload;

      // ── Adzuna fetch + ingest + count per company ──────────────────
      // We don't just probe — we fetch the actual matching rows (up to 50
      // per country), upsert them into the Job table, and use the
      // post-filtered count for the badge. This guarantees badge == modal.
      // Cost: one Adzuna query per country per company (~20-80 queries
      // per refresh, well within the 1000/month free tier).
      const enriched = await Promise.all(
        payload.companies.map(async (c) => {
          try {
            const countries = countriesForRegion(c.region);
            const rows = await probeAndIngestCompanyJobs(c.name, countries);

            // Upsert each into Job table (dedupe by externalId)
            await Promise.all(rows.map((r) =>
              prisma.job.upsert({
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
                  description: r.description,
                  salaryMin:   r.salaryMin,
                  salaryMax:   r.salaryMax,
                },
              }).catch(() => null),
            ));

            return { ...c, jobCount: rows.length };
          } catch {
            return { ...c, jobCount: 0 };
          }
        }),
      );
      payload = { ...payload, companies: enriched };

      await prisma.industryCache.upsert({
        where:  { industry },
        create: { industry, data: payload as unknown as object },
        update: { data: payload as unknown as object, updatedAt: new Date() },
      });
    }

    return NextResponse.json({ companies: payload.companies, industries: INDUSTRIES, cached });
  } catch (e) {
    console.error("[industries]", e);
    return NextResponse.json({ companies: [], industries: INDUSTRIES, error: String(e) });
  }
}
