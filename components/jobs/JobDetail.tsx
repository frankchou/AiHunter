"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import useSWR, { mutate as globalMutate } from "swr";
import { fmtSalary, sourceHost, relativeTime } from "@/lib/utils";
import type { Job, Insight, CVTailor } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function JobDetail({ job }: { job: Job }) {
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [tab, setTab] = useState<"strategy" | "risks" | "qa" | "cv">("strategy");

  const { data: insightData, mutate: mutateInsight } = useSWR<Insight & { id?: string }>(
    `/api/jobs/${job.id}/insights`,
    fetcher
  );
  const { data: cvData, mutate: mutateCV } = useSWR<CVTailor & { id?: string }>(
    `/api/jobs/${job.id}/cv`,
    fetcher
  );

  const insight = insightData?.id ? insightData : null;
  const cv = cvData?.id ? cvData : null;

  const handleSave = async () => {
    setSaved((s) => !s);
    if (!saved) {
      await fetch("/api/saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job.id }),
      });
      // Generate insights on save
      setGenerating(true);
      try {
        await Promise.all([
          fetch(`/api/jobs/${job.id}/insights`, { method: "POST" }).then((r) => r.json()).then((d) => mutateInsight(d)),
          fetch(`/api/jobs/${job.id}/cv`, { method: "POST" }).then((r) => r.json()).then((d) => mutateCV(d)),
        ]);
      } finally {
        setGenerating(false);
      }
    } else {
      await fetch("/api/saved", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job.id }),
      });
    }
  };

  return (
    <div className="app-content">
      <button className="btn" onClick={() => router.back()} style={{ marginBottom: 14 }}>← 回職缺流</button>

      <div className="detail">
        {/* Header */}
        <div>
          <h2 style={{ border: "none", padding: 0, margin: 0, fontSize: 22 }}>{job.title}</h2>
          <div style={{ color: "var(--ink-2)", fontSize: 14, marginTop: 4 }}>
            {job.company} · {job.city}, {job.country} · {job.remote}
          </div>
          <div className="job-meta" style={{ marginTop: 8 }}>
            <span>💼 {job.type}</span>
            <span>💰 {fmtSalary(job)}</span>
            {(job.yearsMin || job.yearsMax) && <span>👤 {job.yearsMin}–{job.yearsMax} yr</span>}
            <span>🕐 {relativeTime(job.postedAt ?? null)}</span>
            {job.score != null && <span>🎯 匹配 {Math.round(job.score * 100)}</span>}
          </div>
          <div className="source-line" style={{ marginTop: 10 }}>
            <span>來源: {sourceHost(job.sourceUrl)}</span>
            <a href={job.sourceUrl} target="_blank" rel="noopener noreferrer">查看原文 ↗</a>
            <span className="tag good">原始連結</span>
          </div>

          {/* AI match analysis */}
          {job.score != null && job.matchReasons.length > 0 && (
            <div style={{ marginTop: 14, background: "oklch(95% .04 235)", border: "1px solid oklch(85% .06 235)", borderRadius: 8, padding: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "oklch(45% .1 235)", marginBottom: 8, textTransform: "uppercase" }}>AI 適配分析</div>
              <ul style={{ margin: 0, padding: "0 0 0 16px", fontSize: 13, color: "var(--ink-2)", lineHeight: 1.7 }}>
                {job.matchReasons.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </div>
          )}

          {/* Job description */}
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "var(--ink-3)", marginBottom: 6, textTransform: "uppercase" }}>職缺描述 JD</div>
            <div style={{ background: "var(--bg-soft)", borderRadius: 8, padding: 14, fontSize: 13, color: "var(--ink-2)", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
              {job.description || "（無職缺描述）"}
            </div>
          </div>

          <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className={`btn star${saved ? " on" : ""}`} onClick={handleSave} disabled={generating}>
              {generating
                ? <><span className="spinner" style={{ width: 12, height: 12 }} /> 生成分析中…</>
                : saved ? "★ 已收藏 — 面試策略已生成" : "☆ 收藏並生成面試策略"}
            </button>
            <a className="btn primary" href={job.sourceUrl} target="_blank" rel="noopener noreferrer">
              前往原始職缺 ↗
            </a>
          </div>
        </div>

        {/* Callout when not saved */}
        {!saved && !insight && (
          <div className="callout">
            點擊「收藏」即觸發 Agent: SWOT 分析、風險清單、面經彙整、CV 客製版，通常 ≤ 30 秒完成。
          </div>
        )}

        {/* Insights tabs */}
        {insight && (
          <>
            <div className="tab-nav">
              {([["strategy","面試策略 / SWOT"],["risks","風險"],["qa","面經 / 題庫"],["cv","CV 客製版"]] as const).map(([k,l]) => (
                <button key={k} className={`tab-btn${tab === k ? " active" : ""}`} onClick={() => setTab(k)}>{l}</button>
              ))}
            </div>

            {tab === "strategy" && (
              <div>
                <div className="swot">
                  <div className="quad S"><h4>Strengths</h4><ul>{insight.swot.S.map((s,i) => <li key={i}>{s}</li>)}</ul></div>
                  <div className="quad W"><h4>Weaknesses</h4><ul>{insight.swot.W.map((s,i) => <li key={i}>{s}</li>)}</ul></div>
                  <div className="quad O"><h4>Opportunities</h4><ul>{insight.swot.O.map((s,i) => <li key={i}>{s}</li>)}</ul></div>
                  <div className="quad T"><h4>Threats</h4><ul>{insight.swot.T.map((s,i) => <li key={i}>{s}</li>)}</ul></div>
                </div>
                <div style={{ marginTop: 14 }}>
                  <div className="eyebrow">建議策略</div>
                  <p style={{ fontSize: 13.5 }}>{insight.strategy}</p>
                </div>
              </div>
            )}

            {tab === "risks" && (
              <div className="risks">
                {insight.risks.map((r, i) => (
                  <div className="risk" key={i}>
                    <div><div className="lbl">{r.label}</div><span className={`sev ${r.severity}`}>{r.severity}</span></div>
                    <div style={{ color: "var(--ink-2)" }}>{r.note}</div>
                  </div>
                ))}
              </div>
            )}

            {tab === "qa" && (
              <div>
                <div className="eyebrow" style={{ marginBottom: 6 }}>常見題目 / 回答骨架</div>
                <div className="qa-list">
                  {insight.questions.map((qa, i) => (
                    <div className="qa" key={i}>
                      <div className="q">Q{i + 1}. {qa.q}</div>
                      <div className="a">骨架: {qa.outline}</div>
                    </div>
                  ))}
                </div>
                {insight.refs.length > 0 && (
                  <>
                    <div className="eyebrow" style={{ marginTop: 14, marginBottom: 6 }}>外部資料 / 面經</div>
                    <div className="refs-list">
                      {insight.refs.map((r, i) => (
                        <a key={i} href={r.url} target="_blank" rel="noopener noreferrer">
                          <span className="ref-source">[{r.source}]</span>
                          <span style={{ color: "var(--ink)" }}>{r.title}</span>
                          <span style={{ marginLeft: "auto" }}>↗</span>
                        </a>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {tab === "cv" && cv && (
              <div>
                <div className="callout">{cv.diffNote}</div>
                <div style={{ marginTop: 12 }}>
                  <div className="eyebrow">Summary</div>
                  <div className="diff-block">
                    <div className="diff-side before"><div className="lbl">Before</div>{cv.summary.before}</div>
                    <div className="diff-side after"><div className="lbl">After</div>{cv.summary.after}</div>
                  </div>
                </div>
                {(cv.bullets as { before: string; after: string }[]).map((b, i) => (
                  <div key={i}>
                    <div className="eyebrow">Bullet {i + 1}</div>
                    <div className="diff-block">
                      <div className="diff-side before"><div className="lbl">Before</div>{b.before}</div>
                      <div className="diff-side after"><div className="lbl">After</div>{b.after}</div>
                    </div>
                  </div>
                ))}
                <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                  <button className="btn primary" onClick={() => window.print()}>列印 / 下載 PDF</button>
                  <button className="btn">駁回</button>
                </div>
              </div>
            )}

            {tab === "cv" && !cv && (
              <div style={{ textAlign: "center", padding: 24, color: "var(--ink-3)" }}>
                {generating ? <><div className="spinner" style={{ margin: "0 auto 8px" }} /><div>生成 CV 客製版中…</div></> : "尚未生成"}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
