"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PLANS } from "@/lib/plans";
import type { PlanTier } from "@/lib/plans";
import { PlanChangeModal, type PlanChangeKind } from "@/components/subscription/PlanChangeModal";

interface Props {
  currentTier: PlanTier;
  usageSummary: { insightsUsed: number; analysisUsed: number; month: string };
}

export function PricingView({ currentTier, usageSummary }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [modal, setModal] = useState<PlanChangeKind | null>(null);

  const handleUpgrade = async (tier: "pro" | "max") => {
    setLoading(tier);
    try {
      const res = await fetch("/api/stripe/checkout", {
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
        <h3>升級方案</h3>
        <span className="sub">選擇最適合你的求職加速器</span>
      </div>

      {/* Current usage */}
      {currentTier === "free" && (
        <div className="card" style={{ padding: 14, marginBottom: 20, background: "oklch(95% .04 235)", border: "1px solid oklch(85% .06 235)" }}>
          <div style={{ fontSize: 12, color: "oklch(45% .1 235)", fontWeight: 600, marginBottom: 8 }}>
            本月使用量（{usageSummary.month}）
          </div>
          <div style={{ display: "flex", gap: 24, fontSize: 13 }}>
            <span>AI 分析：<b>{usageSummary.insightsUsed}</b> / 3 次</span>
            <span>履歷 + CV：<b>{usageSummary.analysisUsed}</b> / 3 次</span>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, maxWidth: 860 }}>
        {plans.map(({ tier, highlight }) => {
          const plan = PLANS[tier];
          const isCurrent = currentTier === tier;
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

              {/* CTA based on relative position to current tier */}
              {isCurrent ? (
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
                  // Free card → for paid user, this is "Cancel"
                  <button
                    className="btn"
                    style={{ width: "100%", color: "oklch(45% .15 25)", borderColor: "oklch(75% .12 25)" }}
                    onClick={() => setModal("cancel")}
                  >
                    取消訂閱
                  </button>
                ) : (
                  <button className="btn" style={{ width: "100%" }} onClick={() => router.back()}>
                    繼續使用免費版
                  </button>
                )
              ) : tier === "pro" && currentTier === "max" ? (
                // Max user looking at Pro card → Downgrade
                <button className="btn" style={{ width: "100%" }} onClick={() => setModal("downgrade")}>
                  降級為 Pro
                </button>
              ) : (
                // Free user looking at Pro/Max OR Pro user looking at Max → Upgrade
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
