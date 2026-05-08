"use client";
import Link from "next/link";
import { fmtSalary, sourceHost, relativeTime } from "@/lib/utils";
import type { Job } from "@/lib/types";

interface Props {
  job: Job;
  saved: boolean;
  onSave: () => void;
}

export function JobCard({ job, saved, onSave }: Props) {
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
          <div className="match-reasons">AI 推薦: {job.matchReasons.slice(0, 3).join(" · ")}</div>
        )}
        <div className="job-tags">
          {job.skills.slice(0, 5).map((s) => <span key={s} className="tag">{s}</span>)}
          <span className="tag accent">來源: {sourceHost(job.sourceUrl)}</span>
        </div>
      </div>
      <div className="job-side">
        {job.score != null && (
          <span className="score-pill" title="AI 推薦適合度">{Math.round(job.score * 100)}</span>
        )}
        <button className={`btn star${saved ? " on" : ""}`} onClick={onSave}>
          {saved ? "★ 已收藏" : "☆ 收藏"}
        </button>
        <Link href={`/job/${job.id}`} className="btn">檢視</Link>
        <a className="btn primary" href={job.sourceUrl} target="_blank" rel="noopener noreferrer">
          原始職缺 ↗
        </a>
      </div>
    </div>
  );
}
