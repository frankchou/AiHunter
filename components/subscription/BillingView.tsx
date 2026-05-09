"use client";
import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { PlanChangeModal, type PlanChangeKind } from "@/components/subscription/PlanChangeModal";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface SubInfo {
  planTier: string;
  isSuperUser: boolean;
  pendingPlanTier: "pro" | "free" | null;
  pendingPlanAt: string | null;
  periodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  cardBrand: string | null;
  cardLast4: string | null;
  hasSubscription: boolean;
}

interface Invoice {
  id: string;
  number: string | null;
  created: number;     // unix seconds
  total: number;       // cents
  currency: string;
  status: string | null;
  hostedUrl: string | null;
  pdfUrl: string | null;
}

const TIER_LABEL: Record<string, string> = { free: "Free", pro: "Pro", max: "Max" };

export function BillingView() {
  const { data: sub, mutate: mutateSub } = useSWR<SubInfo>("/api/stripe/subscription", fetcher);
  const { data: invData } = useSWR<{ invoices: Invoice[] }>("/api/stripe/invoices", fetcher);

  const [modal, setModal] = useState<PlanChangeKind | null>(null);
  const [updatingPM, setUpdatingPM] = useState(false);

  const updatePaymentMethod = async () => {
    setUpdatingPM(true);
    try {
      const r = await fetch("/api/stripe/portal", { method: "POST" });
      const { url, error } = await r.json();
      if (error) { alert(error); return; }
      if (url) window.location.href = url;
    } finally {
      setUpdatingPM(false);
    }
  };

  const undoPending = async () => {
    if (!sub?.pendingPlanTier) return;
    const path = sub.pendingPlanTier === "free" ? "/api/stripe/cancel" : "/api/stripe/downgrade";
    if (!confirm("確定要還原方案變更嗎？")) return;
    const r = await fetch(path, { method: "DELETE" });
    if (r.ok) mutateSub();
    else alert("還原失敗，請稍後再試");
  };

  const tier = sub?.planTier ?? "free";
  const isPaid = tier === "pro" || tier === "max";

  return (
    <div className="app-content">
      <div className="section-h">
        <Link href="/settings" style={{ fontSize: 12, color: "var(--ink-3)", marginRight: 10 }}>← 設定</Link>
        <h3 style={{ display: "inline" }}>管理訂閱</h3>
        <span className="sub">付款方式 · 帳單紀錄 · 方案變更</span>
      </div>

      {sub?.isSuperUser && (
        <div className="card" style={{ padding: 14, marginBottom: 16, fontSize: 13, color: "var(--ink-2)", background: "oklch(95% .04 235)", border: "1px solid oklch(85% .06 235)" }}>
          你是 Super User — 不受方案限制，無 Stripe 訂閱可管理。
        </div>
      )}

      {/* Plan summary */}
      <div className="card" style={{ padding: 18, marginBottom: 16 }}>
        <div className="eyebrow" style={{ marginBottom: 8 }}>目前方案</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 600 }}>
              {TIER_LABEL[tier] ?? tier}
            </div>
            {sub?.periodEnd && (
              <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 4 }}>
                {sub.cancelAtPeriodEnd
                  ? `將於 ${new Date(sub.periodEnd).toLocaleDateString("zh-TW")} 結束`
                  : `下次扣款 ${new Date(sub.periodEnd).toLocaleDateString("zh-TW")}`}
              </div>
            )}
          </div>
          {isPaid && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {tier === "max" && !sub?.pendingPlanTier && (
                <button className="btn" onClick={() => setModal("downgrade")} style={{ fontSize: 13 }}>
                  降級為 Pro
                </button>
              )}
              {!sub?.pendingPlanTier && (
                <button
                  className="btn"
                  onClick={() => setModal("cancel")}
                  style={{ fontSize: 13, color: "oklch(45% .15 25)", borderColor: "oklch(75% .12 25)" }}
                >
                  取消訂閱
                </button>
              )}
            </div>
          )}
        </div>

        {sub?.pendingPlanTier && sub.pendingPlanAt && (
          <div style={{ marginTop: 14, padding: "10px 12px", background: "oklch(96% .04 60)", border: "1px solid oklch(85% .08 60)", borderRadius: 6, fontSize: 13, color: "oklch(35% .14 60)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span>
              已排程：{new Date(sub.pendingPlanAt).toLocaleDateString("zh-TW")} 起
              改為 <b>{TIER_LABEL[sub.pendingPlanTier]}</b>
            </span>
            <button className="btn" onClick={undoPending} style={{ fontSize: 12 }}>還原</button>
          </div>
        )}
      </div>

      {/* Payment method */}
      <div className="card" style={{ padding: 18, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>付款方式</div>
            <div style={{ fontSize: 14 }}>
              {sub?.cardLast4
                ? <>💳 {sub.cardBrand?.toUpperCase()} •••• {sub.cardLast4}</>
                : <span style={{ color: "var(--ink-3)" }}>尚未設定信用卡</span>}
            </div>
          </div>
          {sub?.hasSubscription && (
            <button className="btn" onClick={updatePaymentMethod} disabled={updatingPM} style={{ fontSize: 13 }}>
              {updatingPM ? "前往中…" : "更新"}
            </button>
          )}
        </div>
      </div>

      {/* Invoices */}
      <div className="card" style={{ padding: 18 }}>
        <div className="eyebrow" style={{ marginBottom: 10 }}>帳單紀錄</div>
        {!invData ? (
          <div style={{ fontSize: 13, color: "var(--ink-3)" }}>載入中…</div>
        ) : invData.invoices.length === 0 ? (
          <div style={{ fontSize: 13, color: "var(--ink-3)" }}>尚無帳單</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: "left", color: "var(--ink-3)", fontSize: 11, textTransform: "uppercase", letterSpacing: ".06em" }}>
                  <th style={{ padding: "8px 10px", borderBottom: "1px solid var(--line)" }}>日期</th>
                  <th style={{ padding: "8px 10px", borderBottom: "1px solid var(--line)" }}>金額</th>
                  <th style={{ padding: "8px 10px", borderBottom: "1px solid var(--line)" }}>狀態</th>
                  <th style={{ padding: "8px 10px", borderBottom: "1px solid var(--line)", textAlign: "right" }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {invData.invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td style={{ padding: "10px", borderBottom: "1px solid var(--line)" }}>
                      {new Date(inv.created * 1000).toLocaleDateString("zh-TW")}
                    </td>
                    <td style={{ padding: "10px", borderBottom: "1px solid var(--line)", fontFamily: "var(--font-mono)" }}>
                      {inv.currency.toUpperCase()} {(inv.total / 100).toFixed(2)}
                    </td>
                    <td style={{ padding: "10px", borderBottom: "1px solid var(--line)" }}>
                      <StatusBadge status={inv.status} />
                    </td>
                    <td style={{ padding: "10px", borderBottom: "1px solid var(--line)", textAlign: "right" }}>
                      {inv.hostedUrl && <a href={inv.hostedUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "var(--accent)" }}>檢視</a>}
                      {inv.hostedUrl && inv.pdfUrl && <span style={{ color: "var(--ink-3)", margin: "0 6px" }}>·</span>}
                      {inv.pdfUrl && <a href={inv.pdfUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "var(--accent)" }}>PDF</a>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && (
        <PlanChangeModal
          kind={modal}
          fromTier={tier as "pro" | "max"}
          effectiveAt={sub?.periodEnd ?? null}
          onClose={() => setModal(null)}
          onSuccess={() => { setModal(null); mutateSub(); }}
        />
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string | null }) {
  const ok = status === "paid";
  const label =
    status === "paid"          ? "已付款" :
    status === "open"          ? "待付款" :
    status === "draft"         ? "草稿" :
    status === "uncollectible" ? "壞帳" :
    status === "void"          ? "已作廢" :
    (status ?? "—");
  return (
    <span className="tag" style={{ fontSize: 10, color: ok ? "oklch(40% .14 145)" : "var(--ink-3)" }}>
      {label}
    </span>
  );
}
