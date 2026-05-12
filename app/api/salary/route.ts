import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { INDUSTRY_TO_DATASET } from "@/lib/salary-sources/industry-mapping";
import { getSalarySnapshot } from "@/lib/salary-sources/twinkle";
import {
  aggregateAdzunaSalary,
  COUNTRY_TO_ADZUNA,
  EXPERIENCE_BUCKETS,
} from "@/lib/salary-sources/adzuna-aggregate";
import { ALL_COMPANY_TYPES, COMPANY_TYPES } from "@/lib/salary-sources/company-types";

// Public to all logged-in users; no AI / no billing gate.
//
//   industry:     internal id from INDUSTRIES (e.g. "ai", "tech.saas")
//   country:      TW (default) — gov data via Twinkle.
//                 US/UK/AU/EU — Adzuna aggregation.
//                 JP/KR/CN — explicit "no data" response.
//   companyType:  one of the 6 buckets (Adzuna only; ignored when country=TW).
//   experience:   one of EXPERIENCE_BUCKETS keys (Adzuna only).
//   occupation:   used for the TW path only to pick a row.
//   userMonthly / userAnnual: self-eval inputs.

const NO_DATA_COUNTRIES = new Set(["JP", "KR", "CN"]);

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const industry    = sp.get("industry") ?? "";
  const country     = (sp.get("country") ?? "TW").toUpperCase();
  const companyType = sp.get("companyType");
  const experience  = sp.get("experience");
  const occupation  = sp.get("occupation");
  const userMonthly = sp.get("userMonthly") ? Number(sp.get("userMonthly")) : null;
  const userAnnual  = sp.get("userAnnual")  ? Number(sp.get("userAnnual"))  : null;

  if (NO_DATA_COUNTRIES.has(country)) {
    return NextResponse.json({
      industry,
      country,
      hasData: false,
      reason:  `${country} 區職缺資料尚未開放（Adzuna 不涵蓋；後續會接入其他來源）`,
    });
  }

  // ── TW: gov data path (Phase 1 + extra company-type/experience metadata
  //        Adzuna can layer on top if user asks for them) ───────────────
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
      const selected = occupation ? snapshot.rows.find((r) => r.occupation === occupation) ?? null : null;

      let selfEval = null as null | {
        basis: "occupation" | "industry";
        againstMonthly:  number;
        againstAnnualWan: number;
        userMonthly:      number | null;
        userAnnual:       number | null;
        diffMonthlyPct:   number | null;
        diffAnnualPct:    number | null;
      };
      if (userMonthly != null || userAnnual != null) {
        const baseline = selected ?? { monthlyTwd: wAvgMonthly, annualTwdWan: wAvgAnnualWan };
        const pct = (u: number | null, b: number) => u != null && b > 0 ? ((u - b) / b) * 100 : null;
        selfEval = {
          basis:            selected ? "occupation" : "industry",
          againstMonthly:   Math.round(baseline.monthlyTwd),
          againstAnnualWan: Math.round(baseline.annualTwdWan * 10) / 10,
          userMonthly,
          userAnnual,
          diffMonthlyPct:   pct(userMonthly, baseline.monthlyTwd),
          diffAnnualPct:    pct(userAnnual, baseline.annualTwdWan * 10000),
        };
      }

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
        selected,
        selfEval,
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

  // ── Foreign country: Adzuna aggregation path ─────────────────────────
  if (!Object.keys(COUNTRY_TO_ADZUNA).includes(country)) {
    return NextResponse.json({ error: "Unsupported country" }, { status: 400 });
  }
  if (companyType && !ALL_COMPANY_TYPES.includes(companyType as never)) {
    return NextResponse.json({ error: "Unknown companyType" }, { status: 400 });
  }
  if (experience && !(experience in EXPERIENCE_BUCKETS)) {
    return NextResponse.json({ error: "Unknown experience bucket" }, { status: 400 });
  }

  try {
    const result = await aggregateAdzunaSalary({
      industry:    industry || undefined,
      country:     country as keyof typeof COUNTRY_TO_ADZUNA,
      companyType: companyType as never,
      experience:  experience as never,
    });

    // Self-eval against P50 (median) when foreign data is present.
    let selfEval = null as null | {
      basis: "median";
      againstAnnualTwd: number;
      againstMonthlyTwd: number;
      userMonthly: number | null;
      userAnnual:  number | null;
      diffMonthlyPct: number | null;
      diffAnnualPct:  number | null;
      percentile: number | null;
    };
    if ((userMonthly != null || userAnnual != null) && result.p50Annual != null) {
      const annualUser = userAnnual != null ? userAnnual : userMonthly! * 12;
      const med = result.p50Annual;
      const pct = (a: number, b: number) => b > 0 ? ((a - b) / b) * 100 : null;
      // Crude percentile estimate from the 3 anchor points
      let perc: number | null = null;
      if (result.p25Annual != null && result.p75Annual != null) {
        if      (annualUser <= result.p25Annual) perc = 25 * (annualUser / result.p25Annual);
        else if (annualUser <= result.p50Annual) perc = 25 + 25 * ((annualUser - result.p25Annual) / (result.p50Annual - result.p25Annual));
        else if (annualUser <= result.p75Annual) perc = 50 + 25 * ((annualUser - result.p50Annual) / (result.p75Annual - result.p50Annual));
        else                                     perc = 75 + 25 * Math.min(1, (annualUser - result.p75Annual) / (result.p75Annual * 0.5));
        perc = Math.max(0, Math.min(100, perc));
      }
      selfEval = {
        basis: "median",
        againstAnnualTwd:  med,
        againstMonthlyTwd: Math.round(med / 12),
        userMonthly,
        userAnnual,
        diffMonthlyPct: userMonthly != null ? pct(userMonthly, med / 12) : null,
        diffAnnualPct:  userAnnual  != null ? pct(userAnnual,  med)      : null,
        percentile:     perc == null ? null : Math.round(perc),
      };
    }

    return NextResponse.json({
      country,
      mode:        "adzuna",
      industry:    industry || null,
      companyType: companyType ?? null,
      companyTypeLabel: companyType ? COMPANY_TYPES[companyType as keyof typeof COMPANY_TYPES] : null,
      experience:  experience ?? null,
      experienceLabel: experience ? EXPERIENCE_BUCKETS[experience].label : null,
      hasData:     result.sampleSize > 0,
      summary:     result.sampleSize > 0 ? {
        sampleSize:    result.sampleSize,
        p25Annual:     result.p25Annual,
        p50Annual:     result.p50Annual,
        p75Annual:     result.p75Annual,
        meanAnnual:    result.meanAnnual,
        p25Monthly:    result.monthlyFromAnnual(result.p25Annual),
        p50Monthly:    result.monthlyFromAnnual(result.p50Annual),
        p75Monthly:    result.monthlyFromAnnual(result.p75Annual),
        meanMonthly:   result.monthlyFromAnnual(result.meanAnnual),
      } : null,
      selfEval,
      source: {
        provider: "Adzuna",
        agency:   "Adzuna 職缺平台",
        note:     "資料為職缺公告中的薪資範圍（雇主開出的價碼，非員工實際所得）。已換算為 TWD。年資為職缺要求年資，可能與實際工作年資有落差。",
      },
      reason: result.sampleSize === 0
        ? "符合此條件的職缺樣本數為 0；嘗試放寬篩選（移除企業類型或年資）。"
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
