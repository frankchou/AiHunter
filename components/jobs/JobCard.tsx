"use client";
import Link from "next/link";
import { fmtSalary, sourceHost, relativeTime } from "@/lib/utils";
import { extractCultureTags } from "@/lib/culture-keywords";
import type { Job } from "@/lib/types";

interface Props {
  job: Job;
  saved: boolean;
  onSave: () => void;
  // Top 20 modal context: score is locked behind paywall until user unlocks the page.
  // When true, ScorePill shows 🔒 instead of "— 分" pending state.
  locked?: boolean;
  staleScore?: boolean;  // true if score exists but resume has changed since
  // When provided, the locked pill becomes a button that calls this — surfaces
  // the unlock/ad-watch flow without forcing users to find a separate CTA.
  onLockClick?: () => void;
}

function ScorePill({ score, locked, staleScore, onLockClick }: { score: number | null; locked?: boolean; staleScore?: boolean; onLockClick?: () => void }) {
  if (locked) {
    const label = "🔒 鎖定";
    const title = staleScore ? "履歷已更新，請重新計算分數" : "點擊解鎖此頁分數";
    if (onLockClick) {
      return (
        <button
          type="button"
          onClick={onLockClick}
          className="score-pill pending"
          title={title}
          style={{
            background: "var(--bg-soft)",
            color: "var(--ink-2)",
            border: "1px dashed var(--line)",
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          {label}
        </button>
      );
    }
    return (
      <span
        className="score-pill pending"
        title={staleScore ? "履歷已更新，請重新計算分數" : "尚未解鎖分數"}
        style={{ background: "var(--bg-soft)", color: "var(--ink-3)", border: "1px dashed var(--line)" }}
      >
        {label}
      </span>
    );
  }
  if (score == null) return <span className="score-pill pending" title="待 AI 評分">— 分</span>;
  const pct = Math.round(score * 100);
  const cls = pct >= 75 ? "high" : pct >= 50 ? "mid" : "low";
  return <span className={`score-pill ${cls}`} title="AI 推薦適合度">{pct} 分</span>;
}

export function JobCard({ job, saved, onSave, locked, staleScore, onLockClick }: Props) {
  const cultureTags = extractCultureTags(job.description ?? "");

  return (
    <div className="job-card">
      <div>
        <div className="job-head">
          <h3>{job.title}</h3>
          <span className="co">· {job.company}</span>
          {job.ticker && job.ticker !== "—" && <span className="tag">{job.ticker}</span>}
        </div>
        <div className="job-meta">
          <span>📍 {job.city}, {job.country} · {job.remote}</span>
          <span>💼 {job.type}</span>
          <span>💰 {fmtSalary(job)}</span>
          {(job.yearsMin || job.yearsMax) && <span>👤 {job.yearsMin}–{job.yearsMax} yr</span>}
          <span>🕐 {relativeTime(job.postedAt ?? null)}</span>
        </div>
        {job.matchReasons.length > 0 && (
          <div className="match-reasons">AI 推薦: {job.matchReasons.slice(0, 2).join(" · ")}</div>
        )}
        <div className="job-tags">
          {job.skills.slice(0, 5).map((s) => <span key={s} className="tag">{s}</span>)}
          <span className="tag accent">來源: {sourceHost(job.sourceUrl)}</span>
        </div>
        {cultureTags.length > 0 && (
          <div className="job-tags" style={{ marginTop: 4 }}>
            {cultureTags.map((t) => <span key={t} className="tag culture">{t}</span>)}
          </div>
        )}
      </div>
      <div className="job-side">
        <ScorePill score={job.score ?? null} locked={locked} staleScore={staleScore} onLockClick={onLockClick} />
        <button className={`btn star${saved ? " on" : ""}`} onClick={onSave}>
          {saved ? "★ 已收藏" : "☆ 收藏"}
        </button>
        <Link href={`/job/${encodeURIComponent(job.id)}`} className="btn">檢視</Link>
        <a className="btn primary" href={job.sourceUrl} target="_blank" rel="noopener noreferrer">
          原始職缺 ↗
        </a>
      </div>
    </div>
  );
}
