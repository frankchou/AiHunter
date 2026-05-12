import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { INDUSTRY_TO_DATASET } from "@/lib/salary-sources/industry-mapping";
import { getSalarySnapshot } from "@/lib/salary-sources/twinkle";

// Public to all logged-in users, no AI / no billing gate. Returns the
// occupation-level salary snapshot for the requested industry (TW gov
// data via Twinkle Hub). Phase 2 will widen to country / company-type /
// experience filters.
//
// Query params:
//   industry: required, must match one of our 37 INDUSTRY ids
//   occupation: optional, filter to one occupation
//   userMonthly / userAnnual: optional, for the self-eval comparison
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const industry  = sp.get("industry") ?? "";
  const occupation = sp.get("occupation") ?? null;
  const userMonthly = sp.get("userMonthly") ? Number(sp.get("userMonthly")) : null;
  const userAnnual  = sp.get("userAnnual")  ? Number(sp.get("userAnnual"))  : null;

  const mapping = INDUSTRY_TO_DATASET[industry];
  if (mapping === undefined) {
    return NextResponse.json({ error: "Unknown industry id" }, { status: 400 });
  }
  // No gov data for this industry yet (agriculture / government).
  if (mapping === null) {
    return NextResponse.json({
      industry,
      hasData:  false,
      reason:   "本產業政府公開資料尚未開放；Phase 2 將整合海外職缺資料補上",
    });
  }

  try {
    const snapshot = await getSalarySnapshot(mapping.datasetId);

    // Industry-wide aggregates (weighted by employees so it's a real avg,
    // not an avg-of-avgs).
    const totalEmp = snapshot.rows.reduce((s, r) => s + r.employees, 0);
    const wAvgMonthly = totalEmp
      ? snapshot.rows.reduce((s, r) => s + r.monthlyTwd * r.employees, 0) / totalEmp
      : 0;
    const wAvgAnnualWan = totalEmp
      ? snapshot.rows.reduce((s, r) => s + r.annualTwdWan * r.employees, 0) / totalEmp
      : 0;

    // Optional occupation filter for self-eval.
    let selected = null as null | typeof snapshot.rows[number];
    if (occupation) {
      selected = snapshot.rows.find((r) => r.occupation === occupation) ?? null;
    }

    // Self-eval calculation. We compare against the selected occupation
    // if given, otherwise against the industry weighted average.
    let selfEval = null as null | {
      basis: "occupation" | "industry";
      againstMonthly:  number;
      againstAnnualWan: number;
      userMonthly:      number | null;
      userAnnual:       number | null;
      diffMonthlyPct:   number | null;   // (user - baseline) / baseline * 100
      diffAnnualPct:    number | null;
    };
    if (userMonthly != null || userAnnual != null) {
      const baseline = selected ?? {
        monthlyTwd:   wAvgMonthly,
        annualTwdWan: wAvgAnnualWan,
      };
      const pct = (user: number | null, base: number) =>
        user != null && base > 0 ? ((user - base) / base) * 100 : null;
      selfEval = {
        basis:           selected ? "occupation" : "industry",
        againstMonthly:  Math.round(baseline.monthlyTwd),
        againstAnnualWan: Math.round(baseline.annualTwdWan * 10) / 10,
        userMonthly,
        userAnnual,
        diffMonthlyPct:  pct(userMonthly, baseline.monthlyTwd),
        diffAnnualPct:   pct(userAnnual, baseline.annualTwdWan * 10000),  // convert 萬 to 元 for fair comparison
      };
    }

    return NextResponse.json({
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
        note:     "政府公開資料；每年 7 月更新。本資料為平均薪資，不含百分位分布。",
      },
    });
  } catch (e) {
    console.error("[/api/salary] error:", e);
    return NextResponse.json({
      error: "FETCH_FAILED",
      message: e instanceof Error ? e.message : String(e),
    }, { status: 500 });
  }
}
