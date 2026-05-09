import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export interface StockQuote {
  symbol: string;
  price: number;
  change1d: number;   // % change today
  currency: string;
}

async function fetchOne(symbol: string): Promise<StockQuote | null> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=2d`,
      { headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" } }
    );
    if (!res.ok) return null;
    const json = await res.json();
    const meta = json?.chart?.result?.[0]?.meta;
    if (!meta?.regularMarketPrice) return null;

    const price: number = meta.regularMarketPrice;
    const prev: number = meta.chartPreviousClose ?? price;
    const change1d = prev ? Math.round(((price - prev) / prev) * 10000) / 100 : 0;

    return {
      symbol,
      price: Math.round(price * 100) / 100,
      change1d,
      currency: meta.currency ?? "USD",
    };
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({}, { status: 401 });

  const raw = req.nextUrl.searchParams.get("symbols") ?? "";
  const symbols = raw.split(",").map((s) => s.trim()).filter(Boolean);
  if (symbols.length === 0) return NextResponse.json({});

  const results = await Promise.all(symbols.map(fetchOne));

  const out: Record<string, StockQuote> = {};
  for (const q of results) {
    if (q) out[q.symbol] = q;
  }

  return NextResponse.json(out, {
    headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60" },
  });
}
