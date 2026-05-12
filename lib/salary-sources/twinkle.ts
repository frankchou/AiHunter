// Twinkle Hub MCP client + normalised salary access for our /api/salary
// endpoint. Wraps the JSON-RPC envelope and Twinkle's SSE-or-JSON quirk,
// reads from SalaryCache when possible.

import { prisma } from "@/lib/prisma";

const MCP_URL = process.env.TWINKLE_MCP_URL;
const API_KEY = process.env.TWINKLE_API_KEY;
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;  // 7 days; gov data is yearly

export interface SalaryRow {
  occupation:     string;   // 職類別 e.g. "電機、電子工程師"
  employees:      number;   // 7月底受僱員工人數 — sample size
  monthlyTwd:     number;   // 每月經常性薪資 in NT$
  annualTwdWan:   number;   // 全年薪資所得 in 萬 NT$
}

export interface SalaryDatasetSnapshot {
  datasetId: string;
  year:      string;
  rows:      SalaryRow[];
  cachedAt:  Date;
}

// ─── Low-level MCP / JSON-RPC client ─────────────────────────────────────────
let rpcId = 0;
async function callTool<T = unknown>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  if (!MCP_URL || !API_KEY) {
    throw new Error("TWINKLE_MCP_URL or TWINKLE_API_KEY not configured");
  }
  const r = await fetch(MCP_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${API_KEY}`,
      "Content-Type":  "application/json",
      // Twinkle picks between application/json and text/event-stream based
      // on this Accept header — we handle both below.
      "Accept":        "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id:      ++rpcId,
      method:  "tools/call",
      params:  { name, arguments: args },
    }),
  });
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new Error(`Twinkle HTTP ${r.status}: ${txt.slice(0, 400)}`);
  }
  const ct = r.headers.get("content-type") || "";
  let parsed: { error?: unknown; result?: { content?: Array<{ type: string; text?: string }> } };
  if (ct.includes("event-stream")) {
    const raw = await r.text();
    const dataLine = raw.split("\n").find((l) => l.startsWith("data:"));
    if (!dataLine) throw new Error("Twinkle SSE response had no data line");
    parsed = JSON.parse(dataLine.slice(5).trim());
  } else {
    parsed = await r.json();
  }
  if (parsed.error) throw new Error(`Twinkle RPC error: ${JSON.stringify(parsed.error)}`);
  const first = parsed.result?.content?.[0];
  if (first?.type === "text" && typeof first.text === "string") {
    try { return JSON.parse(first.text) as T; } catch { return first.text as unknown as T; }
  }
  return parsed.result as unknown as T;
}

// ─── Public API ──────────────────────────────────────────────────────────────

// MOL 41xxx series share this column shape. Indices kept here so we can map
// the raw row arrays Twinkle returns to typed objects in one place.
const COLS = {
  year:        "年度",
  occupation:  "職類別",
  industry:    "行業別",
  employees:   "7月底受僱員工人數",
  monthlySal:  "7月經常性薪資（金額元）",
  // The annual column name encodes the year (e.g. "112年..." for ROC year),
  // so we'll match by *substring* not exact equality.
  annualMatch: "全年薪資所得",
};

function toNum(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  const cleaned = v.replace(/,/g, "").trim();
  if (!cleaned || cleaned === "-" || cleaned === "---") return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

// Fetch the full salary snapshot for one industry dataset. Uses SalaryCache
// for repeat reads (TTL 7d).
export async function getSalarySnapshot(datasetId: string): Promise<SalaryDatasetSnapshot> {
  // Look for any cached snapshot — we don't yet know which year is "latest"
  // until Twinkle responds, so we read by datasetId and check freshness.
  const cached = await prisma.salaryCache.findFirst({
    where: { datasetId },
    orderBy: { year: "desc" },
  });
  if (cached && Date.now() - cached.fetchedAt.getTime() < CACHE_TTL_MS) {
    return {
      datasetId,
      year:     cached.year,
      rows:     cached.data as unknown as SalaryRow[],
      cachedAt: cached.fetchedAt,
    };
  }

  // Pull from Twinkle. limit=500 is more than enough — biggest dataset
  // (製造業) has ~80 occupation rows per year.
  type QueryRowsResp = { columns: string[]; rows: (string | number | null)[][] };
  const resp = await callTool<QueryRowsResp>("opendata-query_rows", {
    dataset_id: datasetId,
    limit:      500,
  });

  const cols = resp.columns;
  const idx = (name: string) => cols.indexOf(name);
  const yearIdx       = idx(COLS.year);
  const occupationIdx = idx(COLS.occupation);
  const employeesIdx  = idx(COLS.employees);
  const monthlyIdx    = idx(COLS.monthlySal);
  const annualIdx     = cols.findIndex((c) => c.includes(COLS.annualMatch));

  if (yearIdx < 0 || occupationIdx < 0 || employeesIdx < 0 || monthlyIdx < 0 || annualIdx < 0) {
    throw new Error(`Twinkle dataset ${datasetId} returned unexpected columns: ${JSON.stringify(cols)}`);
  }

  // Take the latest year only — the dataset includes historical years.
  const latestYear = resp.rows
    .map((r) => String(r[yearIdx] ?? ""))
    .filter(Boolean)
    .sort()
    .pop() ?? "unknown";

  // Some industry datasets (e.g. 製造業) include per-sub-industry rows
  // (電子業、紡織業、食品業…) on top of the rolled-up industry total.
  // To avoid showing the same occupation many times we aggregate by
  // 職類別 with an employee-weighted average across all sub-industries.
  const raw = resp.rows
    .filter((r) => String(r[yearIdx]) === latestYear)
    .map((r) => ({
      occupation:   String(r[occupationIdx] ?? ""),
      employees:    toNum(r[employeesIdx] as string),
      monthlyTwd:   toNum(r[monthlyIdx]   as string),
      annualTwdWan: toNum(r[annualIdx]    as string),
    }))
    .filter((row) => row.occupation && (row.monthlyTwd > 0 || row.annualTwdWan > 0));

  const byOcc = new Map<string, { emp: number; mSum: number; aSum: number }>();
  for (const r of raw) {
    const cur = byOcc.get(r.occupation) ?? { emp: 0, mSum: 0, aSum: 0 };
    cur.emp  += r.employees;
    cur.mSum += r.monthlyTwd  * r.employees;
    cur.aSum += r.annualTwdWan * r.employees;
    byOcc.set(r.occupation, cur);
  }
  const rows: SalaryRow[] = [...byOcc.entries()]
    .filter(([, v]) => v.emp > 0)
    .map(([occupation, v]) => ({
      occupation,
      employees:    v.emp,
      monthlyTwd:   Math.round(v.mSum / v.emp),
      annualTwdWan: Math.round((v.aSum / v.emp) * 10) / 10,
    }));

  // Upsert into cache.
  await prisma.salaryCache.upsert({
    where: { datasetId_year: { datasetId, year: latestYear } },
    create: {
      datasetId,
      year:     latestYear,
      data:     rows as unknown as object,
    },
    update: {
      data:      rows as unknown as object,
      fetchedAt: new Date(),
    },
  });

  return {
    datasetId,
    year:     latestYear,
    rows,
    cachedAt: new Date(),
  };
}
