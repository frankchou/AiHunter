"use client";

// Right-column hero preview. Must be a client component because it
// passes an onSave callback to <JobCard /> (which is itself a client
// component), and Next.js disallows passing functions from server to
// client component props.

import { JobCard } from "@/components/jobs/JobCard";
import type { Job } from "@/lib/types";

const HERO_MOCK_JOB: Job = {
  id: "demo-1",
  externalId: "demo",
  title: "Senior Software Engineer",
  company: "Google",
  ticker: "GOOGL",
  country: "TW",
  city: "Taipei",
  remote: "hybrid",
  type: "Full-time",
  salaryMin: 1_800_000,
  salaryMax: 2_400_000,
  ccy: "TWD",
  yearsMin: 5,
  yearsMax: 10,
  industry: "tech.consumer",
  skills: ["React", "Node.js", "TypeScript", "AWS", "Kubernetes"],
  description: "We're looking for an experienced engineer to join our Cloud Platform team in Taipei...",
  source: "adzuna",
  sourceUrl: "#",
  sourceHash: null,
  postedAt: new Date(Date.now() - 3 * 60 * 60 * 1000),  // 3 hours ago
  crawledAt: new Date(),
  score: 0.92,
  matchReasons: [
    "履歷中的 React / Node 7 年經驗完全對應 JD 主要需求",
    "期望薪資落在職缺範圍內、無預期落差",
    "職缺要求 Kubernetes 經驗，履歷僅提到 Docker",
  ],
};

export function HeroMockup() {
  return (
    <div style={{
      border: "2px solid var(--ink)",
      borderRadius: 18,
      boxShadow: "8px 8px 0 0 var(--ink)",
      padding: 18,
      background: "var(--bg)",
      position: "relative",
      overflow: "hidden",
    }}>
      <div className="landing-mockup-glow landing-mockup-glow-1" />
      <div className="landing-mockup-glow landing-mockup-glow-2" />
      <div style={{
        position: "absolute", top: 16, right: 16, zIndex: 2,
      }}>
        <span className="landing-pill landing-pill-soft">即時範例</span>
      </div>
      <div style={{ position: "relative", zIndex: 1, pointerEvents: "none" }}>
        <JobCard
          job={HERO_MOCK_JOB}
          saved={false}
          onSave={() => { /* preview only */ }}
          reasonsLabel="AI 解析"
        />
      </div>
    </div>
  );
}
