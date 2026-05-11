"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import useSWR, { mutate as globalMutate } from "swr";
import { JobCard } from "@/components/jobs/JobCard";
import { AdWatcher } from "@/components/subscription/AdWatcher";
import { AD_UNLOCK_ENABLED } from "@/lib/plans";
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
    needsResume:      boolean;
    ticketCost:       number;
    adSessionsLeft:   number;
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
  const [prompt, setPrompt] = useState<null | "unlock_confirm" | "pro_quota_exceeded" | "hash_unchanged">(null);
  const [promptData, setPromptData] = useState<{ resetAt?: string; tickets?: number }>({});
  const [showAdWatcher, setShowAdWatcher] = useState(false);
  const [upgrading, setUpgrading] = useState(false);

  // Immediate Pro→Max upgrade with prorated billing. Used by the
  // pro_quota_exceeded prompt so a Pro user blocked by monthly quota can
  // unlock now (pays the prorated difference, full Max price next cycle).
  const upgradeToMaxNow = async () => {
    if (upgrading) return;
    setUpgrading(true);
    try {
      const r = await fetch("/api/stripe/upgrade-now", { method: "POST" });
      const json = await r.json().catch(() => ({}));
      if (!r.ok) {
        alert(json.message ?? json.error ?? "升級失敗，請稍後再試或前往設定頁手動升級");
        return;
      }
      setPrompt(null);
      // Refetch everything that depends on tier: the modal's policy + the
      // global profile (which gates auto-fetch decisions elsewhere).
      mutate();
      globalMutate("/api/user/profile");
    } finally {
      setUpgrading(false);
    }
  };

  // Unique token per modal mount → forces SWR to make a fresh request each
  // time the modal opens, avoiding the "stale 1 row first, then 9 more"
  // progressive-render issue caused by SWR's stale-while-revalidate.
  const [mountToken] = useState(() => `${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const key = `/api/companies/${encodeURIComponent(companyName)}/jobs?page=${page}&_t=${mountToken}`;
  const { data, mutate, isLoading, isValidating } = useSWR<PageResponse>(key, fetcher, {
    revalidateOnFocus: false,
    revalidateIfStale: false,
    dedupingInterval: 0,
    // Keep the previous page's data (and its `pagination.total`) visible
    // while the new page is loading. Without this, the footer flashes
    // "2 / 1" because the new SWR key has no cached `total` yet.
    keepPreviousData: true,
  });

  // Treat any in-flight fetch as "still loading" so we never reveal a
  // half-rendered page. Once data exists AND no fetch is running, render.
  const showSpinner = isLoading || isValidating || !data;

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
        // Should rarely fire — UI normally gates this via lock click +
        // unlock_confirm prompt — but if the user's tickets drop between
        // the GET and POST, fall back to the confirm flow which has the
        // ad-watch path.
        setPrompt("unlock_confirm");
        setPromptData({ tickets: json.tickets ?? 0 });
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

  // Lock click handler — branches by plan tier and current quota state.
  // Free / Pro-over-quota / paid-but-no-resume all route here; the prompt
  // body adapts based on `data.policy`.
  const handleLockClick = () => {
    if (!data) return;
    if (data.policy.needsResume) {
      // No actionable unlock for this branch — banner above already nudges
      // to /resume; the click is a no-op here. Keeping the lock visible
      // (vs hiding) makes the "no score yet" state still legible.
      return;
    }
    if (data.policy.tier === "pro" && pageHasLocks) {
      setPrompt("pro_quota_exceeded");
      setPromptData({ resetAt: data.policy.proUsage?.resetAt });
      return;
    }
    if (data.policy.tier === "free") {
      setPrompt("unlock_confirm");
      return;
    }
    // Max with locks should not happen — auto-score covers them. If somehow
    // we reach here (transient race), invoke a regular unlock attempt.
    unlockPage();
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
  // Require at least one job — otherwise [].every() is vacuously true and
  // we'd show the "重新計算分數" button on an empty page.
  const everyJobScored  = (data?.jobs ?? []).length > 0 && (data?.jobs ?? []).every((j) => !j.locked);

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
        style={{
          background: "var(--bg-elev)",
          borderRadius: 12,
          maxWidth: 860,
          width: "100%",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          // Clip the inner scroll area so the scrollbar can't draw over the
          // outer rounded corner (was causing the bottom-right to look square).
          overflow: "hidden",
        }}
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

        {/* Top action bar — unlock CTA (Free) + recalculate (Pro/Max).
            The Free unlock button is kept here in addition to the
            clickable lock pills so the action is discoverable at a glance. */}
        {data && (
          <div style={{ padding: "10px 20px", borderBottom: "1px solid var(--line)", background: "var(--bg-soft)", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            {pageHasLocks && data.policy.tier === "free" && !data.policy.needsResume && (
              <button
                className="btn primary"
                onClick={handleLockClick}
                disabled={unlocking}
                style={{ fontSize: 13 }}
              >
                {unlocking
                  ? "解鎖中…"
                  : `🔓 解鎖此頁分數（${data.policy.ticketCost} 張解析券）`}
              </button>
            )}
            {pageHasLocks && data.policy.tier === "pro" && (
              <button
                className="btn"
                onClick={handleLockClick}
                style={{ fontSize: 12, color: "oklch(45% .15 60)" }}
              >
                ⚠️ 本月免費額度已用完（{data.policy.proUsage?.used ?? 0}/{data.policy.proUsage?.quota ?? 2}） · 查看選項
              </button>
            )}
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
              {/* Max / SuperUser: don't echo their plan benefits — they
                  already know, and the line was reading as upsell-y. */}
            </div>
          </div>
        )}

        {/* Paid plan but no parsed resume → auto-score can't run. */}
        {data?.policy.needsResume && (
          <PromptBanner
            kind="info"
            title="尚未啟用自動評分"
            body="自動評分需要已解析的履歷。請先到「履歷」頁上傳並完成解析後，回到此處即可看到每職缺的適配分數。"
            primary={{ label: "前往「履歷」頁", href: "/resume" }}
          />
        )}

        {/* Prompt banners */}
        {prompt === "pro_quota_exceeded" && (
          <PromptBanner
            kind="warn"
            title="本月免費額度已用完"
            body={`Pro 用戶每月每家公司前 2 頁分數免費。下次重置：${promptData.resetAt ?? "下月初"}。升級 Max 會按比例計收本月差價、立即生效、下月起按 Max 月費續扣。`}
            primary={{
              label: upgrading ? "升級中…" : "🚀 立即升級 Max（按比例補差價）",
              onClick: upgradeToMaxNow,
            }}
            secondary={{ label: "等下個月", onClick: () => setPrompt(null) }}
          />
        )}
        {/* Free clickable-lock entry — branches inside on tickets sufficiency. */}
        {prompt === "unlock_confirm" && data && (() => {
          const cost = data.policy.ticketCost;
          const tickets = data.policy.tickets;
          const hasEnough = tickets >= cost;
          const adsLeft = data.policy.adSessionsLeft;
          if (hasEnough) {
            return (
              <PromptBanner
                kind="info"
                title="解鎖此頁分數"
                body={`使用 ${cost} 張解析券解鎖本頁 ${data.policy.pageSize} 個職缺的 AI 適配分數。你目前有 ${tickets} 張。`}
                primary={{
                  label: unlocking ? "解鎖中…" : `✅ 使用 ${cost} 張解析券解鎖`,
                  onClick: () => unlockPage(),
                }}
                secondary={{ label: "取消", onClick: () => setPrompt(null) }}
              />
            );
          }
          // Tickets insufficient — offer ad-watch (if available) or upgrade.
          const canWatchAd = AD_UNLOCK_ENABLED && adsLeft > 0;
          return (
            <PromptBanner
              kind="warn"
              title="解析券不足"
              body={`解鎖此頁需 ${cost} 張解析券，你目前有 ${tickets} 張。${canWatchAd ? `可看廣告獲取（本月還能看 ${adsLeft} 次，每次 +1 張）。` : "本月已達廣告觀看上限。"}`}
              primary={canWatchAd
                ? { label: "📺 看廣告 +1 解析券", onClick: () => setShowAdWatcher(true) }
                : { label: "🚀 升級方案", href: "/pricing" }
              }
              secondary={canWatchAd
                ? { label: "升級方案", onClick: () => { window.location.href = "/pricing"; } }
                : { label: "取消", onClick: () => setPrompt(null) }
              }
            />
          );
        })()}
        {prompt === "hash_unchanged" && (
          <PromptBanner
            kind="info"
            title="履歷沒有新版本"
            body="重新計算分數需要先在「履歷」頁上傳新版的履歷。同一份履歷的分數不會改變，所以無需重算。"
            primary={{ label: "前往「履歷」頁", href: "/resume" }}
            secondary={{ label: "了解", onClick: () => setPrompt(null) }}
          />
        )}

        {/* Ad watch overlay — completes by incrementing the user's ticket
            balance on the server, then refetches modal data so the
            unlock_confirm prompt flips from "insufficient" to "use ticket".
            User must explicitly click the unlock button afterwards. */}
        {showAdWatcher && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.7)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
            <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--bg-elev)", borderRadius: 12, maxWidth: 520, width: "100%", padding: 20 }}>
              <AdWatcher
                ticketCost={data?.policy.ticketCost ?? 1}
                onComplete={() => {
                  setShowAdWatcher(false);
                  mutate();   // refetch — tickets now +1; prompt flips to "use ticket"
                  globalMutate("/api/user/profile");
                }}
                onCancel={() => setShowAdWatcher(false)}
              />
            </div>
          </div>
        )}

        {/* Job list — show ONE spinner during the whole load (Adzuna fetch +
            DB upsert + per-user scoring). Only render JobCards when the
            response is fully settled — prevents the "1 row first, 9 more
            later" progressive flash. */}
        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
          {showSpinner && (
            <div style={{ textAlign: "center", padding: 60, color: "var(--ink-3)" }}>
              <div className="spinner" style={{ margin: "0 auto 16px" }} />
              <div style={{ fontSize: 13 }}>抓取職缺與 AI 評分中…</div>
              <div style={{ fontSize: 11, marginTop: 6 }}>首次載入約 5–15 秒</div>
            </div>
          )}
          {!showSpinner && data && data.jobs.length === 0 && (
            <div style={{ textAlign: "center", padding: 40, color: "var(--ink-3)" }}>
              這頁沒有職缺。
            </div>
          )}
          {!showSpinner && data && data.jobs.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {data.jobs.map((j) => (
                <JobCard
                  key={j.id}
                  job={j as unknown as Job}
                  saved={savedIds.has(j.id)}
                  onSave={() => toggleSaved(j.id, savedIds.has(j.id))}
                  locked={j.locked}
                  staleScore={j.staleScore}
                  onLockClick={j.locked ? handleLockClick : undefined}
                  reasonsLabel="AI 解析"
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
