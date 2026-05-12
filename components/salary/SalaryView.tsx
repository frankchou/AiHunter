"use client";
import { useState, useMemo } from "react";
import useSWR from "swr";
import { INDUSTRIES } from "@/lib/mock-data";

// ─── Response shapes ────────────────────────────────────────────────────────

interface TwGovRow {
  occupation:    string;
  employees:     number;
  monthlyTwd:    number;
  annualTwdWan:  number;
}
interface TwSummary {
  totalEmployees:    number;
  weightedMonthly:   number;
  weightedAnnualWan: number;
  occupationCount:   number;
}
interface AdzunaJobRow {
  salaryAnnualTwd: number;
  companyType:     string | null;     // pre-classified by server
  yearsMin:        number | null;
  yearsMax:        number | null;
  title:           string;
}
interface SalarySource { provider: string; agency: string; note: string }

interface SalaryResponse {
  industry?:  string;
  country?:   string;
  hasData:    boolean;
  reason?:    string;
  source?:    SalarySource;
  mode?:      "tw_gov" | "adzuna";
  // tw_gov
  datasetId?: string;
  govName?:   string;
  year?:      string;
  summary?:   TwSummary;
  rows?:      TwGovRow[] | AdzunaJobRow[];
}

interface ComputedSummary {
  sampleSize:  number;
  p25Annual:   number | null;
  p50Annual:   number | null;
  p75Annual:   number | null;
  meanAnnual:  number | null;
}

interface ForeignSelfEval {
  basis:             "median";
  againstAnnualTwd:  number;
  againstMonthlyTwd: number;
  userMonthly:       number | null;
  userAnnual:        number | null;
  diffMonthlyPct:    number | null;
  diffAnnualPct:     number | null;
  percentile:        number | null;
}
interface TwSelfEval {
  basis:            "occupation" | "industry";
  againstMonthly:   number;
  againstAnnualWan: number;
  userMonthly:      number | null;
  userAnnual:       number | null;
  diffMonthlyPct:   number | null;
  diffAnnualPct:    number | null;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const COUNTRIES: { code: string; label: string; mode: "tw_gov" | "adzuna" | "disabled" }[] = [
  { code: "TW", label: "台灣",                        mode: "tw_gov" },
  { code: "US", label: "美國",                        mode: "adzuna" },
  { code: "UK", label: "英國",                        mode: "adzuna" },
  { code: "AU", label: "澳洲",                        mode: "adzuna" },
  { code: "EU", label: "歐洲（德/法/荷/西/義/波）",       mode: "adzuna" },
  { code: "JP", label: "日本",                        mode: "disabled" },
  { code: "KR", label: "韓國",                        mode: "disabled" },
  { code: "CN", label: "中國",                        mode: "disabled" },
];

const COMPANY_TYPE_BASE = [
  { value: "",                    label: "不分企業類型" },
  { value: "foreign_tier1",       label: "Tier-1 外商" },
  { value: "foreign_traditional", label: "傳統外商" },
  { value: "tw_local",            label: "台商" },
  { value: "large_enterprise",    label: "大企業（其他）" },
  { value: "sme",                 label: "中小企業" },
  { value: "startup",             label: "新創" },
];
function companyTypeOptions(country: string) {
  // TW: hide 外商；Foreign: hide 台商。
  if (country === "TW") {
    return COMPANY_TYPE_BASE.filter((o) =>
      !["foreign_tier1", "foreign_traditional"].includes(o.value)
    );
  }
  return COMPANY_TYPE_BASE.filter((o) => o.value !== "tw_local");
}

// Local currency per country (foreign modes only). EU defaults to EUR
// even though our EU bucket now includes GB; users wanting GBP can pick
// the standalone UK chip.
const LOCAL_CURRENCY: Record<string, string> = {
  US: "USD", UK: "GBP", AU: "AUD", EU: "EUR",
};
// Match the rates baked into lib/salary-sources/adzuna-aggregate.ts so
// client-side conversion is consistent with the server's per-job FX.
const FX_TO_TWD: Record<string, number> = {
  TWD: 1, USD: 32, GBP: 40.5, EUR: 35, AUD: 21,
};

const EXPERIENCE_BUCKETS: Record<string, { label: string; min: number; max: number }> = {
  exp_0:    { label: "0 年（應屆）",   min: 0,  max: 0  },
  exp_1_3:  { label: "1-3 年",        min: 1,  max: 3  },
  exp_3_7:  { label: "3-7 年",        min: 3,  max: 7  },
  exp_7_10: { label: "7-10 年",       min: 7,  max: 10 },
  exp_10p:  { label: "10+ 年",        min: 10, max: 99 },
};
const EXPERIENCE_OPTIONS = [
  { value: "",         label: "不分年資" },
  ...Object.entries(EXPERIENCE_BUCKETS).map(([value, b]) => ({ value, label: b.label })),
];

function fmtTwd(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n) || n <= 0) return "—";
  if (n >= 10000) return `${(n / 10000).toFixed(1).replace(/\.0$/, "")} 萬`;
  return n.toLocaleString("zh-TW");
}

function percentile(sortedAsc: number[], p: number): number {
  if (!sortedAsc.length) return 0;
  const idx = (sortedAsc.length - 1) * p;
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  if (lo === hi) return sortedAsc[lo];
  return sortedAsc[lo] + (sortedAsc[hi] - sortedAsc[lo]) * (idx - lo);
}

export function SalaryView() {
  const [country, setCountry] = useState<string>("TW");
  const [selectedIndustry, setSelectedIndustry] = useState<string | null>(null);
  const [selectedOccupation, setSelectedOccupation] = useState<string | null>(null);
  const [companyType, setCompanyType] = useState<string>("");
  const [experience, setExperience]   = useState<string>("");
  const [titleQuery, setTitleQuery]   = useState<string>("");
  const [userMonthlyInput, setUserMonthlyInput] = useState("");
  const [userAnnualInput, setUserAnnualInput]   = useState("");
  const [inputCurrency, setInputCurrency]       = useState<string>("TWD");

  const isForeign  = country !== "TW";
  const isDisabled = ["JP", "KR", "CN"].includes(country);

  function switchCountry(next: string) {
    setCountry(next);
    setSelectedOccupation(null);
    if (next !== "TW" && companyType === "tw_local") setCompanyType("");
    if (next === "TW" && ["foreign_tier1", "foreign_traditional"].includes(companyType)) {
      setCompanyType("");
    }
    // Currency follows country: TW always TWD; foreign keeps TWD until
    // the user explicitly picks the local one.
    if (next === "TW") setInputCurrency("TWD");
    // If user was viewing US with USD and switches to UK, reset to TWD
    // so the unit label doesn't lie.
    if (inputCurrency !== "TWD" && inputCurrency !== LOCAL_CURRENCY[next]) {
      setInputCurrency("TWD");
    }
  }

  // URL only depends on (country, industry, [occupation for TW]).
  // All other filters (companyType / experience / title) are client-side.
  const apiUrl = useMemo(() => {
    if (isDisabled) return null;
    if (!selectedIndustry) return null;
    const params = new URLSearchParams({ country, industry: selectedIndustry });
    if (!isForeign && selectedOccupation) params.set("occupation", selectedOccupation);
    return `/api/salary?${params.toString()}`;
  }, [country, isForeign, isDisabled, selectedIndustry, selectedOccupation]);

  const { data, isLoading } = useSWR<SalaryResponse>(apiUrl, fetcher, {
    revalidateOnFocus: false,
    keepPreviousData:  true,
  });

  const industryName = selectedIndustry
    ? INDUSTRIES.find((i) => i.id === selectedIndustry)?.name
    : null;

  // ── Adzuna client-side filtering + summary ──────────────────────────
  const adzunaFiltered = useMemo<AdzunaJobRow[]>(() => {
    if (data?.mode !== "adzuna" || !data.rows) return [];
    const rows = data.rows as AdzunaJobRow[];
    const tq = titleQuery.trim().toLowerCase();
    const expBucket = experience ? EXPERIENCE_BUCKETS[experience] : null;
    return rows.filter((r) => {
      if (companyType && r.companyType !== companyType) return false;
      if (tq && !r.title.toLowerCase().includes(tq)) return false;
      if (expBucket) {
        // Job spans [yearsMin, yearsMax]; bucket spans [min, max].
        // Overlap iff yearsMin <= bucket.max AND yearsMax >= bucket.min.
        // Nulls match anything.
        const ymin = r.yearsMin ?? 0;
        const ymax = r.yearsMax ?? 99;
        if (ymin > expBucket.max || ymax < expBucket.min) return false;
      }
      return true;
    });
  }, [data, companyType, experience, titleQuery]);

  const adzunaSummary = useMemo<ComputedSummary | null>(() => {
    if (data?.mode !== "adzuna") return null;
    if (adzunaFiltered.length === 0) {
      return { sampleSize: 0, p25Annual: null, p50Annual: null, p75Annual: null, meanAnnual: null };
    }
    const sorted = adzunaFiltered.map((r) => r.salaryAnnualTwd).sort((a, b) => a - b);
    const mean = sorted.reduce((s, x) => s + x, 0) / sorted.length;
    return {
      sampleSize: sorted.length,
      p25Annual:  Math.round(percentile(sorted, 0.25)),
      p50Annual:  Math.round(percentile(sorted, 0.50)),
      p75Annual:  Math.round(percentile(sorted, 0.75)),
      meanAnnual: Math.round(mean),
    };
  }, [data, adzunaFiltered]);

  // TW rows filtered by title (occupation 名稱 contains)
  const twFilteredRows = useMemo<TwGovRow[]>(() => {
    if (data?.mode !== "tw_gov" || !data.rows) return [];
    const rows = data.rows as TwGovRow[];
    const tq = titleQuery.trim().toLowerCase();
    return tq ? rows.filter((r) => r.occupation.toLowerCase().includes(tq)) : rows;
  }, [data, titleQuery]);

  // ── Self-eval (client-side, always derived from current state) ──────
  const localSelfEval = useMemo<TwSelfEval | ForeignSelfEval | null>(() => {
    if (!data?.hasData) return null;
    const um = userMonthlyInput ? Number(userMonthlyInput) : NaN;
    const ua = userAnnualInput   ? Number(userAnnualInput)  : NaN;
    const userMonthly = Number.isFinite(um) && um > 0 ? um : null;

    if (data.mode === "tw_gov" && data.summary) {
      const summary = data.summary as TwSummary;
      const userAnnualEl = Number.isFinite(ua) && ua > 0 ? ua * 10000 : null;
      if (userMonthly == null && userAnnualEl == null) return null;
      const sel = selectedOccupation
        ? (data.rows as TwGovRow[]).find((r) => r.occupation === selectedOccupation) ?? null
        : null;
      const baseMonthly  = sel ? sel.monthlyTwd        : summary.weightedMonthly;
      const baseAnnualEl = sel ? sel.annualTwdWan * 10000 : summary.weightedAnnualWan * 10000;
      const pct = (u: number | null, b: number) => u != null && b > 0 ? ((u - b) / b) * 100 : null;
      return {
        basis:            sel ? "occupation" : "industry",
        againstMonthly:   Math.round(baseMonthly),
        againstAnnualWan: Math.round((baseAnnualEl / 10000) * 10) / 10,
        userMonthly,
        userAnnual:       userAnnualEl,
        diffMonthlyPct:   pct(userMonthly, baseMonthly),
        diffAnnualPct:    pct(userAnnualEl, baseAnnualEl),
      };
    }

    if (data.mode === "adzuna" && adzunaSummary) {
      // For foreign mode, user may input in TWD or the country's local
      // currency. Convert both to TWD for comparison against the (already
      // TWD-normalised) p50.
      const fx = FX_TO_TWD[inputCurrency] ?? 1;
      // If input currency is TWD: 年薪 input is in 萬, multiply by 10000.
      // If input is foreign: 年薪 input is in that currency directly (no 萬).
      const annualMul = inputCurrency === "TWD" ? 10000 : 1;
      const userMonthlyTwd = userMonthly != null ? userMonthly * fx : null;
      const userAnnualTwd  = Number.isFinite(ua) && ua > 0 ? ua * annualMul * fx : null;
      if (userMonthlyTwd == null && userAnnualTwd == null) return null;
      if (adzunaSummary.p50Annual == null) return null;
      const annualUser = userAnnualTwd ?? (userMonthlyTwd! * 12);
      const p25 = adzunaSummary.p25Annual, p50 = adzunaSummary.p50Annual, p75 = adzunaSummary.p75Annual;
      let perc: number | null = null;
      if (p25 != null && p75 != null && p50 != null) {
        if      (annualUser <= p25) perc = 25 * (annualUser / p25);
        else if (annualUser <= p50) perc = 25 + 25 * ((annualUser - p25) / (p50 - p25));
        else if (annualUser <= p75) perc = 50 + 25 * ((annualUser - p50) / (p75 - p50));
        else                        perc = 75 + 25 * Math.min(1, (annualUser - p75) / (p75 * 0.5));
        perc = Math.max(0, Math.min(100, perc));
      }
      const pct = (a: number, b: number) => b > 0 ? ((a - b) / b) * 100 : null;
      return {
        basis: "median",
        againstAnnualTwd:  p50,
        againstMonthlyTwd: Math.round(p50 / 12),
        userMonthly:       userMonthlyTwd,
        userAnnual:        userAnnualTwd,
        diffMonthlyPct:    userMonthlyTwd != null ? pct(userMonthlyTwd, p50 / 12) : null,
        diffAnnualPct:     userAnnualTwd  != null ? pct(userAnnualTwd,  p50)      : null,
        percentile:        perc == null ? null : Math.round(perc),
      };
    }

    return null;
  }, [data, adzunaSummary, userMonthlyInput, userAnnualInput, selectedOccupation]);

  // TW gov data doesn't have company-type or experience info, so those
  // two filters can't do anything in TW. Keep the UI visible (parity)
  // but disable them with a tooltip.
  const twFilterDisabled = !isForeign;
  const twFilterDisabledHint = "TW 政府公開資料無此維度，篩選器暫時無效";

  return (
    <div className="app-content">
      <div className="section-h">
        <h3>薪資查詢</h3>
        <span className="sub">
          台灣：政府公開資料（勞動部 / 主計總處，每年 7 月更新） · 海外：Adzuna 職缺平台公告薪資
        </span>
      </div>

      {/* Country chips */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: "var(--ink-3)", marginBottom: 6, letterSpacing: ".05em" }}>
          資料來源國家
        </div>
        <div className="chips">
          {COUNTRIES.map((c) => {
            const disabled = c.mode === "disabled";
            const active   = country === c.code;
            return (
              <span
                key={c.code}
                className={`chip${active ? " active" : ""}`}
                onClick={() => switchCountry(c.code)}
                style={disabled ? { opacity: 0.5, fontStyle: "italic" } : undefined}
                title={disabled ? "該國資料尚未開放" : c.label}
              >
                {c.label}{disabled ? " · 灰" : ""}
              </span>
            );
          })}
        </div>
      </div>

      {/* Filters bar — same UI for both modes; TW disables companyType + experience */}
      {!isDisabled && (
        <div style={{
          display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12, fontSize: 12, color: "var(--ink-2)",
          alignItems: "center",
        }}>
          <label title={twFilterDisabled ? twFilterDisabledHint : undefined}>
            企業類型{" "}
            <select
              value={companyType}
              onChange={(e) => setCompanyType(e.target.value)}
              disabled={twFilterDisabled}
              style={{ ...selectStyle, opacity: twFilterDisabled ? 0.5 : 1, cursor: twFilterDisabled ? "not-allowed" : "pointer" }}
            >
              {companyTypeOptions(country).map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
          <label title={twFilterDisabled ? twFilterDisabledHint : undefined}>
            年資{" "}
            <select
              value={experience}
              onChange={(e) => setExperience(e.target.value)}
              disabled={twFilterDisabled}
              style={{ ...selectStyle, opacity: twFilterDisabled ? 0.5 : 1, cursor: twFilterDisabled ? "not-allowed" : "pointer" }}
            >
              {EXPERIENCE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
          <label>
            職位搜尋{" "}
            <input
              type="text"
              value={titleQuery}
              onChange={(e) => setTitleQuery(e.target.value)}
              placeholder={isForeign ? "e.g. Software Engineer" : "e.g. 工程師、品管"}
              style={{ ...selectStyle, width: 200 }}
            />
          </label>
          {titleQuery && (
            <button
              onClick={() => setTitleQuery("")}
              style={{ ...selectStyle, padding: "6px 12px", cursor: "pointer" }}
            >
              清除
            </button>
          )}
          {twFilterDisabled && (
            <span style={{ fontSize: 11, color: "var(--ink-3)" }}>
              ⓘ TW 政府資料無企業類型 / 年資維度；目前僅「職位搜尋」可用。
            </span>
          )}
        </div>
      )}

      {/* Industry chips */}
      <div className="chips" style={{ marginBottom: 16 }}>
        {INDUSTRIES.map((ind) => (
          <span
            key={ind.id}
            className={`chip${selectedIndustry === ind.id ? " active" : ""}`}
            onClick={() => {
              setSelectedIndustry(selectedIndustry === ind.id ? null : ind.id);
              setSelectedOccupation(null);
            }}
          >
            {ind.name}
          </span>
        ))}
      </div>

      {/* Disabled country card */}
      {isDisabled && (
        <div className="card" style={{ padding: 30, textAlign: "center" }}>
          <div style={{ fontSize: 28, marginBottom: 10 }}>🚧</div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>
            {COUNTRIES.find((c) => c.code === country)?.label.replace(/\s.*$/, "")} 資料尚未開放
          </div>
          <div style={{ fontSize: 13, color: "var(--ink-3)" }}>
            Adzuna 不涵蓋此區，後續會接入其他來源（如當地求職平台、政府資料）。
          </div>
        </div>
      )}

      {/* Empty industry state */}
      {!isDisabled && !selectedIndustry && (
        <div style={{ padding: 60, textAlign: "center", color: "var(--ink-3)" }}>
          請從上方選擇產業類別開始查詢。
        </div>
      )}

      {/* Loading */}
      {!isDisabled && apiUrl && isLoading && !data && (
        <div style={{ padding: 60, textAlign: "center" }}>
          <div className="spinner" style={{ margin: "0 auto 12px" }} />
          <div style={{ fontSize: 13, color: "var(--ink-3)" }}>
            {isForeign ? "彙整職缺薪資中…" : "讀取政府公開資料中…"}
          </div>
        </div>
      )}

      {/* No data (server returned 0 rows for this country × industry) */}
      {!isDisabled && data && !data.hasData && (
        <div className="card" style={{ padding: 30, textAlign: "center" }}>
          <div style={{ fontSize: 28, marginBottom: 10 }}>📊</div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>
            「{industryName}」在 {COUNTRIES.find((c) => c.code === country)?.label} 暫無樣本
          </div>
          <div style={{ fontSize: 13, color: "var(--ink-3)" }}>
            {data.reason ?? "此產業 × 此國家目前沒有可用資料，試試其他產業或國家。（這不是 filter 造成 — filter 是進階篩選，非必填。）"}
          </div>
        </div>
      )}

      {/* TW gov result */}
      {!isDisabled && data?.hasData && data.mode === "tw_gov" && data.rows && data.summary && (
        <>
          <div className="card" style={{ padding: 22, marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: "var(--ink-3)", letterSpacing: ".05em", marginBottom: 8 }}>
              {industryName} · 政府行業大類「{data.govName}」 · {data.year} 年資料
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
              <Stat label="加權平均月薪"
                    value={fmtTwd(data.summary.weightedMonthly)} unit="元/月" />
              <Stat label="加權平均年薪"
                    value={`${data.summary.weightedAnnualWan.toFixed(1)} 萬`} unit="元/年" />
              <Stat label="樣本總數"
                    value={data.summary.totalEmployees.toLocaleString("zh-TW")} unit="名員工" />
              <Stat label="職類別數"
                    value={String(data.summary.occupationCount)} unit="種" />
            </div>
          </div>

          <SelfEvalInputs
            monthly={userMonthlyInput} setMonthly={setUserMonthlyInput}
            annual={userAnnualInput}   setAnnual={setUserAnnualInput}
            experience={experience} setExperience={setExperience}
            experienceDisabled  // TW gov 資料無年資維度
            experienceHint="TW 政府資料無年資維度，本欄暫時無效；若要看年資分群，請切換到海外國家"
          >
            {localSelfEval && "basis" in localSelfEval && localSelfEval.basis !== "median" && (
              <TwSelfEvalResult
                sev={localSelfEval as TwSelfEval}
                occupation={selectedOccupation}
              />
            )}
          </SelfEvalInputs>

          <div className="card" style={{ padding: 0 }}>
            <div style={{ padding: "14px 22px", borderBottom: "1px solid var(--line)", fontSize: 13, fontWeight: 600 }}>
              依職類別 · {titleQuery.trim()
                ? <>符合「{titleQuery}」 <span style={{ color: "var(--ink-3)", fontWeight: 400 }}>({twFilteredRows.length} / {(data.rows as TwGovRow[]).length})</span></>
                : <>共 {(data.rows as TwGovRow[]).length} 種</>}
            </div>
            <div style={{ maxHeight: 540, overflowY: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead style={{ background: "var(--bg-soft)" }}>
                  <tr>
                    <th style={cellHead}>職類別</th>
                    <th style={{ ...cellHead, textAlign: "right" }}>月薪</th>
                    <th style={{ ...cellHead, textAlign: "right" }}>年薪</th>
                    <th style={{ ...cellHead, textAlign: "right" }}>樣本數</th>
                  </tr>
                </thead>
                <tbody>
                  {twFilteredRows.length === 0 && (
                    <tr><td colSpan={4} style={{ ...cellBody, textAlign: "center", color: "var(--ink-3)" }}>
                      沒有職類別符合「{titleQuery}」
                    </td></tr>
                  )}
                  {twFilteredRows.slice().sort((a, b) => b.monthlyTwd - a.monthlyTwd).map((row) => (
                    <tr
                      key={row.occupation}
                      onClick={() =>
                        setSelectedOccupation(selectedOccupation === row.occupation ? null : row.occupation)
                      }
                      style={{
                        cursor: "pointer",
                        background: selectedOccupation === row.occupation ? "var(--accent-soft)" : undefined,
                        borderTop: "1px solid var(--line)",
                      }}
                    >
                      <td style={cellBody}>{row.occupation}</td>
                      <td style={{ ...cellBody, textAlign: "right", fontFamily: "var(--font-mono)" }}>
                        {fmtTwd(row.monthlyTwd)}
                      </td>
                      <td style={{ ...cellBody, textAlign: "right", fontFamily: "var(--font-mono)" }}>
                        {row.annualTwdWan.toFixed(1)} 萬
                      </td>
                      <td style={{ ...cellBody, textAlign: "right", fontFamily: "var(--font-mono)", color: "var(--ink-3)" }}>
                        {row.employees.toLocaleString("zh-TW")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Adzuna result — all numbers computed client-side from rows + filters */}
      {!isDisabled && data?.hasData && data.mode === "adzuna" && adzunaSummary && (
        <>
          <div className="card" style={{ padding: 22, marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: "var(--ink-3)", letterSpacing: ".05em", marginBottom: 8 }}>
              {country} · {industryName}
              {companyType && ` · ${COMPANY_TYPE_BASE.find((o) => o.value === companyType)?.label}`}
              {experience && ` · ${EXPERIENCE_BUCKETS[experience].label}`}
              {titleQuery.trim() && ` · 職位「${titleQuery.trim()}」`}
              {" · "}樣本 {adzunaSummary.sampleSize.toLocaleString("zh-TW")} / 全部 {(data.rows as AdzunaJobRow[]).length} 筆
            </div>
            {adzunaSummary.sampleSize === 0 ? (
              <div style={{ padding: 24, textAlign: "center", color: "var(--ink-3)", fontSize: 13 }}>
                目前 filter 組合無樣本；試著放寬篩選。
              </div>
            ) : (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 16 }}>
                  <Stat label="P25 (後段)"
                        value={fmtTwd(adzunaSummary.p25Annual)} unit="TWD/年" />
                  <Stat label="P50 (中位數)"
                        value={fmtTwd(adzunaSummary.p50Annual)} unit="TWD/年" />
                  <Stat label="P75 (前段)"
                        value={fmtTwd(adzunaSummary.p75Annual)} unit="TWD/年" />
                  <Stat label="平均"
                        value={fmtTwd(adzunaSummary.meanAnnual)} unit="TWD/年" />
                </div>
                <div style={{ marginTop: 12, fontSize: 11, color: "var(--ink-3)" }}>
                  月薪換算: {fmtTwd(monthlyFrom(adzunaSummary.p25Annual))}
                  {" · "}{fmtTwd(monthlyFrom(adzunaSummary.p50Annual))}
                  {" · "}{fmtTwd(monthlyFrom(adzunaSummary.p75Annual))}
                  {" · "}{fmtTwd(monthlyFrom(adzunaSummary.meanAnnual))}
                </div>
              </>
            )}
          </div>

          <SelfEvalInputs
            monthly={userMonthlyInput} setMonthly={setUserMonthlyInput}
            annual={userAnnualInput}   setAnnual={setUserAnnualInput}
            experience={experience} setExperience={setExperience}
            currency={inputCurrency} setCurrency={setInputCurrency}
            localCurrencyCode={LOCAL_CURRENCY[country]}
            warning={
              (userMonthlyInput || userAnnualInput) && !experience
                ? "⚠️ 還沒選「年資」— 你正在跟整個年資區間比較。選一個年資 bucket 才能得到精準的市場價值落點。"
                : null
            }
          >
            {localSelfEval && "basis" in localSelfEval && localSelfEval.basis === "median" && (
              <AdzunaSelfEvalResult
                sev={localSelfEval as ForeignSelfEval}
                contextLabel={[
                  country,
                  industryName,
                  companyType && COMPANY_TYPE_BASE.find((o) => o.value === companyType)?.label,
                  experience  ? EXPERIENCE_BUCKETS[experience].label : "不分年資",
                  titleQuery.trim() && `職位「${titleQuery.trim()}」`,
                ].filter(Boolean).join(" · ")}
              />
            )}
          </SelfEvalInputs>
        </>
      )}

      {/* Source note */}
      {!isDisabled && data?.hasData && data.source && (
        <div style={{ marginTop: 14, fontSize: 11, color: "var(--ink-4)", lineHeight: 1.6 }}>
          📌 資料來源：{data.source.agency}（透過 {data.source.provider} 取得）。{data.source.note}
        </div>
      )}
    </div>
  );
}

function monthlyFrom(annual: number | null): number | null {
  return annual == null ? null : Math.round(annual / 12);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const cellHead: React.CSSProperties = {
  padding: "10px 18px", fontSize: 11, fontWeight: 600, color: "var(--ink-3)",
  letterSpacing: ".05em", textAlign: "left",
};
const cellBody: React.CSSProperties = {
  padding: "12px 18px",
};
const inputStyle: React.CSSProperties = {
  padding: "6px 10px", border: "1px solid var(--line)", borderRadius: 6,
  width: 110, fontFamily: "var(--font-mono)", fontSize: 13,
};
const selectStyle: React.CSSProperties = {
  padding: "6px 10px", border: "1px solid var(--line)", borderRadius: 6,
  fontSize: 13, background: "var(--bg)",
};

function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "var(--ink-3)", marginBottom: 4, letterSpacing: ".05em" }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-.02em", fontFamily: "var(--font-mono)" }}>{value}</div>
      <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 2 }}>{unit}</div>
    </div>
  );
}

function SelfEvalInputs({
  monthly, setMonthly, annual, setAnnual,
  experience, setExperience, experienceDisabled, experienceHint,
  currency, setCurrency, localCurrencyCode,
  warning, children,
}: {
  monthly: string; setMonthly: (s: string) => void;
  annual:  string; setAnnual:  (s: string) => void;
  experience?: string; setExperience?: (s: string) => void;
  experienceDisabled?: boolean;
  experienceHint?: string;
  currency?: string;
  setCurrency?: (s: string) => void;
  localCurrencyCode?: string;        // e.g. "USD"; if set, shows TWD/local toggle
  warning?: string | null | false;
  children?: React.ReactNode;
}) {
  const isTwd = !currency || currency === "TWD";
  const monthlyUnit = isTwd ? "元" : `${currency}/月`;
  const annualUnit  = isTwd ? "萬" : `${currency}/年`;
  const monthlyPh   = isTwd ? "e.g. 65000" : "e.g. 6000";
  const annualPh    = isTwd ? "e.g. 100"   : "e.g. 80000";

  return (
    <div className="card" style={{ padding: 22, marginBottom: 16, background: "var(--bg-soft)" }}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>
        💡 輸入你的薪資 + 年資，綜合評估市場落點
      </div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        {localCurrencyCode && setCurrency && (
          <label style={{ fontSize: 12, color: "var(--ink-2)" }}>
            幣別{" "}
            <select
              value={currency ?? "TWD"}
              onChange={(e) => setCurrency(e.target.value)}
              style={selectStyle}
            >
              <option value="TWD">TWD</option>
              <option value={localCurrencyCode}>{localCurrencyCode}（在地幣）</option>
            </select>
          </label>
        )}
        <label style={{ fontSize: 12, color: "var(--ink-2)" }}>
          月薪{" "}
          <input
            type="number"
            value={monthly}
            onChange={(e) => setMonthly(e.target.value)}
            placeholder={monthlyPh}
            style={inputStyle}
          />{" "}{monthlyUnit}
        </label>
        <label style={{ fontSize: 12, color: "var(--ink-2)" }}>
          年薪{" "}
          <input
            type="number"
            value={annual}
            onChange={(e) => setAnnual(e.target.value)}
            placeholder={annualPh}
            style={inputStyle}
          />{" "}{annualUnit}
        </label>
        {setExperience && (
          <label
            style={{ fontSize: 12, color: "var(--ink-2)" }}
            title={experienceDisabled ? experienceHint : undefined}
          >
            年資{" "}
            <select
              value={experience ?? ""}
              onChange={(e) => setExperience(e.target.value)}
              disabled={experienceDisabled}
              style={{
                ...selectStyle,
                opacity: experienceDisabled ? 0.5 : 1,
                cursor: experienceDisabled ? "not-allowed" : "pointer",
              }}
            >
              {EXPERIENCE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
        )}
      </div>
      {experienceDisabled && experienceHint && (
        <div style={{ marginTop: 8, fontSize: 11, color: "var(--ink-3)" }}>
          ⓘ {experienceHint}
        </div>
      )}
      {warning && (
        <div style={{ marginTop: 10, padding: "8px 12px", background: "#fff7ed", color: "#9a3412",
                      borderRadius: 6, fontSize: 12, lineHeight: 1.5 }}>
          {warning}
        </div>
      )}
      {children}
    </div>
  );
}

function TwSelfEvalResult({ sev, occupation }: { sev: TwSelfEval; occupation: string | null }) {
  const tone  = (pct: number | null) =>
    pct == null ? "var(--ink-3)" : pct > 5 ? "#16a34a" : pct < -5 ? "#dc2626" : "var(--ink-2)";
  const arrow = (pct: number | null) =>
    pct == null ? "" : pct > 0 ? "▲" : pct < 0 ? "▼" : "≈";
  const basisLabel = sev.basis === "occupation" ? `「${occupation}」職類` : "整體產業（加權平均）";

  return (
    <div style={{ marginTop: 14, padding: 14, background: "var(--bg)", borderRadius: 8, fontSize: 13 }}>
      <div style={{ color: "var(--ink-3)", marginBottom: 8 }}>
        比較對象：{basisLabel}（月薪 {fmtTwd(sev.againstMonthly)} 元 / 年薪 {sev.againstAnnualWan} 萬）
      </div>
      <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
        {sev.userMonthly != null && (
          <div>
            <span style={{ color: "var(--ink-3)" }}>月薪 {fmtTwd(sev.userMonthly)} 元 → </span>
            <span style={{ color: tone(sev.diffMonthlyPct), fontWeight: 700 }}>
              {arrow(sev.diffMonthlyPct)} {sev.diffMonthlyPct == null ? "—" : `${sev.diffMonthlyPct.toFixed(1)}%`}
            </span>
          </div>
        )}
        {sev.userAnnual != null && (
          <div>
            <span style={{ color: "var(--ink-3)" }}>年薪 {(sev.userAnnual / 10000).toFixed(1)} 萬 → </span>
            <span style={{ color: tone(sev.diffAnnualPct), fontWeight: 700 }}>
              {arrow(sev.diffAnnualPct)} {sev.diffAnnualPct == null ? "—" : `${sev.diffAnnualPct.toFixed(1)}%`}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function AdzunaSelfEvalResult({ sev, contextLabel }: { sev: ForeignSelfEval; contextLabel?: string }) {
  const tone  = (pct: number | null) =>
    pct == null ? "var(--ink-3)" : pct > 5 ? "#16a34a" : pct < -5 ? "#dc2626" : "var(--ink-2)";
  const arrow = (pct: number | null) =>
    pct == null ? "" : pct > 0 ? "▲" : pct < 0 ? "▼" : "≈";

  return (
    <div style={{ marginTop: 14, padding: 14, background: "var(--bg)", borderRadius: 8, fontSize: 13 }}>
      {contextLabel && (
        <div style={{ color: "var(--ink-3)", marginBottom: 4, fontSize: 11, letterSpacing: ".05em" }}>
          篩選條件：{contextLabel}
        </div>
      )}
      <div style={{ color: "var(--ink-3)", marginBottom: 8 }}>
        比較對象：此切片的中位數 P50（年薪 {fmtTwd(sev.againstAnnualTwd)} 元 / 月薪 {fmtTwd(sev.againstMonthlyTwd)} 元）
      </div>
      <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 10 }}>
        {sev.userMonthly != null && (
          <div>
            <span style={{ color: "var(--ink-3)" }}>月薪 {fmtTwd(sev.userMonthly)} 元 → </span>
            <span style={{ color: tone(sev.diffMonthlyPct), fontWeight: 700 }}>
              {arrow(sev.diffMonthlyPct)} {sev.diffMonthlyPct == null ? "—" : `${sev.diffMonthlyPct.toFixed(1)}%`}
            </span>
          </div>
        )}
        {sev.userAnnual != null && (
          <div>
            <span style={{ color: "var(--ink-3)" }}>年薪 {(sev.userAnnual / 10000).toFixed(1)} 萬 → </span>
            <span style={{ color: tone(sev.diffAnnualPct), fontWeight: 700 }}>
              {arrow(sev.diffAnnualPct)} {sev.diffAnnualPct == null ? "—" : `${sev.diffAnnualPct.toFixed(1)}%`}
            </span>
          </div>
        )}
      </div>
      {sev.percentile != null && (
        <div style={{ fontSize: 13 }}>
          你落在約 <span style={{ fontWeight: 700, fontSize: 18 }}>P{sev.percentile}</span> — 大約贏過 {sev.percentile}% 的同類職缺薪資範圍。
        </div>
      )}
    </div>
  );
}
