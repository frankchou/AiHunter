"use client";
import useSWR from "swr";
import Link from "next/link";
import { fmtSalary, relativeTime } from "@/lib/utils";
import type { SavedJob } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const STAGES = [
  { id: "saved",      label: "Saved",     color: "#6c757d" },
  { id: "preparing",  label: "Preparing", color: "#0d6efd" },
  { id: "applied",    label: "Applied",   color: "#f59e0b" },
  { id: "interview",  label: "Interview", color: "#8b5cf6" },
  { id: "closed",     label: "Closed",    color: "#dc3545" },
];

function ScoreCircle({ score }: { score: number | null | undefined }) {
  const pct = score != null ? Math.round(score * 100) : null;
  const color = pct == null ? "#aaa" : pct >= 75 ? "#22c55e" : pct >= 50 ? "#f59e0b" : "#ef4444";
  return (
    <div style={{
      width: 36, height: 36, borderRadius: "50%",
      border: `3px solid ${color}`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 11, fontWeight: 700, color, flexShrink: 0,
      background: `${color}15`,
    }}>
      {pct != null ? pct : "—"}
    </div>
  );
}

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
        <span className="sub">拖曳欄位換狀態 · 點擊職稱查看詳情</span>
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
              <header style={{ borderTop: `3px solid ${s.color}` }}>
                <span style={{ color: s.color, fontWeight: 600 }}>{s.label}</span>
                <span className="count" style={{ background: s.color }}>{buckets[s.id].length}</span>
              </header>

              {buckets[s.id].map((item) => (
                <div className="kjob" key={item.id}>
                  {/* Score + title row */}
                  <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <ScoreCircle score={item.job.score} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Link
                        href={`/job/${encodeURIComponent(item.job.id)}`}
                        style={{ fontWeight: 600, fontSize: 13, color: "var(--ink)", textDecoration: "none", lineHeight: 1.3, display: "block" }}
                      >
                        {item.job.title}
                      </Link>
                      <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 2 }}>
                        {item.job.company} · {item.job.city}
                      </div>
                    </div>
                  </div>

                  {/* Salary + date */}
                  <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 8, display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontFamily: "var(--font-mono)" }}>{fmtSalary(item.job)}</span>
                    <span>{relativeTime(item.savedAt)}</span>
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
                    <a
                      href={item.job.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn"
                      style={{ fontSize: 11, padding: "3px 8px" }}
                    >
                      原文 ↗
                    </a>
                    {s.id === "preparing" && (
                      <button
                        className="btn primary"
                        style={{ fontSize: 11, padding: "3px 8px", opacity: 0.75, cursor: "not-allowed" }}
                        disabled
                        title="即將推出"
                      >
                        模擬面試
                      </button>
                    )}
                    <select
                      className="sort-select"
                      style={{ fontSize: 11, padding: "3px 6px", marginLeft: "auto" }}
                      value={item.stage}
                      onChange={(e) => moveStage(item.id, e.target.value)}
                    >
                      {STAGES.map((st) => <option key={st.id} value={st.id}>{st.label}</option>)}
                    </select>
                  </div>
                </div>
              ))}

              {buckets[s.id].length === 0 && (
                <div style={{ fontSize: 11, color: "var(--ink-4)", textAlign: "center", padding: "16px 0" }}>（空）</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
