"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { fmtSalary, sourceHost, relativeTime } from "@/lib/utils";
import { AdWatcher } from "@/components/subscription/AdWatcher";
import type { Job, Insight, CVTailor } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface LimitInfo { planTier: string; tickets: number; adSessionsLeft: number }

export function JobDetail({ job }: { job: Job }) {
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const [generatingInsight, setGeneratingInsight] = useState(false);
  const [generatingCV, setGeneratingCV] = useState(false);
  const [tab, setTab] = useState<"overview" | "swot" | "risks" | "qa" | "cv">("overview");

  const [insightLimit, setInsightLimit] = useState<LimitInfo | null>(null);
  const [cvLimit, setCvLimit]           = useState<LimitInfo | null>(null);
  const [adWatching, setAdWatching]     = useState<"insight" | "cv" | null>(null);

  const { data: insightData, mutate: mutateInsight } = useSWR<Insight & { id?: string }>(
    `/api/jobs/${job.id}/insights`, fetcher, { revalidateOnFocus: false }
  );
  const { data: cvData, mutate: mutateCV } = useSWR<CVTailor & { id?: string }>(
    `/api/jobs/${job.id}/cv`, fetcher, { revalidateOnFocus: false }
  );
  const { data: savedData } = useSWR<{ saved: boolean }>(
    `/api/saved/check?jobId=${job.id}`, fetcher, { revalidateOnFocus: false }
  );

  useEffect(() => {
    if (savedData?.saved != null) setSaved(savedData.saved);
  }, [savedData]);

  const insight: (Insight & { id?: string }) | null = insightData?.id ? insightData : null;
  const cv: (CVTailor & { id?: string }) | null = cvData?.id ? cvData : null;

  const generateInsight = async () => {
    setGeneratingInsight(true);
    setInsightLimit(null);
    try {
      const res = await fetch(`/api/jobs/${job.id}/insights`, { method: "POST" });
      if (res.status === 402) {
        const data = await res.json();
        setInsightLimit(data);
        return;
      }
      await mutateInsight(await res.json());
      setTab("overview");
    } finally {
      setGeneratingInsight(false);
    }
  };

  const generateCV = async () => {
    setGeneratingCV(true);
    setCvLimit(null);
    try {
      const res = await fetch(`/api/jobs/${job.id}/cv`, { method: "POST" });
      if (res.status === 402) {
        const data = await res.json();
        setCvLimit(data);
        return;
      }
      await mutateCV(await res.json());
    } finally {
      setGeneratingCV(false);
    }
  };

  const handleSave = async () => {
    const next = !saved;
    setSaved(next);
    await fetch("/api/saved", {
      method: next ? "POST" : "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId: job.id }),
    });
  };

  const scorePct = job.score != null ? Math.round(job.score * 100) : null;
  const scoreClass = scorePct == null ? "pending" : scorePct >= 75 ? "high" : scorePct >= 50 ? "mid" : "low";

  return (
    <div className="app-content">
      <button className="btn" onClick={() => router.back()} style={{ marginBottom: 14 }}>← 回職缺流</button>

      <div className="detail">
        {/* ── Header ── */}
        <div>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div style={{ flex: 1 }}>
              <h2 style={{ border: "none", padding: 0, margin: 0, fontSize: 22 }}>{job.title}</h2>
              <div style={{ color: "var(--ink-2)", fontSize: 14, marginTop: 4 }}>
                {job.company} · {job.city}, {job.country} · {job.remote}
              </div>
            </div>
            <span className={`score-pill ${scoreClass}`} style={{ fontSize: 14, padding: "6px 16px" }}>
              {scorePct != null ? `${scorePct} 分` : "— 分"}
            </span>
          </div>

          <div className="job-meta" style={{ marginTop: 10 }}>
            <span>💼 {job.type}</span>
            <span>💰 {fmtSalary(job)}</span>
            {(job.yearsMin || job.yearsMax) && <span>👤 {job.yearsMin}–{job.yearsMax} yr</span>}
            <span>🕐 {relativeTime(job.postedAt ?? null)}</span>
          </div>

          <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className={`btn star${saved ? " on" : ""}`} onClick={handleSave}>
              {saved ? "★ 已收藏" : "☆ 收藏"}
            </button>
            <a className="btn primary" href={job.sourceUrl} target="_blank" rel="noopener noreferrer">
              前往原始職缺 ↗
            </a>
            <a className="btn" href={job.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12 }}>
              {sourceHost(job.sourceUrl)} ↗
            </a>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="tab-nav" style={{ marginTop: 20 }}>
          {([
            ["overview", "概覽 / JD"],
            ["swot", "SWOT 分析"],
            ["risks", "風險評估"],
            ["qa", "面試準備"],
            ["cv", "CV 客製"],
          ] as const).map(([k, l]) => (
            <button key={k} className={`tab-btn${tab === k ? " active" : ""}`} onClick={() => setTab(k)}>{l}</button>
          ))}
        </div>

        {/* ── Overview Tab ── */}
        {tab === "overview" && (
          <div>
            {job.matchReasons.length > 0 && (
              <div style={{ marginBottom: 16, background: "oklch(95% .04 235)", border: "1px solid oklch(85% .06 235)", borderRadius: 8, padding: 14 }}>
                <div className="eyebrow" style={{ color: "oklch(45% .1 235)", marginBottom: 8 }}>AI 適配分數解析</div>
                <ul style={{ margin: 0, padding: "0 0 0 16px", fontSize: 13, color: "var(--ink-2)", lineHeight: 1.8 }}>
                  {job.matchReasons.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              </div>
            )}

            {insight?.companyTrend && (
              <div style={{ marginBottom: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={{ background: "var(--bg-soft)", borderRadius: 8, padding: 14 }}>
                  <div className="eyebrow" style={{ marginBottom: 6 }}>公司趨勢</div>
                  <p style={{ margin: 0, fontSize: 13, color: "var(--ink-2)", lineHeight: 1.6 }}>{insight.companyTrend}</p>
                </div>
                <div style={{ background: "var(--bg-soft)", borderRadius: 8, padding: 14 }}>
                  <div className="eyebrow" style={{ marginBottom: 6 }}>產業趨勢</div>
                  <p style={{ margin: 0, fontSize: 13, color: "var(--ink-2)", lineHeight: 1.6 }}>{insight.industryTrend}</p>
                </div>
              </div>
            )}

            {!insight && (
              <InsightGate
                loading={generatingInsight}
                limit={insightLimit}
                watching={adWatching === "insight"}
                onGenerate={generateInsight}
                onWatchAd={() => setAdWatching("insight")}
                onAdComplete={() => { setAdWatching(null); generateInsight(); }}
                onAdCancel={() => setAdWatching(null)}
              />
            )}

            <div className="eyebrow" style={{ marginBottom: 6 }}>職缺描述 JD</div>
            <div style={{ background: "var(--bg-soft)", borderRadius: 8, padding: 14, fontSize: 13, color: "var(--ink-2)", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
              {job.description || "（無職缺描述）"}
            </div>
          </div>
        )}

        {/* ── SWOT Tab ── */}
        {tab === "swot" && (
          <div>
            {!insight && (
              <GeneratePrompt
                loading={generatingInsight} limit={insightLimit}
                watching={adWatching === "insight"}
                onGenerate={generateInsight}
                onWatchAd={() => setAdWatching("insight")}
                onAdComplete={() => { setAdWatching(null); generateInsight(); }}
                onAdCancel={() => setAdWatching(null)}
              />
            )}
            {insight && (
              <>
                <div style={{ marginBottom: 14, padding: "12px 14px", background: "var(--bg-soft)", borderRadius: 8, fontSize: 13, color: "var(--ink-2)", lineHeight: 1.6 }}>
                  <span style={{ fontWeight: 600, color: "var(--ink)", marginRight: 8 }}>投遞建議</span>{insight.strategy}
                </div>
                <div className="swot">
                  <div className="quad S"><h4>優勢 S</h4><ul>{insight.swot.S.map((s, i) => <li key={i}>{s}</li>)}</ul></div>
                  <div className="quad W"><h4>弱點 W</h4><ul>{insight.swot.W.map((s, i) => <li key={i}>{s}</li>)}</ul></div>
                  <div className="quad O"><h4>機會 O</h4><ul>{insight.swot.O.map((s, i) => <li key={i}>{s}</li>)}</ul></div>
                  <div className="quad T"><h4>威脅 T</h4><ul>{insight.swot.T.map((s, i) => <li key={i}>{s}</li>)}</ul></div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Risks Tab ── */}
        {tab === "risks" && (
          <div>
            {!insight && (
              <GeneratePrompt
                loading={generatingInsight} limit={insightLimit}
                watching={adWatching === "insight"}
                onGenerate={generateInsight}
                onWatchAd={() => setAdWatching("insight")}
                onAdComplete={() => { setAdWatching(null); generateInsight(); }}
                onAdCancel={() => setAdWatching(null)}
              />
            )}
            {insight && (
              <div className="risks">
                {insight.risks.map((r, i) => (
                  <div className="risk" key={i}>
                    <div><div className="lbl">{r.label}</div><span className={`sev ${r.severity}`}>{r.severity}</span></div>
                    <div style={{ color: "var(--ink-2)" }}>{r.note}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── QA Tab ── */}
        {tab === "qa" && (
          <div>
            {!insight && (
              <GeneratePrompt
                loading={generatingInsight} limit={insightLimit}
                watching={adWatching === "insight"}
                onGenerate={generateInsight}
                onWatchAd={() => setAdWatching("insight")}
                onAdComplete={() => { setAdWatching(null); generateInsight(); }}
                onAdCancel={() => setAdWatching(null)}
              />
            )}
            {insight && (
              <>
                <div className="eyebrow" style={{ marginBottom: 10 }}>常見面試題 / 回答骨架</div>
                <div className="qa-list">
                  {insight.questions.map((qa, i) => (
                    <div className="qa" key={i}>
                      <div className="q">Q{i + 1}. {qa.q}</div>
                      <div className="a">骨架: {qa.outline}</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── CV Tab ── */}
        {tab === "cv" && (
          <div>
            {!cv && (
              <CVGate
                loading={generatingCV} limit={cvLimit}
                watching={adWatching === "cv"}
                onGenerate={generateCV}
                onWatchAd={() => setAdWatching("cv")}
                onAdComplete={() => { setAdWatching(null); generateCV(); }}
                onAdCancel={() => setAdWatching(null)}
              />
            )}
            {cv && (
              <>
                <div className="callout">{cv.diffNote}</div>
                <div style={{ marginTop: 12 }}>
                  <div className="eyebrow">Summary</div>
                  <div className="diff-block">
                    <div className="diff-side before"><div className="lbl">Before</div>{cv.summary.before}</div>
                    <div className="diff-side after"><div className="lbl">After</div>{cv.summary.after}</div>
                  </div>
                </div>
                {(cv.bullets as { before: string; after: string }[]).map((b, i) => (
                  <div key={i} style={{ marginTop: 12 }}>
                    <div className="eyebrow">Bullet {i + 1}</div>
                    <div className="diff-block">
                      <div className="diff-side before"><div className="lbl">Before</div>{b.before}</div>
                      <div className="diff-side after"><div className="lbl">After</div>{b.after}</div>
                    </div>
                  </div>
                ))}
                <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
                  <button className="btn primary" onClick={() => window.print()}>列印 / 下載 PDF</button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Shared gate UI pieces ─────────────────────────────────────────────────────

interface GateProps {
  loading: boolean;
  limit: LimitInfo | null;
  watching: boolean;
  onGenerate: () => void;
  onWatchAd: () => void;
  onAdComplete: () => void;
  onAdCancel: () => void;
}

function LimitBanner({ limit, onWatchAd, onAdComplete, onAdCancel, watching, ticketCost = 1 }: {
  limit: LimitInfo; watching: boolean; ticketCost?: number;
  onWatchAd: () => void; onAdComplete: () => void; onAdCancel: () => void;
}) {
  if (watching) return <AdWatcher ticketCost={ticketCost} onComplete={onAdComplete} onCancel={onAdCancel} />;

  return (
    <div style={{ padding: "14px 16px", background: "oklch(98% .02 30)", border: "1px solid oklch(88% .06 30)", borderRadius: 8 }}>
      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4, color: "oklch(40% .12 30)" }}>
        本月次數已用完
      </div>
      <div style={{ fontSize: 12, color: "var(--ink-3)", marginBottom: 6 }}>
        解析券：<b>{limit.tickets}</b> 張
        {limit.planTier === "free" && <>　·　本月廣告解鎖剩餘：<b>{limit.adSessionsLeft}</b> 次</>}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {limit.planTier === "free" && limit.adSessionsLeft > 0 && (
          <button className="btn primary" onClick={onWatchAd} style={{ fontSize: 13 }}>
            📺 看廣告獲得 +{ticketCost} 解析券
          </button>
        )}
        {limit.tickets >= ticketCost && limit.adSessionsLeft === 0 && (
          <button className="btn primary" onClick={onAdComplete} style={{ fontSize: 13 }}>
            使用 {ticketCost} 張解析券
          </button>
        )}
        <a className="btn" href="/pricing" style={{ fontSize: 13 }}>🚀 升級方案</a>
      </div>
    </div>
  );
}

function InsightGate({ loading, limit, watching, onGenerate, onWatchAd, onAdComplete, onAdCancel }: GateProps) {
  if (limit) return (
    <div style={{ marginBottom: 16 }}>
      <LimitBanner limit={limit} watching={watching} ticketCost={1}
        onWatchAd={onWatchAd} onAdComplete={onAdComplete} onAdCancel={onAdCancel} />
    </div>
  );
  return (
    <div style={{ marginBottom: 16, padding: "14px 16px", background: "var(--bg-soft)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
      <div>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>AI 深度分析</div>
        <div style={{ fontSize: 12, color: "var(--ink-3)" }}>產業趨勢 · 公司展望 · SWOT · 面試準備 · CV 建議</div>
      </div>
      <button className="btn primary" onClick={onGenerate} disabled={loading} style={{ whiteSpace: "nowrap" }}>
        {loading ? <><span className="spinner" style={{ width: 12, height: 12 }} /> 分析中…</> : "生成 AI 分析"}
      </button>
    </div>
  );
}

function GeneratePrompt({ loading, limit, watching, onGenerate, onWatchAd, onAdComplete, onAdCancel }: GateProps) {
  if (limit) return (
    <div style={{ padding: "16px 0" }}>
      <LimitBanner limit={limit} watching={watching} ticketCost={1}
        onWatchAd={onWatchAd} onAdComplete={onAdComplete} onAdCancel={onAdCancel} />
    </div>
  );
  return (
    <div style={{ textAlign: "center", padding: "32px 16px", color: "var(--ink-3)" }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>🤖</div>
      <div style={{ fontWeight: 600, marginBottom: 6, color: "var(--ink)" }}>尚未生成 AI 分析</div>
      <div style={{ fontSize: 13, marginBottom: 16 }}>點擊「生成 AI 分析」後所有分頁同時解鎖</div>
      <button className="btn primary" onClick={onGenerate} disabled={loading}>
        {loading ? <><span className="spinner" style={{ width: 12, height: 12 }} /> 分析中…</> : "生成 AI 分析"}
      </button>
    </div>
  );
}

function CVGate({ loading, limit, watching, onGenerate, onWatchAd, onAdComplete, onAdCancel }: GateProps) {
  if (limit) return (
    <div style={{ marginBottom: 16 }}>
      <LimitBanner limit={limit} watching={watching} ticketCost={1}
        onWatchAd={onWatchAd} onAdComplete={onAdComplete} onAdCancel={onAdCancel} />
    </div>
  );
  return (
    <div style={{ marginBottom: 16, padding: "14px 16px", background: "var(--bg-soft)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <div style={{ fontSize: 13, color: "var(--ink-2)" }}>根據此職缺 JD，AI 將協助客製化你的履歷摘要與重點</div>
      <button className="btn primary" onClick={onGenerate} disabled={loading} style={{ whiteSpace: "nowrap" }}>
        {loading ? <><span className="spinner" style={{ width: 12, height: 12 }} /> 生成中…</> : "生成 CV 客製版"}
      </button>
    </div>
  );
}
