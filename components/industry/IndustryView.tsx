"use client";
import { useState, useMemo } from "react";
import useSWR from "swr";
import { INDUSTRIES } from "@/lib/mock-data";
import { fmtCompactMoney, fmtPct } from "@/lib/utils";
import { CompanyJobsModal } from "@/components/industry/CompanyJobsModal";
import type { StockQuote } from "@/app/api/stocks/route";
import type { QuarterlyFinancials } from "@/app/api/financials/route";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface AiCompany {
  rank: number;
  name: string;
  ticker: string | null;
  region: string;
  pros: string[];
  cons: string[];
  profile: string;
  trend: string;
  jobCount?: number;
}


function PriceCell({ quote }: { quote: StockQuote | undefined }) {
  if (!quote) return <span style={{ color: "var(--ink-4)", fontSize: 11 }}>—</span>;
  const up = quote.change1d >= 0;
  return (
    <div>
      <div style={{ fontWeight: 600, fontSize: 13, fontFamily: "var(--font-mono)" }}>
        {quote.currency === "USD" ? "$" : ""}{quote.price.toLocaleString()}
      </div>
      <div style={{ fontSize: 11, color: up ? "#22c55e" : "#ef4444", marginTop: 2 }}>
        {up ? "▲" : "▼"} {Math.abs(quote.change1d)}%
      </div>
    </div>
  );
}

export function IndustryView() {
  const [selectedIndustry, setSelectedIndustry] = useState(INDUSTRIES[0].id);
  const [refreshKey, setRefreshKey] = useState(0);
  const [openCompany, setOpenCompany] = useState<{ name: string; count: number } | null>(null);

  const { data, isLoading } = useSWR<{ companies: AiCompany[]; cached: boolean }>(
    `/api/industries?industry=${selectedIndustry}&_r=${refreshKey}`,
    fetcher,
    { revalidateOnFocus: false }
  );

  const companies = data?.companies ?? [];

  // Collect all non-null tickers and fetch prices
  const tickerStr = useMemo(
    () => companies.map((c) => c.ticker).filter(Boolean).join(","),
    [companies]
  );
  const { data: stockData } = useSWR<Record<string, StockQuote>>(
    tickerStr ? `/api/stocks?symbols=${tickerStr}` : null,
    fetcher,
    { revalidateOnFocus: false, refreshInterval: 300_000 }
  );
  const { data: finData } = useSWR<Record<string, QuarterlyFinancials>>(
    tickerStr ? `/api/financials?symbols=${tickerStr}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  return (
    <div className="app-content">
      <div className="section-h">
        <h3>產業 Top 20</h3>
        <span className="sub">AI 彙整各產業頂尖雇主 · 每 7 天更新</span>
        {data && (
          <button className="btn" style={{ marginLeft: "auto", fontSize: 12 }}
            onClick={() => setRefreshKey((k) => k + 1)}>
            {isLoading ? <><span className="spinner" style={{ width: 10, height: 10 }} /> 更新中</> : "🔄 強制更新"}
          </button>
        )}
      </div>

      <div className="chips" style={{ marginBottom: 16 }}>
        {INDUSTRIES.map((ind) => (
          <span key={ind.id}
            className={`chip${selectedIndustry === ind.id ? " active" : ""}`}
            onClick={() => { setSelectedIndustry(ind.id); }}>
            {ind.name}
          </span>
        ))}
      </div>

      {isLoading && (
        <div style={{ textAlign: "center", padding: 60 }}>
          <div className="spinner" style={{ margin: "0 auto 16px" }} />
          <div className="eyebrow">AI 正在分析產業頂尖雇主…</div>
          <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 6 }}>首次生成約需 10–20 秒，之後從快取讀取</div>
        </div>
      )}

      {!isLoading && companies.length === 0 && (
        <div className="card" style={{ textAlign: "center", color: "var(--ink-3)", padding: 40 }}>
          無法載入資料，請稍後再試
        </div>
      )}

      {!isLoading && companies.length > 0 && (
        <div className="industry-table">
          <table>
            <thead>
              <tr>
                <th style={{ width: 32 }}>#</th>
                <th>公司</th>
                <th style={{ width: 70 }}>地區</th>
                <th style={{ width: 110 }}>股價</th>
                <th>求職優點</th>
                <th>求職缺點</th>
                <th>未來趨勢</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => (
                <CompanyRow
                  key={c.name}
                  company={c}
                  quote={c.ticker ? stockData?.[c.ticker] : undefined}
                  financials={c.ticker ? finData?.[c.ticker] : undefined}
                  onOpenJobs={() => setOpenCompany({ name: c.name, count: c.jobCount ?? 0 })}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {openCompany && (
        <CompanyJobsModal
          companyName={openCompany.name}
          totalApprox={openCompany.count}
          onClose={() => setOpenCompany(null)}
        />
      )}
    </div>
  );
}

function CompanyRow({ company: c, quote, financials, onOpenJobs }: {
  company: AiCompany;
  quote: StockQuote | undefined;
  financials: QuarterlyFinancials | undefined;
  onOpenJobs: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const jobCount = c.jobCount ?? 0;

  const onCountClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (jobCount === 0) return;
    onOpenJobs();
  };

  return (
    <>
      <tr className="company-row" onClick={() => setExpanded((e) => !e)} style={{ cursor: "pointer" }}>
        <td style={{ fontFamily: "var(--font-mono)", color: "var(--ink-3)", fontSize: 12 }}>{c.rank}</td>
        <td>
          <div style={{ fontWeight: 600 }}>{c.name}</div>
          {c.ticker && <div style={{ fontSize: 11, color: "var(--ink-3)", fontFamily: "var(--font-mono)" }}>{c.ticker}</div>}
          <button
            type="button"
            onClick={onCountClick}
            disabled={jobCount === 0}
            style={{
              marginTop: 4,
              padding: "2px 8px",
              fontSize: 11,
              borderRadius: 4,
              border: "1px solid var(--line)",
              background: jobCount > 0 ? "var(--bg-soft)" : "transparent",
              color: jobCount > 0 ? "var(--ink-1)" : "var(--ink-4)",
              cursor: jobCount > 0 ? "pointer" : "default",
              fontFamily: "inherit",
            }}
          >
            工作機會 ({jobCount})
          </button>
        </td>
        <td>
          <span className="tag" style={{ fontSize: 10 }}>{c.region}</span>
        </td>
        <td onClick={(e) => e.stopPropagation()}>
          <PriceCell quote={quote} />
        </td>
        <td>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {c.pros.slice(0, 2).map((p, i) => (
              <span key={i} className="tag good" style={{ fontSize: 10, textTransform: "none", letterSpacing: 0 }}>{p}</span>
            ))}
            {c.pros.length > 2 && <span style={{ fontSize: 10, color: "var(--ink-3)" }}>+{c.pros.length - 2}</span>}
          </div>
        </td>
        <td>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {c.cons.slice(0, 1).map((con, i) => (
              <span key={i} className="tag warn" style={{ fontSize: 10, textTransform: "none", letterSpacing: 0 }}>{con}</span>
            ))}
            {c.cons.length > 1 && <span style={{ fontSize: 10, color: "var(--ink-3)" }}>+{c.cons.length - 1}</span>}
          </div>
        </td>
        <td style={{ fontSize: 12, color: "var(--ink-2)", maxWidth: 200 }}>
          <span style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {c.trend}
          </span>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={7} style={{ background: "var(--bg-soft)", padding: "14px 18px" }}>
            <div style={{ fontSize: 13, color: "var(--ink-2)", marginBottom: 10, lineHeight: 1.6 }}>
              <span className="eyebrow" style={{ marginRight: 8 }}>公司簡介</span>{c.profile}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <div className="eyebrow" style={{ marginBottom: 6 }}>求職優點</div>
                <ul style={{ margin: 0, paddingLeft: 16, fontSize: 13 }}>
                  {c.pros.map((p, i) => <li key={i}>{p}</li>)}
                </ul>
              </div>
              <div>
                <div className="eyebrow" style={{ marginBottom: 6 }}>求職缺點</div>
                <ul style={{ margin: 0, paddingLeft: 16, fontSize: 13 }}>
                  {c.cons.map((con, i) => <li key={i}>{con}</li>)}
                </ul>
              </div>
            </div>
            <FinancialsBlock company={c} financials={financials} />
            {/* Inline jobs list removed — clicking 工作機會 (N) now opens
                CompanyJobsModal which has paginated scoring + lock UX. */}
          </td>
        </tr>
      )}
    </>
  );
}

function FinancialsBlock({ company, financials }: { company: AiCompany; financials: QuarterlyFinancials | undefined }) {
  // Private company / no ticker → AI gave us no symbol to query
  if (!company.ticker) {
    return (
      <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
        <div className="eyebrow" style={{ marginBottom: 6 }}>最近財報</div>
        <div style={{ fontSize: 12, color: "var(--ink-3)" }}>
          未公開財報（私人公司）
        </div>
      </div>
    );
  }
  if (!financials) {
    return (
      <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
        <div className="eyebrow" style={{ marginBottom: 6 }}>最近財報</div>
        <div style={{ fontSize: 12, color: "var(--ink-3)" }}>
          載入中或暫無資料
        </div>
      </div>
    );
  }

  const niColor = financials.isProfit ? "#16a34a" : "#dc2626";
  return (
    <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span className="eyebrow">最近財報</span>
        <span style={{ fontSize: 11, color: "var(--ink-3)", fontFamily: "var(--font-mono)" }}>
          {financials.period} · 截止 {financials.endDate}
        </span>
        <span className="tag" style={{ fontSize: 10, color: niColor }}>
          {financials.isProfit ? "獲利" : "虧損"}
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <FinMetric
          label="營收"
          value={financials.revenue}
          currency={financials.currency}
          yoy={financials.yoyRevenuePct}
          qoq={financials.qoqRevenuePct}
        />
        <FinMetric
          label="淨利"
          value={financials.netIncome}
          currency={financials.currency}
          yoy={financials.yoyNetIncomePct}
          qoq={financials.qoqNetIncomePct}
          highlightSign
        />
      </div>
      <div style={{ marginTop: 6, fontSize: 10, color: "var(--ink-4)" }}>
        資料來源：Yahoo Finance · 每日更新
      </div>
    </div>
  );
}

function FinMetric({
  label, value, currency, yoy, qoq, highlightSign,
}: {
  label: string;
  value: number | null;
  currency: string | null;
  yoy: number | null;
  qoq: number | null;
  highlightSign?: boolean;
}) {
  const valueColor = highlightSign && value != null
    ? (value >= 0 ? "#16a34a" : "#dc2626")
    : "var(--ink-1)";
  const pctColor = (p: number | null) =>
    p == null ? "var(--ink-3)" : p > 0 ? "#16a34a" : p < 0 ? "#dc2626" : "var(--ink-3)";

  return (
    <div style={{ background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 6, padding: "10px 12px" }}>
      <div style={{ fontSize: 11, color: "var(--ink-3)", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "var(--font-mono)", color: valueColor }}>
        {fmtCompactMoney(value, currency)}
      </div>
      <div style={{ display: "flex", gap: 12, marginTop: 6, fontSize: 11, fontFamily: "var(--font-mono)" }}>
        <div>
          <span style={{ color: "var(--ink-3)" }}>YoY </span>
          <span style={{ color: pctColor(yoy), fontWeight: 600 }}>{fmtPct(yoy)}</span>
        </div>
        <div>
          <span style={{ color: "var(--ink-3)" }}>QoQ </span>
          <span style={{ color: pctColor(qoq), fontWeight: 600 }}>{fmtPct(qoq)}</span>
        </div>
      </div>
    </div>
  );
}
