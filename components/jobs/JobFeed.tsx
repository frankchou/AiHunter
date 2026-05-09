"use client";
import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import useSWR from "swr";
import { JobCard } from "./JobCard";
import { FilterBar } from "./FilterBar";
import { buildQueryString } from "@/lib/utils";
import type { Job, JobFilters, JobListResponse } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Props {
  initialPrefs?: { locations?: string[]; industries?: string[] };
}

export function JobFeed({ initialPrefs }: Props) {
  const [filters, setFilters] = useState<JobFilters>({
    sort: "score", page: 1, pageSize: 10,
    countries: [], remote: [], industries: [], sources: [], culture: [],
  });
  const [showFilters, setShowFilters] = useState(false);
  const [q, setQ] = useState("");
  const [crawling, setCrawling] = useState(false);

  // Shared SWR key with SavedBoard for bidirectional sync
  const { data: savedList, mutate: mutateSaved } = useSWR<{ jobId: string }[]>(
    "/api/saved",
    fetcher,
    { revalidateOnFocus: true }
  );
  const savedIds = useMemo(() => new Set((savedList ?? []).map((s) => s.jobId)), [savedList]);

  const autoCrawledRef = useRef(false);

  const queryString = useMemo(() => {
    const combined: Record<string, unknown> = { ...filters, q: q || undefined };
    return buildQueryString(combined);
  }, [filters, q]);

  const { data, isLoading, mutate } = useSWR<JobListResponse & { source?: string }>(
    `/api/jobs?${queryString}`,
    fetcher,
    { revalidateOnFocus: false }
  );

  const jobs: Job[] = data?.jobs ?? [];
  const total = data?.total ?? 0;
  const isMock = false; // mock data disabled
  const totalPages = Math.max(1, Math.ceil(total / (filters.pageSize ?? 10)));
  const curPage = filters.page ?? 1;

  const activeFilterCount =
    (filters.countries?.length ?? 0) + (filters.remote?.length ?? 0) +
    (filters.industries?.length ?? 0) + (filters.sources?.length ?? 0) +
    (filters.culture?.length ?? 0) +
    (filters.titles ? 1 : 0) + (filters.yearsMin ? 1 : 0) + (filters.yearsMax ? 1 : 0);

  const handleSave = useCallback(async (jobId: string) => {
    const isSaved = savedIds.has(jobId);
    // Optimistic update
    mutateSaved(
      (prev) => {
        const list = prev ?? [];
        return isSaved ? list.filter((s) => s.jobId !== jobId) : [...list, { jobId }];
      },
      { revalidate: false }
    );
    await fetch("/api/saved", {
      method: isSaved ? "DELETE" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId }),
    });
    mutateSaved(); // sync server state after request
  }, [savedIds, mutateSaved]);

  // Auto-crawl once when feed is empty after first load
  useEffect(() => {
    if (!isLoading && total === 0 && !autoCrawledRef.current) {
      autoCrawledRef.current = true;
      handleCrawl();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, total]);

  const handleCrawl = async () => {
    setCrawling(true);
    try {
      await fetch("/api/crawl", { method: "POST" });
      await mutate();
    } finally {
      setCrawling(false);
    }
  };

  const setPage = (p: number) => setFilters((f) => ({ ...f, page: p }));

  return (
    <div className="app-content">
      <div className="section-h">
        <h3>職缺流 — {total} 筆</h3>
        <span className="sub">AI 推薦適合度 高 → 低</span>
        {total > 0 && (
          <button className="btn" onClick={handleCrawl} disabled={crawling} style={{ marginLeft: "auto" }}>
            {crawling ? <><span className="spinner" style={{ width: 12, height: 12 }} /> 抓取中…</> : "🔄 更新職缺"}
          </button>
        )}
      </div>

      <div className="search-row">
        <input className="q" placeholder="搜尋職稱、公司、技能…" value={q}
               onChange={(e) => { setQ(e.target.value); setFilters((f) => ({ ...f, page: 1 })); }} />
        <select className="sort-select" value={filters.sort ?? "score"}
                onChange={(e) => setFilters((f) => ({ ...f, sort: e.target.value as JobFilters["sort"], page: 1 }))}>
          <option value="score">AI 推薦適合度</option>
          <option value="date">最新</option>
          <option value="salary">薪資高至低</option>
        </select>
        <button className="btn" onClick={() => setShowFilters((s) => !s)}>
          {showFilters ? "收起篩選" : "顯示篩選"}
          {activeFilterCount > 0 && <span className="tag accent">{activeFilterCount}</span>}
        </button>
      </div>

      {showFilters && (
        <FilterBar filters={filters} onChange={(f) => setFilters({ ...f, page: 1 })} />
      )}

      {isLoading && (
        <div style={{ textAlign: "center", padding: 40 }}><div className="spinner" /></div>
      )}

      {!isLoading && (
        <div className="job-list">
          {jobs.map((j) => (
            <JobCard key={j.id} job={j} saved={savedIds.has(j.id)}
                     onSave={() => handleSave(j.id)} />
          ))}
          {jobs.length === 0 && !isLoading && (
            <div className="card" style={{ textAlign: "center", padding: 40 }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>尚無職缺</div>
              <div style={{ color: "var(--ink-3)", fontSize: 13, marginBottom: 20 }}>
                點擊「抓取職缺」從 104 / Remotive / Adzuna 抓取符合你履歷的真實職缺
              </div>
              <button className="btn primary" onClick={handleCrawl} disabled={crawling}>
                {crawling
                  ? <><span className="spinner" style={{ width: 14, height: 14 }} /> 抓取中…</>
                  : "🔄 立即抓取職缺"}
              </button>
            </div>
          )}
        </div>
      )}

      {total > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", justifyContent: "space-between", marginTop: 16, padding: "12px 14px", background: "var(--bg-elev)", border: "1px solid var(--line)", borderRadius: 10 }}>
          <div style={{ fontSize: 12, color: "var(--ink-3)", fontFamily: "var(--font-mono)" }}>
            顯示 {((curPage - 1) * (filters.pageSize ?? 10)) + 1}–{Math.min(curPage * (filters.pageSize ?? 10), total)} / {total}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: "var(--ink-3)" }}>每頁</span>
            <select className="sort-select" value={filters.pageSize ?? 10}
                    onChange={(e) => setFilters((f) => ({ ...f, pageSize: +e.target.value, page: 1 }))}>
              {[10, 20, 50].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <button className="btn" disabled={curPage <= 1} onClick={() => setPage(1)}>«</button>
            <button className="btn" disabled={curPage <= 1} onClick={() => setPage(curPage - 1)}>‹</button>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, padding: "0 6px" }}>{curPage}/{totalPages}</span>
            <button className="btn" disabled={curPage >= totalPages} onClick={() => setPage(curPage + 1)}>›</button>
            <button className="btn" disabled={curPage >= totalPages} onClick={() => setPage(totalPages)}>»</button>
          </div>
        </div>
      )}
    </div>
  );
}
