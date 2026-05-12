import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { INDUSTRY_TO_DATASET } from "@/lib/salary-sources/industry-mapping";
import { getSalarySnapshot } from "@/lib/salary-sources/twinkle";
import {
  fetchAdzunaSalaryRows,
  COUNTRY_TO_ADZUNA,
} from "@/lib/salary-sources/adzuna-aggregate";

// Public to all logged-in users; no AI / no billing gate.
//
// API surface is intentionally narrow: pick (country, industry), get
// rows back. All client-facing filtering (companyType / experience /
// title / self-eval) is computed in the browser on the returned rows.
// This keeps fetch frequency low (only re-fetches when country or
// industry changes) and removes the "flickering on every keystroke"
// class of bugs that an over-eager URL-driven SWR cache produces.

const NO_DATA_COUNTRIES = new Set(["JP", "KR", "CN"]);

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const industry = sp.get("industry") ?? "";
  const country  = (sp.get("country") ?? "TW").toUpperCase();

  if (!industry) {
    return NextResponse.json({ error: "MISSING_INDUSTRY", message: "industry is required" }, { status: 400 });
  }

  if (NO_DATA_COUNTRIES.has(country)) {
    return NextResponse.json({
      industry,
      country,
      hasData: false,
      reason:  `${country} 區職缺資料尚未開放（Adzuna 不涵蓋；後續會接入其他來源）`,
    });
  }

  // ── TW: gov data path (Twinkle Hub → 勞動部) ───────────────────────────
  if (country === "TW") {
    const mapping = INDUSTRY_TO_DATASET[industry];
    if (mapping === undefined) {
      return NextResponse.json({ error: "Unknown industry id" }, { status: 400 });
    }
    if (mapping === null) {
      return NextResponse.json({
        industry,
        country,
        hasData: false,
        reason:  "本產業政府公開資料尚未開放（agriculture / government）",
      });
    }
    try {
      const snapshot = await getSalarySnapshot(mapping.datasetId);
      const totalEmp = snapshot.rows.reduce((s, r) => s + r.employees, 0);
      const wAvgMonthly = totalEmp
        ? snapshot.rows.reduce((s, r) => s + r.monthlyTwd * r.employees, 0) / totalEmp
        : 0;
      const wAvgAnnualWan = totalEmp
        ? snapshot.rows.reduce((s, r) => s + r.annualTwdWan * r.employees, 0) / totalEmp
        : 0;

      return NextResponse.json({
        country,
        mode:    "tw_gov",
        industry,
        datasetId:   mapping.datasetId,
        govName:     mapping.govName,
        year:        snapshot.year,
        hasData:     true,
        summary: {
          totalEmployees:    totalEmp,
          weightedMonthly:   Math.round(wAvgMonthly),
          weightedAnnualWan: Math.round(wAvgAnnualWan * 10) / 10,
          occupationCount:   snapshot.rows.length,
        },
        rows:    snapshot.rows,
        source: {
          provider: "Twinkle Hub",
          agency:   "勞動部",
          note:     "政府公開資料；每年 7 月更新。本資料為平均薪資，不含百分位分布；無法以企業類型 / 年資 / 國家進一步分群（這些維度政府資料未提供）。",
        },
      });
    } catch (e) {
      console.error("[/api/salary TW] error:", e);
      return NextResponse.json({
        error: "FETCH_FAILED",
        message: e instanceof Error ? e.message : String(e),
      }, { status: 500 });
    }
  }

  // ── Foreign country: ship raw rows + classification for client filter.
  if (!Object.keys(COUNTRY_TO_ADZUNA).includes(country)) {
    return NextResponse.json({ error: "Unsupported country" }, { status: 400 });
  }

  try {
    const rows = await fetchAdzunaSalaryRows(country as keyof typeof COUNTRY_TO_ADZUNA, industry);
    return NextResponse.json({
      country,
      mode:    "adzuna",
      industry,
      hasData: rows.length > 0,
      rows,
      source: {
        provider: "Adzuna",
        agency:   "Adzuna 職缺平台",
        note:     "資料為職缺公告中的薪資範圍（雇主開出的價碼，非員工實際所得）。已換算為 TWD。年資為職缺要求年資，可能與實際工作年資有落差。",
      },
      reason: rows.length === 0
        ? "此產業 × 此國家目前無 Adzuna 樣本；嘗試其他產業或國家。"
        : undefined,
    });
  } catch (e) {
    console.error("[/api/salary foreign] error:", e);
    return NextResponse.json({
      error: "FETCH_FAILED",
      message: e instanceof Error ? e.message : String(e),
    }, { status: 500 });
  }
}
