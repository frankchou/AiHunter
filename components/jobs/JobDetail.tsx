"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { fmtSalary, sourceHost, relativeTime } from "@/lib/utils";
import { AD_DURATION_SEC } from "@/lib/plans";
import type { Job, Insight, CVTailor } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function JobDetail({ job }: { job: Job }) {
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const [generatingInsight, setGeneratingInsight] = useState(false);
  const [generatingCV, setGeneratingCV] = useState(false);
  const [tab, setTab] = useState<"overview" | "swot" | "risks" | "qa" | "cv">("overview");

  // Limit state — set when API returns 402
  const [insightLimit, setInsightLimit] = useState<{ planTier: string } | null>(null);
  const [cvLimit, setCvLimit] = useState<{ planTier: string } | null>(null);

  // Inline ad countdown
  const [adWatching, setAdWatching] = useState<"insight" | "cv" | null>(null);
  const [adCountdown, setAdCountdown] = useState(AD_DURATION_SEC);
  const adTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: insightData, mutate: mutateInsight } = useSWR<Insight & { id?: string }>(
    `/api/jobs/${job.id}/insights`,
    fetcher,
    { revalidateOnFocus: false }
  );
  const { data: cvData, mutate: mutateCV } = useSWR<CVTailor & { id?: string }>(
    `/api/jobs/${job.id}/cv`,
    fetcher,
    { revalidateOnFocus: false }
  );
  const { data: savedData } = useSWR<{ saved: boolean }>(
    `/api/saved/check?jobId=${job.id}`,
    fetcher,
    { revalidateOnFocus: false }
  );

  useEffect(() => {
    if (savedData?.saved != null) setSaved(savedData.saved);
  }, [savedData]);

  useEffect(() => () => { if (adTimerRef.current) clearInterval(adTimerRef.current); }, []);

  const insight: (Insight & { id?: string }) | null = insightData?.id ? insightData : null;
  const cv: (CVTailor & { id?: string }) | null = cvData?.id ? cvData : null;

  const generateInsight = async () => {
    setGeneratingInsight(true);
    setInsightLimit(null);
    try {
      const res = await fetch(`/api/jobs/${job.id}/insights`, { method: "POST" });
      if (res.status === 402) {
        const { planTier } = await res.json();
        setInsightLimit({ planTier });
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
        const { planTier } = await res.json();
        setCvLimit({ planTier });
        return;
      }
      await mutateCV(await res.json());
    } finally {
      setGeneratingCV(false);
    }
  };

  const startAd = (feature: "insight" | "cv") => {
    setAdWatching(feature);
    setAdCountdown(AD_DURATION_SEC);
    adTimerRef.current = setInterval(() => {
      setAdCountdown((c) => {
        if (c <= 1) {
          clearInterval(adTimerRef.current!);
          handleAdComplete(feature);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  };

  const handleAdComplete = async (feature: "insight" | "cv") => {
    // In production: replace with real ad SDK verification token
    await fetch("/api/ads/unlock", { method: "POST" });
    setAdWatching(null);
    if (feature === "insight") generateInsight();
    else generateCV();
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
                countdown={adCountdown}
                onGenerate={generateInsight}
                onWatchAd={() => startAd("insight")}
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
                loading={generatingInsight}
                limit={insightLimit}
                watching={adWatching === "insight"}
                countdown={adCountdown}
                onGenerate={generateInsight}
                onWatchAd={() => startAd("insight")}
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
                loading={generatingInsight}
                limit={insightLimit}
                watching={adWatching === "insight"}
                countdown={adCountdown}
                onGenerate={generateInsight}
                onWatchAd={() => startAd("insight")}
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
                loading={generatingInsight}
                limit={insightLimit}
                watching={adWatching === "insight"}
                countdown={adCountdown}
                onGenerate={generateInsight}
                onWatchAd={() => startAd("insight")}
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
                loading={generatingCV}
                limit={cvLimit}
                watching={adWatching === "cv"}
                countdown={adCountdown}
                onGenerate={generateCV}
                onWatchAd={() => startAd("cv")}
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

// ── Shared ad/limit UI pieces ─────────────────────────────────────────

interface GateProps {
  loading: boolean;
  limit: { planTier: string } | null;
  watching: boolean;
  countdown: number;
  onGenerate: () => void;
  onWatchAd: () => void;
}

function AdCountdownBar({ countdown }: { countdown: number }) {
  const pct = Math.round((countdown / AD_DURATION_SEC) * 100);
  return (
    <div style={{ background: "var(--bg-soft)", border: "1px solid var(--line)", borderRadius: 8, padding: "14px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontSize: 13, color: "var(--ink-2)" }}>廣告播放中，請稍候…</span>
        <span style={{ fontWeight: 700, fontSize: 18, color: "var(--primary)", minWidth: 32, textAlign: "right" }}>{countdown}s</span>
      </div>
      <div style={{ height: 4, background: "var(--line)", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: "var(--primary)", transition: "width 1s linear", borderRadius: 2 }} />
      </div>
      <div style={{ fontSize: 11, color: "var(--ink-4)", marginTop: 6 }}>觀看廣告以支持服務運營，完成後自動解鎖 1 次</div>
    </div>
  );
}

function LimitActions({ planTier, onWatchAd }: { planTier: string; onWatchAd: () => void }) {
  const isFree = planTier === "free";
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      {isFree && (
        <button className="btn primary" onClick={onWatchAd} style={{ fontSize: 13 }}>
          📺 看廣告解鎖 1 次（免費）
        </button>
      )}
      <a className="btn" href="/pricing" style={{ fontSize: 13 }}>
        🚀 升級方案
      </a>
    </div>
  );
}

// Inline generate block for the overview tab
function InsightGate({ loading, limit, watching, countdown, onGenerate, onWatchAd }: GateProps) {
  if (watching) return (
    <div style={{ marginBottom: 16 }}>
      <AdCountdownBar countdown={countdown} />
    </div>
  );

  if (limit) return (
    <div style={{ marginBottom: 16, padding: "14px 16px", background: "oklch(98% .02 30)", border: "1px solid oklch(88% .06 30)", borderRadius: 8 }}>
      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6, color: "oklch(40% .12 30)" }}>本月 AI 分析次數已用完</div>
      <div style={{ fontSize: 12, color: "var(--ink-3)", marginBottom: 10 }}>看廣告可獲得 1 次免費使用，可重複觀看</div>
      <LimitActions planTier={limit.planTier} onWatchAd={onWatchAd} />
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

// Centered generate prompt for other tabs (SWOT / Risks / QA)
function GeneratePrompt({ loading, limit, watching, countdown, onGenerate, onWatchAd }: GateProps) {
  if (watching) return (
    <div style={{ padding: "16px 0" }}>
      <AdCountdownBar countdown={countdown} />
    </div>
  );

  if (limit) return (
    <div style={{ textAlign: "center", padding: "32px 16px" }}>
      <div style={{ fontSize: 32, marginBottom: 10 }}>⏳</div>
      <div style={{ fontWeight: 600, marginBottom: 4, color: "var(--ink)" }}>本月次數已用完</div>
      <div style={{ fontSize: 13, color: "var(--ink-3)", marginBottom: 16 }}>看廣告可獲得 1 次免費使用，可重複觀看</div>
      <LimitActions planTier={limit.planTier} onWatchAd={onWatchAd} />
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

// CV tab gate
function CVGate({ loading, limit, watching, countdown, onGenerate, onWatchAd }: GateProps) {
  if (watching) return (
    <div style={{ marginBottom: 16 }}>
      <AdCountdownBar countdown={countdown} />
    </div>
  );

  if (limit) return (
    <div style={{ marginBottom: 16, padding: "14px 16px", background: "oklch(98% .02 30)", border: "1px solid oklch(88% .06 30)", borderRadius: 8 }}>
      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6, color: "oklch(40% .12 30)" }}>本月 CV 客製次數已用完</div>
      <div style={{ fontSize: 12, color: "var(--ink-3)", marginBottom: 10 }}>看廣告可獲得 1 次免費使用，可重複觀看</div>
      <LimitActions planTier={limit.planTier} onWatchAd={onWatchAd} />
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
