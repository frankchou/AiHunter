"use client";
import { useState, useMemo } from "react";
import useSWR from "swr";
import { INDUSTRIES } from "@/lib/mock-data";
import { INDUSTRY_TO_DATASET } from "@/lib/salary-sources/industry-mapping";

interface SalaryRow {
  occupation:    string;
  employees:     number;
  monthlyTwd:    number;
  annualTwdWan:  number;
}

interface SalaryResponse {
  industry:  string;
  datasetId: string;
  govName:   string;
  year:      string;
  hasData:   boolean;
  reason?:   string;
  summary?: {
    totalEmployees:    number;
    weightedMonthly:   number;
    weightedAnnualWan: number;
    occupationCount:   number;
  };
  rows?:     SalaryRow[];
  selected?: SalaryRow | null;
  selfEval?: {
    basis:           "occupation" | "industry";
    againstMonthly:  number;
    againstAnnualWan: number;
    userMonthly:     number | null;
    userAnnual:      number | null;
    diffMonthlyPct:  number | null;
    diffAnnualPct:   number | null;
  } | null;
  source?: {
    provider: string;
    agency:   string;
    note:     string;
  };
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

// Format a TWD amount: ≥ 1萬 shows "X.X 萬"; otherwise raw number with commas.
function fmtTwd(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "—";
  if (n >= 10000) return `${(n / 10000).toFixed(1).replace(/\.0$/, "")} 萬`;
  return n.toLocaleString("zh-TW");
}

export function SalaryView() {
  const [selectedIndustry, setSelectedIndustry] = useState<string | null>(null);
  const [selectedOccupation, setSelectedOccupation] = useState<string | null>(null);
  const [userMonthlyInput, setUserMonthlyInput] = useState("");
  const [userAnnualInput, setUserAnnualInput]   = useState("");

  // Build the API URL — only fetch when industry is selected.
  const apiUrl = useMemo(() => {
    if (!selectedIndustry) return null;
    const params = new URLSearchParams({ industry: selectedIndustry });
    if (selectedOccupation) params.set("occupation", selectedOccupation);
    if (userMonthlyInput) {
      const v = Number(userMonthlyInput);
      if (Number.isFinite(v) && v > 0) params.set("userMonthly", String(v));
    }
    if (userAnnualInput) {
      // Input is in 萬, convert to 元 for the API.
      const v = Number(userAnnualInput);
      if (Number.isFinite(v) && v > 0) params.set("userAnnual", String(v * 10000));
    }
    return `/api/salary?${params.toString()}`;
  }, [selectedIndustry, selectedOccupation, userMonthlyInput, userAnnualInput]);

  const { data, isLoading } = useSWR<SalaryResponse>(apiUrl, fetcher, {
    revalidateOnFocus: false,
  });

  const industryName = selectedIndustry
    ? INDUSTRIES.find((i) => i.id === selectedIndustry)?.name
    : null;

  return (
    <div className="app-content">
      <div className="section-h">
        <h3>薪資查詢</h3>
        <span className="sub">基於台灣政府公開資料（勞動部 / 主計總處），每年 7 月更新</span>
      </div>

      {/* Industry chips */}
      <div className="chips" style={{ marginBottom: 16 }}>
        {INDUSTRIES.map((ind) => (
          <span
            key={ind.id}
            className={`chip${selectedIndustry === ind.id ? " active" : ""}`}
            onClick={() => {
              setSelectedIndustry(ind.id);
              setSelectedOccupation(null);  // reset occupation when switching industry
            }}
          >
            {ind.name}
          </span>
        ))}
      </div>

      {/* Empty state */}
      {!selectedIndustry && (
        <div style={{ padding: 60, textAlign: "center", color: "var(--ink-3)" }}>
          請從上方選擇產業類別開始查詢。
        </div>
      )}

      {/* Loading */}
      {selectedIndustry && isLoading && (
        <div style={{ padding: 60, textAlign: "center" }}>
          <div className="spinner" style={{ margin: "0 auto 12px" }} />
          <div style={{ fontSize: 13, color: "var(--ink-3)" }}>讀取政府公開資料中…</div>
        </div>
      )}

      {/* No data for this industry */}
      {selectedIndustry && data && !data.hasData && (
        <div className="card" style={{ padding: 30, textAlign: "center" }}>
          <div style={{ fontSize: 28, marginBottom: 10 }}>📊</div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>
            「{industryName}」目前無政府公開薪資資料
          </div>
          <div style={{ fontSize: 13, color: "var(--ink-3)" }}>
            {data.reason ?? "政府資料未涵蓋此產業；Phase 2 將整合海外職缺資料補上。"}
          </div>
        </div>
      )}

      {/* Main results */}
      {selectedIndustry && data?.hasData && data.summary && data.rows && (
        <>
          {/* Industry-wide summary */}
          <div className="card" style={{ padding: 22, marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: "var(--ink-3)", letterSpacing: ".05em", marginBottom: 8 }}>
              {industryName} · 政府行業大類「{data.govName}」 · {data.year} 年資料
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
              <Stat label="加權平均月薪" value={fmtTwd(data.summary.weightedMonthly)} unit="元/月" />
              <Stat label="加權平均年薪" value={`${data.summary.weightedAnnualWan.toFixed(1)} 萬`} unit="元/年" />
              <Stat label="樣本總數" value={data.summary.totalEmployees.toLocaleString("zh-TW")} unit="名員工" />
              <Stat label="職類別數" value={String(data.summary.occupationCount)} unit="種" />
            </div>
          </div>

          {/* Self-eval input */}
          <div className="card" style={{ padding: 22, marginBottom: 16, background: "var(--bg-soft)" }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>
              💡 輸入你的薪資，比較自己落在哪
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <label style={{ fontSize: 12, color: "var(--ink-2)" }}>
                月薪{" "}
                <input
                  type="number"
                  value={userMonthlyInput}
                  onChange={(e) => setUserMonthlyInput(e.target.value)}
                  placeholder="e.g. 65000"
                  style={inputStyle}
                />{" "}
                元
              </label>
              <label style={{ fontSize: 12, color: "var(--ink-2)" }}>
                年薪{" "}
                <input
                  type="number"
                  value={userAnnualInput}
                  onChange={(e) => setUserAnnualInput(e.target.value)}
                  placeholder="e.g. 100"
                  style={inputStyle}
                />{" "}
                萬
              </label>
            </div>
            {data.selfEval && (
              <SelfEvalResult sev={data.selfEval} occupation={selectedOccupation} />
            )}
          </div>

          {/* Occupation list */}
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
                  {data.rows
                    .slice()
                    .sort((a, b) => b.monthlyTwd - a.monthlyTwd)
                    .map((row) => (
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

          {/* Source note */}
          {data.source && (
            <div style={{ marginTop: 14, fontSize: 11, color: "var(--ink-4)", lineHeight: 1.6 }}>
              📌 資料來源：{data.source.agency}（透過 {data.source.provider} 取得）。{data.source.note}<br />
              本資料為平均值，未提供 P25/P50/P75 分布；海外職缺薪資與企業類型分群將於 Phase 2 加入。
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Small helpers ───────────────────────────────────────────────────────────
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

function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "var(--ink-3)", marginBottom: 4, letterSpacing: ".05em" }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-.02em", fontFamily: "var(--font-mono)" }}>{value}</div>
      <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 2 }}>{unit}</div>
    </div>
  );
}

function SelfEvalResult({
  sev,
  occupation,
}: {
  sev: NonNullable<SalaryResponse["selfEval"]>;
  occupation: string | null;
}) {
  const tone = (pct: number | null) =>
    pct == null ? "var(--ink-3)" : pct > 5 ? "#16a34a" : pct < -5 ? "#dc2626" : "var(--ink-2)";
  const arrow = (pct: number | null) =>
    pct == null ? "" : pct > 0 ? "▲" : pct < 0 ? "▼" : "≈";

  const basisLabel = sev.basis === "occupation"
    ? `「${occupation}」職類`
    : "整體產業（加權平均）";

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
