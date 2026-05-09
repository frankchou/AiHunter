import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import YahooFinance from "yahoo-finance2";

const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

const TTL_MS = 24 * 60 * 60 * 1000;

export interface QuarterlyFinancials {
  ticker:           string;
  currency:         string | null;   // "USD", "TWD", "JPY", …
  period:           string;           // "Q3'25"
  endDate:          string;           // ISO date
  revenue:          number | null;
  netIncome:        number | null;
  yoyRevenuePct:    number | null;
  yoyNetIncomePct:  number | null;
  qoqRevenuePct:    number | null;
  qoqNetIncomePct:  number | null;
  isProfit:         boolean;
}

interface RawQuarter {
  endDate:   Date;
  revenue:   number | null;
  netIncome: number | null;
}

function quarterLabel(d: Date): string {
  const y = d.getUTCFullYear();
  const q = Math.floor(d.getUTCMonth() / 3) + 1;
  return `Q${q}'${String(y).slice(2)}`;
}

function pct(curr: number | null | undefined, prev: number | null | undefined): number | null {
  if (curr == null || prev == null || prev === 0) return null;
  return Math.round(((curr - prev) / Math.abs(prev)) * 1000) / 10;
}

async function fetchYahoo(ticker: string): Promise<QuarterlyFinancials | null> {
  try {
    const res = await yf.quoteSummary(ticker, {
      modules: ["incomeStatementHistoryQuarterly", "price"],
    });

    const currency = res?.price?.currency ?? null;
    const quarters = res?.incomeStatementHistoryQuarterly?.incomeStatementHistory;
    if (!quarters || quarters.length === 0) return null;

    const rows: RawQuarter[] = quarters.map((q) => ({
      endDate:   q.endDate instanceof Date ? q.endDate : new Date(q.endDate as unknown as string),
      revenue:   typeof q.totalRevenue === "number" ? q.totalRevenue : null,
      netIncome: typeof q.netIncome    === "number" ? q.netIncome    : null,
    }));

    const latest      = rows[0];
    const prevQuarter = rows[1];
    const yearAgo     = rows[3];   // 4 quarters back

    return {
      ticker,
      currency,
      period:           quarterLabel(latest.endDate),
      endDate:          latest.endDate.toISOString().slice(0, 10),
      revenue:          latest.revenue,
      netIncome:        latest.netIncome,
      yoyRevenuePct:    pct(latest.revenue,   yearAgo?.revenue),
      yoyNetIncomePct:  pct(latest.netIncome, yearAgo?.netIncome),
      qoqRevenuePct:    pct(latest.revenue,   prevQuarter?.revenue),
      qoqNetIncomePct:  pct(latest.netIncome, prevQuarter?.netIncome),
      isProfit:         (latest.netIncome ?? 0) >= 0,
    };
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const symbols = (req.nextUrl.searchParams.get("symbols") ?? "")
    .split(",").map((s) => s.trim()).filter(Boolean);
  if (symbols.length === 0) return NextResponse.json({});

  const cached = await prisma.financialsCache.findMany({ where: { ticker: { in: symbols } } });
  const cacheMap = new Map(cached.map((c) => [c.ticker, c]));

  const out: Record<string, QuarterlyFinancials> = {};
  const toFetch: string[] = [];
  for (const sym of symbols) {
    const c = cacheMap.get(sym);
    if (c && Date.now() - c.updatedAt.getTime() < TTL_MS) {
      out[sym] = c.data as unknown as QuarterlyFinancials;
    } else {
      toFetch.push(sym);
    }
  }

  if (toFetch.length) {
    const fresh = await Promise.all(toFetch.map(fetchYahoo));
    await Promise.all(
      fresh.map(async (data, i) => {
        const ticker = toFetch[i];
        if (!data) return;
        out[ticker] = data;
        try {
          await prisma.financialsCache.upsert({
            where:  { ticker },
            create: { ticker, data: data as unknown as object },
            update: { data: data as unknown as object, updatedAt: new Date() },
          });
        } catch { /* best-effort */ }
      })
    );
  }

  return NextResponse.json(out);
}
