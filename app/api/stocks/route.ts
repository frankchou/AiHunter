import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export interface StockQuote {
  symbol: string;
  price: number;
  change1d: number;   // % change today
  currency: string;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({}, { status: 401 });

  const raw = req.nextUrl.searchParams.get("symbols") ?? "";
  const symbols = raw.split(",").map((s) => s.trim()).filter(Boolean);
  if (symbols.length === 0) return NextResponse.json({});

  try {
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols.join(",")}&fields=regularMarketPrice,regularMarketChangePercent,currency`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
        "Accept": "application/json",
      },
      next: { revalidate: 300 }, // 5-min cache
    });

    if (!res.ok) return NextResponse.json({});
    const json = await res.json();
    const quotes = (json?.quoteResponse?.result ?? []) as Array<{
      symbol: string;
      regularMarketPrice?: number;
      regularMarketChangePercent?: number;
      currency?: string;
    }>;

    const result: Record<string, StockQuote> = {};
    for (const q of quotes) {
      if (q.regularMarketPrice != null) {
        result[q.symbol] = {
          symbol: q.symbol,
          price: Math.round(q.regularMarketPrice * 100) / 100,
          change1d: Math.round((q.regularMarketChangePercent ?? 0) * 100) / 100,
          currency: q.currency ?? "USD",
        };
      }
    }
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({});
  }
}
