"use client";
import { useState } from "react";
import useSWR from "swr";
import { INDUSTRIES } from "@/lib/mock-data";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface RealCompany {
  rank: number;
  name: string;
  ticker: string;
  jobCount: number;
  avgScore: number | null;
  locations: string;
  sampleTitles: string[];
}

export function IndustryView() {
  const [selectedIndustry, setSelectedIndustry] = useState(INDUSTRIES[0].id);

  const { data, isLoading } = useSWR<{ companies: RealCompany[] }>(
    `/api/industries?industry=${selectedIndustry}`,
    fetcher
  );

  const companies = data?.companies ?? [];

  return (
    <div className="app-content">
      <div className="section-h">
        <h3>產業 Top 100</h3>
        <span className="sub">依 AI 適配分數排序的頂尖雇主</span>
      </div>

      <div className="chips" style={{ marginBottom: 16 }}>
        {INDUSTRIES.map((ind) => (
          <span
            key={ind.id}
            className={`chip${selectedIndustry === ind.id ? " active" : ""}`}
            onClick={() => setSelectedIndustry(ind.id)}
          >
            {ind.name}
          </span>
        ))}
      </div>

      {isLoading && (
        <div style={{ textAlign: "center", padding: 40 }}><div className="spinner" /></div>
      )}

      {!isLoading && companies.length === 0 && (
        <div className="card" style={{ textAlign: "center", color: "var(--ink-3)", padding: 40 }}>
          此產業暫無職缺資料，請先更新職缺
        </div>
      )}

      {!isLoading && companies.length > 0 && (
        <div className="industry-table">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>公司</th>
                <th>職缺數</th>
                <th>平均適配</th>
                <th>地點</th>
                <th>代表職缺</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => (
                <CompanyRow key={c.name} company={c} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CompanyRow({ company: c }: { company: RealCompany }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <tr className="company-row" onClick={() => setExpanded((e) => !e)} style={{ cursor: "pointer" }}>
        <td style={{ fontFamily: "var(--font-mono)", color: "var(--ink-3)", fontSize: 12 }}>{c.rank}</td>
        <td>
          <div style={{ fontWeight: 600 }}>{c.name}</div>
          {c.ticker && c.ticker !== "—" && (
            <div style={{ fontSize: 11, color: "var(--ink-3)", fontFamily: "var(--font-mono)" }}>{c.ticker}</div>
          )}
        </td>
        <td style={{ fontFamily: "var(--font-mono)", fontSize: 13 }}>{c.jobCount}</td>
        <td>
          {c.avgScore != null ? (
            <span className={`score-pill ${c.avgScore >= 75 ? "high" : c.avgScore >= 50 ? "mid" : "low"}`} style={{ fontSize: 11 }}>
              {c.avgScore} 分
            </span>
          ) : <span style={{ color: "var(--ink-4)" }}>—</span>}
        </td>
        <td style={{ fontSize: 12, color: "var(--ink-2)" }}>{c.locations}</td>
        <td>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {c.sampleTitles.slice(0, 2).map((t, i) => (
              <span key={i} className="tag" style={{ fontSize: 10 }}>{t}</span>
            ))}
          </div>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={6} style={{ background: "var(--bg-soft)", padding: "12px 16px" }}>
            <div style={{ fontSize: 13, color: "var(--ink-2)" }}>
              <div className="eyebrow" style={{ marginBottom: 6 }}>所有代表職缺</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {c.sampleTitles.map((t, i) => <span key={i} className="tag">{t}</span>)}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
