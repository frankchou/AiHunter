"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PLANS } from "@/lib/plans";
import type { PlanTier } from "@/lib/plans";
import { PlanChangeModal, type PlanChangeKind } from "@/components/subscription/PlanChangeModal";

interface UsageSummary {
  insightsUsed: number;
  analysisUsed: number;
  adTickets: number;
  adUnlocksUsed: number;
  month: string;
}

interface Props {
  currentTier: PlanTier;
  isSuperUser: boolean;
  usageSummary: UsageSummary;
  /** Set to true when ?from=settings; controls visibility of「← 設定」 link. */
  showReturnToSettings: boolean;
}

export function PricingView({ currentTier, isSuperUser, usageSummary, showReturnToSettings }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [modal, setModal] = useState<PlanChangeKind | null>(null);

  // Super user remap: display as Max, but with special CTA handling
  // (all card buttons disabled — they have no real subscription).
  const displayTier: PlanTier = isSuperUser ? "max" : currentTier;

  const handleUpgrade = async (tier: "pro" | "max") => {
    setLoading(tier);
    try {
      const res = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier }),
      });
      const { url, error } = await res.json();
      if (error) { alert(error); return; }
      if (url) window.location.href = url;
    } finally {
      setLoading(null);
    }
  };

  const plans: Array<{ tier: PlanTier; highlight?: boolean }> = [
    { tier: "free" },
    { tier: "pro", highlight: true },
    { tier: "max" },
  ];

  return (
    <div className="app-content">
      <div className="section-h">
        {showReturnToSettings && (
          <Link href="/settings" style={{ fontSize: 12, color: "var(--ink-3)", marginRight: 10 }}>← 設定</Link>
        )}
        <h3 style={{ display: "inline" }}>升級方案</h3>
        <span className="sub">選擇最適合你的求職加速器</span>
      </div>

      {/* Super user banner */}
      {isSuperUser && (
        <div className="card" style={{ padding: 14, marginBottom: 16, background: "oklch(95% .04 235)", border: "1px solid oklch(85% .06 235)", fontSize: 13, color: "var(--ink-2)" }}>
          你是 <b>Super User</b>，擁有 Max 所有功能、無需訂閱可管理。下方按鈕已停用。
        </div>
      )}

      {/* Plan-aware usage summary */}
      <UsageCard tier={displayTier} usage={usageSummary} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, maxWidth: 860 }}>
        {plans.map(({ tier, highlight }) => {
          const plan = PLANS[tier];
          const isCurrent = displayTier === tier;
          return (
            <div
              key={tier}
              className="card"
              style={{
                padding: 22,
                border: highlight ? "2px solid var(--primary, oklch(52% .18 250))" : undefined,
                position: "relative",
                display: "flex",
                flexDirection: "column",
              }}
            >
              {highlight && (
                <div style={{
                  position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)",
                  background: "oklch(52% .18 250)", color: "#fff",
                  fontSize: 11, fontWeight: 700, padding: "3px 12px", borderRadius: 999,
                }}>
                  最受歡迎
                </div>
              )}

              <div style={{ marginBottom: 6 }}>
                <span className="eyebrow">{plan.nameZh}</span>
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>
                {plan.monthlyTwd === 0 ? "免費" : `NT$${plan.monthlyTwd}`}
                {plan.monthlyTwd > 0 && <span style={{ fontSize: 13, fontWeight: 400, color: "var(--ink-3)" }}> / 月</span>}
              </div>

              <ul style={{ padding: "0 0 0 16px", margin: "12px 0 20px", fontSize: 13, color: "var(--ink-2)", lineHeight: 1.9, flex: 1 }}>
                {plan.features.map((f, i) => <li key={i}>{f}</li>)}
              </ul>

              {/* CTA — Super user disabled across the board; otherwise per-tier logic */}
              {isSuperUser ? (
                <button className="btn" disabled style={{ width: "100%", cursor: "not-allowed", opacity: 0.5 }}>
                  Super User — 無需訂閱
                </button>
              ) : isCurrent ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ textAlign: "center", padding: "6px 0", fontSize: 13, color: "var(--ink-3)", fontWeight: 600 }}>
                    ✓ 目前方案
                  </div>
                  {tier !== "free" && (
                    <Link href="/settings/billing" className="btn" style={{ width: "100%", fontSize: 12, justifyContent: "center" }}>
                      管理訂閱 →
                    </Link>
                  )}
                </div>
              ) : tier === "free" ? (
                currentTier === "max" || currentTier === "pro" ? (
                  // Paid user on Free card → 更改方案 (softer than 取消訂閱)
                  <button
                    className="btn"
                    style={{ width: "100%" }}
                    onClick={() => setModal("cancel")}
                  >
                    更改方案
                  </button>
                ) : (
                  <button className="btn" style={{ width: "100%" }} onClick={() => router.back()}>
                    繼續使用免費版
                  </button>
                )
              ) : tier === "pro" && currentTier === "max" ? (
                // Max → Pro downgrade — 更改方案 (softer than 降級為)
                <button className="btn" style={{ width: "100%" }} onClick={() => setModal("downgrade")}>
                  更改方案
                </button>
              ) : (
                // Free → Pro/Max OR Pro → Max → keep "升級到 X" upsell language
                <button
                  className="btn primary"
                  style={{ width: "100%", ...(highlight ? {} : { background: "var(--ink-2)", borderColor: "var(--ink-2)" }) }}
                  onClick={() => handleUpgrade(tier as "pro" | "max")}
                  disabled={!!loading}
                >
                  {loading === tier ? "跳轉中…" : `升級到 ${plan.name}`}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 20, fontSize: 12, color: "var(--ink-3)" }}>
        所有方案均支援信用卡付款 · 可隨時取消 · 若有問題請聯繫我們
      </div>

      {modal && currentTier !== "free" && (
        <PlanChangeModal
          kind={modal}
          fromTier={currentTier as "pro" | "max"}
          effectiveAt={null}
          onClose={() => setModal(null)}
          onSuccess={() => { setModal(null); router.push("/settings/billing"); }}
        />
      )}
    </div>
  );
}

// Plan-aware usage summary card. Shows only the metrics that exist for
// the user's tier — Free sees ticket balance, Pro sees their 30/15
// limits, Max sees an "unlimited" indicator.
function UsageCard({ tier, usage }: { tier: PlanTier; usage: UsageSummary }) {
  const baseStyle = {
    padding: 14,
    marginBottom: 20,
    background: "oklch(95% .04 235)",
    border: "1px solid oklch(85% .06 235)",
  } as const;

  if (tier === "free") {
    const adUnlocksRemaining = Math.max(0, 5 - usage.adUnlocksUsed);
    return (
      <div className="card" style={baseStyle}>
        <div style={{ fontSize: 12, color: "oklch(45% .1 235)", fontWeight: 600, marginBottom: 8 }}>
          本月使用量（{usage.month}）
        </div>
        <div style={{ display: "flex", gap: 24, fontSize: 13, flexWrap: "wrap" }}>
          <span>AI 分析：<b>{usage.insightsUsed}</b> / 3 次</span>
          <span>履歷 + CV：<b>{usage.analysisUsed}</b> / 3 次</span>
          <span>解析券餘額：<b>{usage.adTickets}</b> 張</span>
          <span>本月廣告解鎖剩餘：<b>{adUnlocksRemaining}</b> / 5 次</span>
        </div>
      </div>
    );
  }

  if (tier === "pro") {
    return (
      <div className="card" style={baseStyle}>
        <div style={{ fontSize: 12, color: "oklch(45% .1 235)", fontWeight: 600, marginBottom: 8 }}>
          本月使用量（{usage.month}）
        </div>
        <div style={{ display: "flex", gap: 24, fontSize: 13, flexWrap: "wrap" }}>
          <span>AI 分析：<b>{usage.insightsUsed}</b> / 30 次</span>
          <span>履歷 + CV：<b>{usage.analysisUsed}</b> / 15 次</span>
          <span>✨ 公司職缺評分：每家公司每月 2 頁免費</span>
        </div>
      </div>
    );
  }

  // Max (incl. super user remap)
  return (
    <div className="card" style={baseStyle}>
      <div style={{ fontSize: 12, color: "oklch(45% .1 235)", fontWeight: 600, marginBottom: 8 }}>
        本月使用量（{usage.month}）
      </div>
      <div style={{ display: "flex", gap: 24, fontSize: 13, flexWrap: "wrap" }}>
        <span>AI 分析：<b>{usage.insightsUsed}</b> 次（無限）</span>
        <span>履歷 + CV：<b>{usage.analysisUsed}</b> 次（無限）</span>
        <span>✨ 所有功能無限使用</span>
      </div>
    </div>
  );
}
