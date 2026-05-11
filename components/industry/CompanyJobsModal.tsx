"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import useSWR, { mutate as globalMutate } from "swr";
import { JobCard } from "@/components/jobs/JobCard";
import type { Job } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface ScoredJob extends Job {
  locked:     boolean;
  staleScore: boolean;
}

interface PageResponse {
  jobs: ScoredJob[];
  pagination: { page: number; pageSize: number; total: number; hasMore: boolean };
  policy: {
    tier:             "free" | "pro" | "max";
    tickets:          number;
    proUsage:         { used: number; quota: number; resetAt: string } | null;
    pageSize:         number;
    currentParsedHash: string | null;
    canRecalculate:   boolean;
  };
}

export function CompanyJobsModal({
  companyName, totalApprox, onClose,
}: {
  companyName: string;
  totalApprox: number;
  onClose: () => void;
}) {
  const [page, setPage] = useState(1);
  const [unlocking, setUnlocking] = useState(false);
  const [prompt, setPrompt] = useState<null | "free_no_tickets" | "pro_quota_exceeded" | "hash_unchanged">(null);
  const [promptData, setPromptData] = useState<{ resetAt?: string; tickets?: number }>({});

  const key = `/api/companies/${encodeURIComponent(companyName)}/jobs?page=${page}`;
  const { data, mutate, isLoading } = useSWR<PageResponse>(key, fetcher, { revalidateOnFocus: false });

  const { data: savedData } = useSWR<{ jobs: { jobId: string }[] }>("/api/saved", fetcher);
  const savedIds = new Set(savedData?.jobs?.map((j) => j.jobId) ?? []);

  // Lock body scroll while modal open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const unlockPage = async (opts: { recalculate?: boolean } = {}) => {
    if (unlocking) return;
    setUnlocking(true);
    setPrompt(null);
    try {
      const r = await fetch(`/api/companies/${encodeURIComponent(companyName)}/jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page, recalculate: !!opts.recalculate }),
      });
      const json = await r.json().catch(() => ({}));
      if (r.ok) {
        mutate();      // refresh this page with scores
        return;
      }
      if (json.error === "PRO_QUOTA_EXCEEDED") {
        setPrompt("pro_quota_exceeded");
        setPromptData({ resetAt: json.resetAt });
        return;
      }
      if (json.error === "FREE_NO_TICKETS") {
        setPrompt("free_no_tickets");
        setPromptData({ tickets: json.tickets });
        return;
      }
      if (json.error === "HASH_UNCHANGED") {
        setPrompt("hash_unchanged");
        return;
      }
      alert(json.message ?? json.error ?? "解鎖失敗");
    } finally {
      setUnlocking(false);
    }
  };

  const toggleSaved = async (jobId: string, currentlySaved: boolean) => {
    await fetch("/api/saved", {
      method: currentlySaved ? "DELETE" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId }),
    });
    globalMutate("/api/saved");
  };

  const lockedOnThisPage = (data?.jobs ?? []).filter((j) => j.locked);
  const pageHasLocks    = lockedOnThisPage.length > 0;
  const everyJobScored  = (data?.jobs ?? []).every((j) => !j.locked);

  const totalPages = data?.pagination
    ? Math.max(1, Math.ceil(data.pagination.total / data.pagination.pageSize))
    : 1;

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: "var(--bg-elev)", borderRadius: 12, maxWidth: 860, width: "100%", maxHeight: "90vh", display: "flex", flexDirection: "column" }}
      >
        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 17 }}>{companyName} · 全部職缺</div>
            <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 2 }}>
              共 {data?.pagination.total ?? totalApprox} 筆 · 第 {page} / {totalPages} 頁
              {data?.policy.tier === "pro" && data.policy.proUsage && (
                <span style={{ marginLeft: 12 }}>
                  本月已用 {data.policy.proUsage.used} / {data.policy.proUsage.quota} 頁免費評分
                </span>
              )}
            </div>
          </div>
          <button className="btn" onClick={onClose} style={{ fontSize: 12 }}>✕ 關閉</button>
        </div>

        {/* Top action bar — unlock (Free only) + recalculate (Pro/Max) */}
        {data && (
          <div style={{ padding: "10px 20px", borderBottom: "1px solid var(--line)", background: "var(--bg-soft)", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            {/* Free: must explicitly click to consume ticket */}
            {pageHasLocks && data.policy.tier === "free" && (
              <button
                className="btn primary"
                onClick={() => unlockPage()}
                disabled={unlocking}
                style={{ fontSize: 13 }}
              >
                {unlocking ? "解鎖中…" : "🔓 解鎖此頁分數（1 張解析券）"}
              </button>
            )}
            {/* Pro past quota: locks appear, no manual unlock button — must wait next month or upgrade */}
            {pageHasLocks && data.policy.tier === "pro" && (
              <span style={{ fontSize: 12, color: "oklch(45% .15 60)" }}>
                ⚠️ 本月免費額度已用完（{data.policy.proUsage?.used ?? 0}/{data.policy.proUsage?.quota ?? 2}）
              </span>
            )}
            {/* Recalculate: Pro/Max only, when current page is all scored */}
            {everyJobScored && data.policy.canRecalculate && (
              <button
                className="btn"
                onClick={() => unlockPage({ recalculate: true })}
                disabled={unlocking}
                style={{ fontSize: 13 }}
                title="若履歷有更新，可重新計算分數"
              >
                ↻ 重新計算分數
              </button>
            )}
            <div style={{ flex: 1 }} />
            <div style={{ fontSize: 11, color: "var(--ink-3)" }}>
              {data.policy.tier === "free" && <>解析券：{data.policy.tickets} 張</>}
              {data.policy.tier === "pro" && data.policy.proUsage && (
                <>Pro · 本月此公司已用 {data.policy.proUsage.used}/{data.policy.proUsage.quota} 頁</>
              )}
              {data.policy.tier === "max"  && <>Max 旗艦 · 自動評分、無限解鎖</>}
            </div>
          </div>
        )}

        {/* Prompt banners */}
        {prompt === "pro_quota_exceeded" && (
          <PromptBanner
            kind="warn"
            title="本月免費額度已用完"
            body={`Pro 用戶每月每家公司前 2 頁分數免費。下次重置：${promptData.resetAt ?? "下月初"}。`}
            primary={{ label: "🚀 升級 Max 立即解鎖", href: "/pricing" }}
            secondary={{ label: "等下個月", onClick: () => setPrompt(null) }}
          />
        )}
        {prompt === "free_no_tickets" && (
          <PromptBanner
            kind="warn"
            title="解析券不足"
            body={`解鎖此頁需 1 張解析券，你目前有 ${promptData.tickets ?? 0} 張。看廣告或升級方案以繼續。`}
            primary={{ label: "🚀 查看升級方案", href: "/pricing" }}
            secondary={{ label: "我知道了", onClick: () => setPrompt(null) }}
          />
        )}
        {prompt === "hash_unchanged" && (
          <PromptBanner
            kind="info"
            title="履歷沒有新版本"
            body="重新計算分數需要先在「履歷」頁上傳新版的履歷。同一份履歷的分數不會改變，所以無需重算。"
            primary={{ label: "前往「履歷」頁", href: "/resume" }}
            secondary={{ label: "了解", onClick: () => setPrompt(null) }}
          />
        )}

        {/* Job list */}
        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
          {isLoading && (
            <div style={{ textAlign: "center", padding: 40, color: "var(--ink-3)" }}>
              <div className="spinner" style={{ margin: "0 auto 12px" }} />
              載入中…
            </div>
          )}
          {!isLoading && data && data.jobs.length === 0 && (
            <div style={{ textAlign: "center", padding: 40, color: "var(--ink-3)" }}>
              這頁沒有職缺。
            </div>
          )}
          {!isLoading && data && data.jobs.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {data.jobs.map((j) => (
                <JobCard
                  key={j.id}
                  job={j as unknown as Job}
                  saved={savedIds.has(j.id)}
                  onSave={() => toggleSaved(j.id, savedIds.has(j.id))}
                  locked={j.locked}
                  staleScore={j.staleScore}
                />
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
        {data && totalPages > 1 && (
          <div style={{ padding: "12px 20px", borderTop: "1px solid var(--line)", display: "flex", justifyContent: "center", alignItems: "center", gap: 8 }}>
            <button
              className="btn"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              style={{ fontSize: 12 }}
            >
              ← 上一頁
            </button>
            <span style={{ fontSize: 13, fontFamily: "var(--font-mono)", color: "var(--ink-2)" }}>
              {page} / {totalPages}
            </span>
            <button
              className="btn"
              disabled={!data.pagination.hasMore}
              onClick={() => setPage((p) => p + 1)}
              style={{ fontSize: 12 }}
            >
              下一頁 →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function PromptBanner({
  kind, title, body, primary, secondary,
}: {
  kind: "warn" | "info";
  title: string;
  body: string;
  primary: { label: string; href?: string; onClick?: () => void };
  secondary?: { label: string; onClick?: () => void };
}) {
  const tone = kind === "warn"
    ? { bg: "oklch(96% .05 60)",  border: "oklch(85% .08 60)",  text: "oklch(35% .14 60)"  }
    : { bg: "oklch(95% .04 235)", border: "oklch(85% .06 235)", text: "oklch(40% .14 235)" };
  return (
    <div style={{ padding: "12px 20px", background: tone.bg, borderBottom: `1px solid ${tone.border}` }}>
      <div style={{ fontWeight: 600, fontSize: 13, color: tone.text, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 12, color: "var(--ink-2)", marginBottom: 8 }}>{body}</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {primary.href
          ? <Link href={primary.href} className="btn primary" style={{ fontSize: 12 }}>{primary.label}</Link>
          : <button className="btn primary" onClick={primary.onClick} style={{ fontSize: 12 }}>{primary.label}</button>}
        {secondary && (
          <button className="btn" onClick={secondary.onClick} style={{ fontSize: 12 }}>{secondary.label}</button>
        )}
      </div>
    </div>
  );
}
