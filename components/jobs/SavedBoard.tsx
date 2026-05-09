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

function ScoreBadge({ score }: { score: number | null | undefined }) {
  const pct = score != null ? Math.round(score * 100) : null;
  const bg = pct == null ? "#ccc" : pct >= 75 ? "#22c55e" : pct >= 50 ? "#f59e0b" : "#ef4444";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      width: 36, height: 36, borderRadius: "50%",
      background: bg, color: "#fff",
      fontSize: 12, fontWeight: 700, flexShrink: 0,
    }}>
      {pct ?? "—"}
    </span>
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
        <span className="sub">點擊職稱查看詳情 · 下拉選單可換狀態</span>
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

              {buckets[s.id].length === 0 && (
                <div style={{ fontSize: 12, color: "var(--ink-4)", textAlign: "center", padding: "12px 0" }}>（空）</div>
              )}

              {buckets[s.id].map((item) => (
                <div className="kjob" key={item.id}>
                  <Link
                    href={`/job/${encodeURIComponent(item.job.id)}`}
                    style={{ textDecoration: "none", color: "inherit", display: "block" }}
                  >
                    <div style={{ fontWeight: 600, fontSize: 14, lineHeight: 1.35 }}>{item.job.title}</div>
                    <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 3 }}>
                      {item.job.company} · {item.job.city}
                    </div>
                    {fmtSalary(item.job) !== "薪資未公開" && (
                      <div style={{ fontSize: 11, color: "var(--ink-4)", marginTop: 2, fontFamily: "var(--font-mono)" }}>
                        {fmtSalary(item.job)}
                      </div>
                    )}
                  </Link>

                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12, gap: 8 }}>
                    <ScoreBadge score={item.job.score} />

                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
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
                          className="btn"
                          style={{ fontSize: 11, padding: "3px 8px", opacity: 0.5, cursor: "not-allowed" }}
                          disabled
                          title="即將推出"
                        >
                          模擬面試
                        </button>
                      )}
                      <select
                        className="sort-select"
                        style={{ fontSize: 11, padding: "3px 6px" }}
                        value={item.stage}
                        onChange={(e) => moveStage(item.id, e.target.value)}
                      >
                        {STAGES.map((st) => <option key={st.id} value={st.id}>{st.label}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
