"use client";
import { useState } from "react";
import useSWR from "swr";
import { INDUSTRIES } from "@/lib/mock-data";

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
}

export function IndustryView() {
  const [selectedIndustry, setSelectedIndustry] = useState(INDUSTRIES[0].id);
  const [refreshKey, setRefreshKey] = useState(0);

  const { data, isLoading } = useSWR<{ companies: AiCompany[]; cached: boolean }>(
    `/api/industries?industry=${selectedIndustry}&_r=${refreshKey}`,
    fetcher,
    { revalidateOnFocus: false }
  );

  const companies = data?.companies ?? [];

  return (
    <div className="app-content">
      <div className="section-h">
        <h3>產業 Top 100</h3>
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
            onClick={() => setSelectedIndustry(ind.id)}>
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
                <th>#</th>
                <th>公司</th>
                <th>地區</th>
                <th>求職優點</th>
                <th>求職缺點</th>
                <th>未來趨勢</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => <CompanyRow key={c.name} company={c} />)}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CompanyRow({ company: c }: { company: AiCompany }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <tr className="company-row" onClick={() => setExpanded((e) => !e)} style={{ cursor: "pointer" }}>
        <td style={{ fontFamily: "var(--font-mono)", color: "var(--ink-3)", fontSize: 12 }}>{c.rank}</td>
        <td>
          <div style={{ fontWeight: 600 }}>{c.name}</div>
          {c.ticker && <div style={{ fontSize: 11, color: "var(--ink-3)", fontFamily: "var(--font-mono)" }}>{c.ticker}</div>}
        </td>
        <td>
          <span className="tag" style={{ fontSize: 10 }}>{c.region}</span>
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
        <td style={{ fontSize: 12, color: "var(--ink-2)", maxWidth: 220 }}>
          <span style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {c.trend}
          </span>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={6} style={{ background: "var(--bg-soft)", padding: "14px 18px" }}>
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
          </td>
        </tr>
      )}
    </>
  );
}
