"use client";
import useSWR from "swr";
import Link from "next/link";
import { fmtSalary } from "@/lib/utils";
import type { SavedJob } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const STAGES = [
  { id: "saved",      label: "Saved" },
  { id: "preparing",  label: "Preparing" },
  { id: "applied",    label: "Applied" },
  { id: "interview",  label: "Interview" },
  { id: "closed",     label: "Closed" },
];

export function SavedBoard() {
  const { data = [], isLoading, mutate } = useSWR<SavedJob[]>("/api/saved", fetcher);

  const moveStage = async (savedId: string, stage: string) => {
    await fetch(`/api/saved/${savedId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage }),
    });
    mutate();
  };

  if (isLoading) {
    return (
      <div className="app-content" style={{ textAlign: "center", padding: 60 }}>
        <div className="spinner" style={{ margin: "0 auto" }} />
      </div>
    );
  }

  const buckets = Object.fromEntries(STAGES.map((s) => [s.id, [] as SavedJob[]]));
  for (const item of data) {
    const stage = item.stage in buckets ? item.stage : "saved";
    buckets[stage].push(item);
  }

  return (
    <div className="app-content">
      <div className="section-h">
        <h3>我的收藏</h3>
        <span className="sub">點擊可看面試策略 · 下拉選單可換狀態</span>
      </div>

      {data.length === 0 && (
        <div className="card" style={{ textAlign: "center", color: "var(--ink-3)", padding: 40 }}>
          尚無收藏。回到<Link href="/feed" style={{ marginLeft: 4 }}>職缺流</Link>點擊「☆ 收藏」加入。
        </div>
      )}

      {data.length > 0 && (
        <div className="kanban">
          {STAGES.map((s) => (
            <div className="kcol" key={s.id}>
              <header>
                <span>{s.label}</span>
                <span className="count">{buckets[s.id].length}</span>
              </header>
              {buckets[s.id].map((item) => (
                <div className="kjob" key={item.id}>
                  <Link href={`/job/${item.job.id}`} style={{ display: "block", textDecoration: "none", color: "inherit" }}>
                    <h4>{item.job.title}</h4>
                    <div className="meta">{item.job.company} · {item.job.city}</div>
                    <div style={{ marginTop: 4, fontSize: 11, color: "var(--ink-3)", fontFamily: "var(--font-mono)" }}>
                      {fmtSalary(item.job)}
                    </div>
                  </Link>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                    {item.job.score != null && (
                      <span className="score-pill" style={{ fontSize: 11 }}>{Math.round(item.job.score * 100)}</span>
                    )}
                    <select
                      className="sort-select"
                      style={{ fontSize: 11, padding: "3px 6px", marginLeft: "auto" }}
                      value={item.stage}
                      onChange={(e) => moveStage(item.id, e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {STAGES.map((st) => <option key={st.id} value={st.id}>{st.label}</option>)}
                    </select>
                  </div>
                </div>
              ))}
              {buckets[s.id].length === 0 && (
                <div style={{ fontSize: 11, color: "var(--ink-4)", textAlign: "center", padding: "8px 0" }}>(空)</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
