"use client";
import { useState } from "react";
import { CANCEL_REASON_KEYS, CANCEL_REASON_LABELS, type CancelReasonKey } from "@/lib/plans";

export type PlanChangeKind = "cancel" | "downgrade";

interface Props {
  kind: PlanChangeKind;
  fromTier: "pro" | "max";
  effectiveAt?: string | null;   // ISO date (period end), shown to clarify "this happens later"
  onClose: () => void;
  onSuccess: () => void;
}

const COPY: Record<PlanChangeKind, {
  title: string;
  intro: string;
  confirmLabel: string;
  apiPath: string;
  reasonsRequired: boolean;
}> = {
  cancel: {
    title:           "取消訂閱",
    intro:           "我們會在當期結束時自動取消，至期限為止你仍可使用付費功能。請告訴我們原因好讓我們改進：",
    confirmLabel:    "確認取消",
    apiPath:         "/api/stripe/cancel",
    reasonsRequired: true,
  },
  downgrade: {
    title:           "降級為 Pro",
    intro:           "我們會在當期結束時自動切換為 Pro，至期限為止你仍享有 Max 全部權益。如方便也請告訴我們原因（選填）：",
    confirmLabel:    "確認降級為 Pro",
    apiPath:         "/api/stripe/downgrade",
    reasonsRequired: false,
  },
};

export function PlanChangeModal({ kind, fromTier, effectiveAt, onClose, onSuccess }: Props) {
  const [reasons, setReasons] = useState<CancelReasonKey[]>([]);
  const [note, setNote]       = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const cfg = COPY[kind];

  const toggle = (k: CancelReasonKey) =>
    setReasons((curr) => curr.includes(k) ? curr.filter((x) => x !== k) : [...curr, k]);

  const submit = async () => {
    if (cfg.reasonsRequired && reasons.length === 0) {
      setError("請至少選擇一個原因，幫助我們改進");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(cfg.apiPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reasons, note: note.trim() || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "操作失敗，請稍後再試");
        return;
      }
      onSuccess();
    } finally {
      setSubmitting(false);
    }
  };

  const fromLabel = fromTier === "max" ? "Max" : "Pro";
  const effective = effectiveAt
    ? new Date(effectiveAt).toLocaleString("zh-TW", { dateStyle: "long", timeStyle: "short" })
    : "當期結束";

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 100,
        display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--bg-elev)", borderRadius: 10,
          maxWidth: 520, width: "100%", maxHeight: "90vh",
          display: "flex", flexDirection: "column",
        }}
      >
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontWeight: 600, fontSize: 16 }}>{cfg.title}</div>
          <button className="btn" onClick={onClose} disabled={submitting} style={{ fontSize: 12 }}>關閉</button>
        </div>

        <div style={{ padding: 20, overflow: "auto", flex: 1 }}>
          <div style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.7, marginBottom: 14 }}>
            <div style={{ marginBottom: 8 }}>
              目前方案：<b>{fromLabel}</b>
              {kind === "cancel" && <> → 將於 <b>{effective}</b> 取消，之後改為 Free</>}
              {kind === "downgrade" && <> → 將於 <b>{effective}</b> 切換為 <b>Pro</b></>}
            </div>
            <div>{cfg.intro}</div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
            {CANCEL_REASON_KEYS.map((k) => (
              <label key={k} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", border: "1px solid var(--line)", borderRadius: 6, cursor: "pointer", background: reasons.includes(k) ? "var(--bg-soft)" : "var(--bg)" }}>
                <input type="checkbox" checked={reasons.includes(k)} onChange={() => toggle(k)} />
                <span style={{ fontSize: 13 }}>{CANCEL_REASON_LABELS[k]}</span>
              </label>
            ))}
          </div>

          <div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>還有想告訴我們的嗎？(選填)</div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="例如：希望未來看到什麼功能、什麼地方讓你不便等"
              maxLength={2000}
              style={{
                width: "100%", padding: 10, minHeight: 80,
                fontFamily: "inherit", fontSize: 13, lineHeight: 1.6,
                border: "1px solid var(--line)", borderRadius: 6, background: "var(--bg)",
              }}
            />
          </div>

          {error && (
            <div style={{ marginTop: 10, padding: "8px 12px", background: "oklch(95% .05 30)", border: "1px solid oklch(80% .08 30)", color: "oklch(40% .14 30)", borderRadius: 6, fontSize: 12 }}>
              {error}
            </div>
          )}
        </div>

        <div style={{ padding: "12px 20px", borderTop: "1px solid var(--line)", display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button className="btn" onClick={onClose} disabled={submitting} style={{ fontSize: 13 }}>返回</button>
          <button
            className="btn"
            onClick={submit}
            disabled={submitting}
            style={{
              fontSize: 13,
              background: kind === "cancel" ? "oklch(55% .18 25)" : undefined,
              color: kind === "cancel" ? "white" : undefined,
              borderColor: kind === "cancel" ? "oklch(50% .18 25)" : undefined,
            }}
          >
            {submitting ? "處理中…" : cfg.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
