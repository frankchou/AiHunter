"use client";
import { useState, useMemo } from "react";
import useSWR from "swr";
import { INDUSTRIES } from "@/lib/mock-data";

interface SalaryRow {
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

interface AdzunaSummary {
  sampleSize:    number;
  p25Annual:     number | null;
  p50Annual:     number | null;
  p75Annual:     number | null;
  meanAnnual:    number | null;
  p25Monthly:    number | null;
  p50Monthly:    number | null;
  p75Monthly:    number | null;
  meanMonthly:   number | null;
}

interface SalarySource { provider: string; agency: string; note: string }

interface SalaryResponse {
  // shared
  industry?: string | null;
  country?:  string;
  hasData:   boolean;
  reason?:   string;
  source?:   SalarySource;
  // TW gov mode
  mode?:     "tw_gov" | "adzuna";
  datasetId?: string;
  govName?:   string;
  year?:      string;
  summary?:   TwSummary | AdzunaSummary;
  rows?:      SalaryRow[];
  selected?:  SalaryRow | null;
  // Adzuna mode
  companyType?:      string | null;
  companyTypeLabel?: string | null;
  experience?:       string | null;
  experienceLabel?:  string | null;
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
  { code: "TW", label: "台灣（政府）",   mode: "tw_gov" },
  { code: "US", label: "美國",         mode: "adzuna" },
  { code: "UK", label: "英國",         mode: "adzuna" },
  { code: "AU", label: "澳洲",         mode: "adzuna" },
  { code: "EU", label: "歐洲（六國）", mode: "adzuna" },
  { code: "JP", label: "日本",         mode: "disabled" },
  { code: "KR", label: "韓國",         mode: "disabled" },
  { code: "CN", label: "中國",         mode: "disabled" },
];

const COMPANY_TYPE_OPTIONS = [
  { value: "",                    label: "不分企業類型" },
  { value: "foreign_tier1",       label: "Tier-1 外商" },
  { value: "foreign_traditional", label: "傳統外商" },
  { value: "tw_local",            label: "台商" },
  { value: "large_enterprise",    label: "大企業（其他）" },
  { value: "sme",                 label: "中小企業" },
  { value: "startup",             label: "新創" },
];

const EXPERIENCE_OPTIONS = [
  { value: "",         label: "不分年資" },
  { value: "exp_0",    label: "0 年（應屆）" },
  { value: "exp_1_3",  label: "1-3 年" },
  { value: "exp_3_7",  label: "3-7 年" },
  { value: "exp_7_10", label: "7-10 年" },
  { value: "exp_10p",  label: "10+ 年" },
];

function fmtTwd(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n) || n <= 0) return "—";
  if (n >= 10000) return `${(n / 10000).toFixed(1).replace(/\.0$/, "")} 萬`;
  return n.toLocaleString("zh-TW");
}

export function SalaryView() {
  const [country, setCountry] = useState<string>("TW");
  const [selectedIndustry, setSelectedIndustry] = useState<string | null>(null);
  const [selectedOccupation, setSelectedOccupation] = useState<string | null>(null);
  const [companyType, setCompanyType] = useState<string>("");
  const [experience, setExperience]   = useState<string>("");
  const [userMonthlyInput, setUserMonthlyInput] = useState("");
  const [userAnnualInput, setUserAnnualInput]   = useState("");

  const isForeign  = country !== "TW";
  const isDisabled = ["JP", "KR", "CN"].includes(country);

  // URL excludes user salary inputs — self-eval is computed client-side so
  // typing into the input never refetches and never flickers the layout.
  const apiUrl = useMemo(() => {
    if (isDisabled) return null;
    // For TW, an industry must be picked. For foreign, industry is optional.
    if (!isForeign && !selectedIndustry) return null;
    const params = new URLSearchParams({ country });
    if (selectedIndustry)   params.set("industry", selectedIndustry);
    if (!isForeign && selectedOccupation) params.set("occupation", selectedOccupation);
    if (isForeign && companyType) params.set("companyType", companyType);
    if (isForeign && experience)  params.set("experience", experience);
    return `/api/salary?${params.toString()}`;
  }, [country, isForeign, isDisabled, selectedIndustry, selectedOccupation, companyType, experience]);

  const { data, isLoading } = useSWR<SalaryResponse>(apiUrl, fetcher, {
    revalidateOnFocus: false,
    keepPreviousData:  true,
  });

  const industryName = selectedIndustry
    ? INDUSTRIES.find((i) => i.id === selectedIndustry)?.name
    : null;

  // ── Client-side self-eval (no API call) ────────────────────────────
  const localSelfEval = useMemo<TwSelfEval | ForeignSelfEval | null>(() => {
    if (!data?.hasData || !data.summary) return null;
    const um = userMonthlyInput ? Number(userMonthlyInput) : NaN;
    const ua = userAnnualInput   ? Number(userAnnualInput)  : NaN;
    const userMonthly = Number.isFinite(um) && um > 0 ? um : null;

    if (data.mode === "tw_gov") {
      const summary = data.summary as TwSummary;
      const userAnnualEl = Number.isFinite(ua) && ua > 0 ? ua * 10000 : null;
      if (userMonthly == null && userAnnualEl == null) return null;
      const sel = data.selected;
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

    // Adzuna mode
    const summary = data.summary as AdzunaSummary;
    const userAnnualTwd = Number.isFinite(ua) && ua > 0 ? ua * 10000 : null;
    if (userMonthly == null && userAnnualTwd == null) return null;
    if (summary.p50Annual == null) return null;
    const annualUser = userAnnualTwd ?? (userMonthly! * 12);
    const p25 = summary.p25Annual, p50 = summary.p50Annual, p75 = summary.p75Annual;
    let perc: number | null = null;
    if (p25 != null && p75 != null) {
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
      userMonthly,
      userAnnual:        userAnnualTwd,
      diffMonthlyPct:    userMonthly    != null ? pct(userMonthly,    p50 / 12) : null,
      diffAnnualPct:     userAnnualTwd  != null ? pct(userAnnualTwd,  p50)      : null,
      percentile:        perc == null ? null : Math.round(perc),
    };
  }, [data, userMonthlyInput, userAnnualInput]);

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
                onClick={() => {
                  if (disabled) {
                    setCountry(c.code);  // still allow selecting to show the no-data card
                  } else {
                    setCountry(c.code);
                  }
                  setSelectedOccupation(null);
                }}
                style={disabled
                  ? { opacity: 0.5, fontStyle: "italic" }
                  : undefined}
                title={disabled ? "該國資料尚未開放" : c.label}
              >
                {c.label}{disabled ? " · 灰" : ""}
              </span>
            );
          })}
        </div>
      </div>

      {/* Adzuna-only filters */}
      {isForeign && !isDisabled && (
        <div style={{
          display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12, fontSize: 12, color: "var(--ink-2)",
        }}>
          <label>
            企業類型{" "}
            <select
              value={companyType}
              onChange={(e) => setCompanyType(e.target.value)}
              style={selectStyle}
            >
              {COMPANY_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
          <label>
            年資{" "}
            <select
              value={experience}
              onChange={(e) => setExperience(e.target.value)}
              style={selectStyle}
            >
              {EXPERIENCE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
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

      {/* Empty industry state (TW only — foreign mode can run without industry) */}
      {!isDisabled && !isForeign && !selectedIndustry && (
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

      {/* No data */}
      {!isDisabled && data && !data.hasData && (
        <div className="card" style={{ padding: 30, textAlign: "center" }}>
          <div style={{ fontSize: 28, marginBottom: 10 }}>📊</div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>
            此條件下無可用資料
          </div>
          <div style={{ fontSize: 13, color: "var(--ink-3)" }}>
            {data.reason ?? "試著放寬篩選（移除企業類型或年資）。"}
          </div>
        </div>
      )}

      {/* TW gov result */}
      {!isDisabled && data?.hasData && data.mode === "tw_gov" && data.rows && (
        <>
          <div className="card" style={{ padding: 22, marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: "var(--ink-3)", letterSpacing: ".05em", marginBottom: 8 }}>
              {industryName} · 政府行業大類「{data.govName}」 · {data.year} 年資料
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
              <Stat label="加權平均月薪"
                    value={fmtTwd((data.summary as TwSummary).weightedMonthly)} unit="元/月" />
              <Stat label="加權平均年薪"
                    value={`${(data.summary as TwSummary).weightedAnnualWan.toFixed(1)} 萬`} unit="元/年" />
              <Stat label="樣本總數"
                    value={(data.summary as TwSummary).totalEmployees.toLocaleString("zh-TW")} unit="名員工" />
              <Stat label="職類別數"
                    value={String((data.summary as TwSummary).occupationCount)} unit="種" />
            </div>
          </div>

          <SelfEvalInputs
            monthly={userMonthlyInput} setMonthly={setUserMonthlyInput}
            annual={userAnnualInput}   setAnnual={setUserAnnualInput}
          >
            {localSelfEval && "basis" in localSelfEval && localSelfEval.basis !== "median" && (
              <TwSelfEvalResult sev={localSelfEval as TwSelfEval} occupation={selectedOccupation} />
            )}
          </SelfEvalInputs>

          <div className="card" style={{ padding: 0 }}>
            <div style={{ padding: "14px 22px", borderBottom: "1px solid var(--line)", fontSize: 13, fontWeight: 600 }}>
              依職類別 · 共 {data.rows.length} 種
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
                  {data.rows.slice().sort((a, b) => b.monthlyTwd - a.monthlyTwd).map((row) => (
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

      {/* Adzuna result */}
      {!isDisabled && data?.hasData && data.mode === "adzuna" && (
        <>
          <div className="card" style={{ padding: 22, marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: "var(--ink-3)", letterSpacing: ".05em", marginBottom: 8 }}>
              {country} · {industryName ?? "全產業"}
              {data.companyTypeLabel && ` · ${data.companyTypeLabel}`}
              {data.experienceLabel  && ` · ${data.experienceLabel}`}
              {" · "}樣本 {(data.summary as AdzunaSummary).sampleSize.toLocaleString("zh-TW")} 筆職缺
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 16 }}>
              <Stat label="P25（後段）"
                    value={fmtTwd((data.summary as AdzunaSummary).p25Annual)} unit="TWD/年" />
              <Stat label="P50（中位數）"
                    value={fmtTwd((data.summary as AdzunaSummary).p50Annual)} unit="TWD/年" />
              <Stat label="P75（前段）"
                    value={fmtTwd((data.summary as AdzunaSummary).p75Annual)} unit="TWD/年" />
              <Stat label="平均"
                    value={fmtTwd((data.summary as AdzunaSummary).meanAnnual)} unit="TWD/年" />
            </div>
            <div style={{ marginTop: 12, fontSize: 11, color: "var(--ink-3)" }}>
              月薪換算（P25 / P50 / P75 / 均）：
              {" "}{fmtTwd((data.summary as AdzunaSummary).p25Monthly)}
              {" · "}{fmtTwd((data.summary as AdzunaSummary).p50Monthly)}
              {" · "}{fmtTwd((data.summary as AdzunaSummary).p75Monthly)}
              {" · "}{fmtTwd((data.summary as AdzunaSummary).meanMonthly)}
            </div>
          </div>

          <SelfEvalInputs
            monthly={userMonthlyInput} setMonthly={setUserMonthlyInput}
            annual={userAnnualInput}   setAnnual={setUserAnnualInput}
          >
            {localSelfEval && "basis" in localSelfEval && localSelfEval.basis === "median" && (
              <AdzunaSelfEvalResult sev={localSelfEval as ForeignSelfEval} />
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
  monthly, setMonthly, annual, setAnnual, children,
}: {
  monthly: string; setMonthly: (s: string) => void;
  annual:  string; setAnnual:  (s: string) => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="card" style={{ padding: 22, marginBottom: 16, background: "var(--bg-soft)" }}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>
        💡 輸入你的薪資，比較自己落在哪
      </div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <label style={{ fontSize: 12, color: "var(--ink-2)" }}>
          月薪{" "}
          <input
            type="number"
            value={monthly}
            onChange={(e) => setMonthly(e.target.value)}
            placeholder="e.g. 65000"
            style={inputStyle}
          />{" "}元
        </label>
        <label style={{ fontSize: 12, color: "var(--ink-2)" }}>
          年薪{" "}
          <input
            type="number"
            value={annual}
            onChange={(e) => setAnnual(e.target.value)}
            placeholder="e.g. 100"
            style={inputStyle}
          />{" "}萬
        </label>
      </div>
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

function AdzunaSelfEvalResult({ sev }: { sev: ForeignSelfEval }) {
  const tone  = (pct: number | null) =>
    pct == null ? "var(--ink-3)" : pct > 5 ? "#16a34a" : pct < -5 ? "#dc2626" : "var(--ink-2)";
  const arrow = (pct: number | null) =>
    pct == null ? "" : pct > 0 ? "▲" : pct < 0 ? "▼" : "≈";

  return (
    <div style={{ marginTop: 14, padding: 14, background: "var(--bg)", borderRadius: 8, fontSize: 13 }}>
      <div style={{ color: "var(--ink-3)", marginBottom: 8 }}>
        比較對象：中位數 P50（年薪 {fmtTwd(sev.againstAnnualTwd)} 元 / 月薪 {fmtTwd(sev.againstMonthlyTwd)} 元）
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
