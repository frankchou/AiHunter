"use client";
import { useState } from "react";
import useSWR from "swr";
import { INDUSTRIES } from "@/lib/mock-data";
import type { IndustryCompany } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function IndustryView() {
  const [selectedIndustry, setSelectedIndustry] = useState(INDUSTRIES[0].id);

  const { data: companies = [], isLoading } = useSWR<IndustryCompany[]>(
    `/api/industries?industry=${selectedIndustry}`,
    fetcher
  );

  return (
    <div className="app-content">
      <div className="section-h">
        <h3>產業 Top 100</h3>
        <span className="sub">AI 彙整各產業頂尖雇主，點擊查看詳情</span>
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
        <div style={{ textAlign: "center", padding: 40 }}>
          <div className="spinner" />
        </div>
      )}

      {!isLoading && companies.length === 0 && (
        <div className="card" style={{ textAlign: "center", color: "var(--ink-3)", padding: 40 }}>
          此產業暫無資料
        </div>
      )}

      {!isLoading && companies.length > 0 && (
        <div className="industry-table">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>公司</th>
                <th>優點</th>
                <th>缺點</th>
                <th>股票</th>
                <th>近況</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((c, i) => (
                <CompanyRow key={c.name} rank={i + 1} company={c} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CompanyRow({ rank, company }: { rank: number; company: IndustryCompany }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <tr
        className="company-row"
        onClick={() => setExpanded((e) => !e)}
        style={{ cursor: "pointer" }}
      >
        <td style={{ fontFamily: "var(--font-mono)", color: "var(--ink-3)", fontSize: 12 }}>
          {rank}
        </td>
        <td>
          <div style={{ fontWeight: 600 }}>{company.name}</div>
          {company.ticker && (
            <div style={{ fontSize: 11, color: "var(--ink-3)", fontFamily: "var(--font-mono)" }}>
              {company.ticker}
            </div>
          )}
        </td>
        <td>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {company.pros.slice(0, 2).map((p, i) => (
              <span key={i} className="tag good" style={{ fontSize: 10 }}>{p}</span>
            ))}
            {company.pros.length > 2 && (
              <span style={{ fontSize: 10, color: "var(--ink-3)" }}>+{company.pros.length - 2}</span>
            )}
          </div>
        </td>
        <td>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {company.cons.slice(0, 2).map((c, i) => (
              <span key={i} className="tag warn" style={{ fontSize: 10 }}>{c}</span>
            ))}
            {company.cons.length > 2 && (
              <span style={{ fontSize: 10, color: "var(--ink-3)" }}>+{company.cons.length - 2}</span>
            )}
          </div>
        </td>
        <td>
          {company.ticker ? (
            <span
              className={`tag ${(company.d1 ?? 0) > 0 ? "good" : (company.d1 ?? 0) < 0 ? "bad" : ""}`}
              style={{ fontSize: 11, fontFamily: "var(--font-mono)" }}
            >
              {(company.d1 ?? 0) > 0 ? "↑" : (company.d1 ?? 0) < 0 ? "↓" : "→"}{" "}
              {company.ticker}
            </span>
          ) : (
            <span style={{ color: "var(--ink-4)", fontSize: 11 }}>—</span>
          )}
        </td>
        <td style={{ fontSize: 12, color: "var(--ink-2)", maxWidth: 200 }}>
          {company.trend ? (
            <span style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
              {company.trend}
            </span>
          ) : "—"}
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={6} style={{ background: "var(--bg-soft)", padding: "12px 16px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, fontSize: 13 }}>
              <div>
                <div className="eyebrow" style={{ marginBottom: 6 }}>優點</div>
                <ul style={{ margin: 0, paddingLeft: 16 }}>
                  {company.pros.map((p, i) => <li key={i}>{p}</li>)}
                </ul>
              </div>
              <div>
                <div className="eyebrow" style={{ marginBottom: 6 }}>缺點</div>
                <ul style={{ margin: 0, paddingLeft: 16 }}>
                  {company.cons.map((c, i) => <li key={i}>{c}</li>)}
                </ul>
              </div>
            </div>
            {company.profile && (
              <div style={{ marginTop: 12 }}>
                <div className="eyebrow" style={{ marginBottom: 4 }}>公司簡介</div>
                <div style={{ fontSize: 13, color: "var(--ink-2)" }}>{company.profile}</div>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
