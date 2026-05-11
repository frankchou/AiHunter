"use client";
import { useState } from "react";
import { CANCEL_REASON_KEYS, CANCEL_REASON_LABELS, type CancelReasonKey } from "@/lib/plans";

export type PlanChangeKind = "cancel" | "downgrade";

interface Props {
  kind: PlanChangeKind;
  fromTier: "pro" | "max";
  effectiveAt?: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

interface ImpactItem {
  tone: "loss" | "warn" | "keep";  // 影響顏色：紅=失去、橘=降級、綠=保留
  text: string;
}

interface ImpactSection {
  title: string;
  items: ImpactItem[];
}

// Loss-aversion content per (kind × fromTier) — shows the user concrete
// consequences before letting them proceed to the feedback step.
function getImpactSections(kind: PlanChangeKind, fromTier: "pro" | "max"): ImpactSection[] {
  if (kind === "cancel" && fromTier === "pro") {
    return [
      {
        title: "AI 功能配額會大幅縮減",
        items: [
          { tone: "loss", text: "AI 深度分析：30 次/月 → 3 次/月" },
          { tone: "loss", text: "履歷 + CV 編寫：15 次/月 → 3 次/月" },
          { tone: "loss", text: "產業 Top 20 強制更新：無限 → 需消耗解析券" },
        ],
      },
      {
        title: "其他變動",
        items: [
          { tone: "warn", text: "重新顯示廣告解鎖入口" },
        ],
      },
      {
        title: "會保留的",
        items: [
          { tone: "keep", text: "已上傳的履歷與 CV 仍保留" },
          { tone: "keep", text: "收藏的職缺與筆記不受影響" },
        ],
      },
    ];
  }

  if (kind === "cancel" && fromTier === "max") {
    return [
      {
        title: "Max 旗艦專屬功能會完全失去",
        items: [
          { tone: "loss", text: "履歷版本夾 — 無法瀏覽或管理所有版本" },
          { tone: "loss", text: "AI 共創履歷助理 — 浮動按鈕消失" },
          { tone: "loss", text: "針對性履歷產生器（每職缺一份）" },
          { tone: "loss", text: "針對性 CV (Cover Letter) 產生器" },
        ],
      },
      {
        title: "AI 配額會降到 Free tier",
        items: [
          { tone: "loss", text: "AI 深度分析：無限 → 3 次/月" },
          { tone: "loss", text: "履歷 + CV 編寫：無限 → 3 次/月" },
        ],
      },
      {
        title: "其他變動",
        items: [
          { tone: "warn", text: "重新顯示廣告解鎖入口" },
        ],
      },
      {
        title: "會保留的",
        items: [
          { tone: "keep", text: "已上傳的履歷仍保留" },
          { tone: "keep", text: "收藏的職缺不受影響" },
          { tone: "keep", text: "已生成的針對性履歷/CV 仍存在 DB，但無法瀏覽" },
        ],
      },
    ];
  }

  if (kind === "downgrade" && fromTier === "max") {
    return [
      {
        title: "Max 旗艦專屬功能會失去",
        items: [
          { tone: "loss", text: "履歷版本夾 — 無法瀏覽" },
          { tone: "loss", text: "AI 共創履歷助理" },
          { tone: "loss", text: "針對性履歷產生器" },
          { tone: "loss", text: "針對性 CV 產生器" },
        ],
      },
      {
        title: "AI 配額會調整為 Pro tier",
        items: [
          { tone: "warn", text: "AI 深度分析：無限 → 30 次/月" },
          { tone: "warn", text: "履歷 + CV 編寫：無限 → 15 次/月" },
          { tone: "keep", text: "產業 Top 20 強制更新：仍無限" },
          { tone: "keep", text: "仍無廣告" },
        ],
      },
    ];
  }

  return [];
}

const COPY: Record<PlanChangeKind, {
  title: string;
  intro: string;
  confirmLabel: string;
  apiPath: string;
  reasonsRequired: boolean;
  impactHeadline: (fromTier: "pro" | "max") => string;
}> = {
  cancel: {
    title:           "取消訂閱",
    intro:           "我們會在當期結束時自動取消，至期限為止你仍可使用付費功能。請告訴我們原因好讓我們改進：",
    confirmLabel:    "確認取消",
    apiPath:         "/api/stripe/cancel",
    reasonsRequired: true,
    impactHeadline:  (t) => `確定要取消 ${t === "max" ? "Max" : "Pro"} 訂閱嗎？`,
  },
  downgrade: {
    title:           "降級為 Pro",
    intro:           "我們會在當期結束時自動切換為 Pro，至期限為止你仍享有 Max 全部權益。如方便也請告訴我們原因（選填）：",
    confirmLabel:    "確認降級為 Pro",
    apiPath:         "/api/stripe/downgrade",
    reasonsRequired: false,
    impactHeadline:  () => "確定要降級為 Pro 嗎？",
  },
};

export function PlanChangeModal({ kind, fromTier, effectiveAt, onClose, onSuccess }: Props) {
  const [step, setStep]       = useState<"impact" | "feedback">("impact");
  const [reasons, setReasons] = useState<CancelReasonKey[]>([]);
  const [note, setNote]       = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const cfg = COPY[kind];
  const impact = getImpactSections(kind, fromTier);
  const fromLabel = fromTier === "max" ? "Max" : "Pro";
  const effective = effectiveAt
    ? new Date(effectiveAt).toLocaleString("zh-TW", { dateStyle: "long", timeStyle: "short" })
    : "當期結束";

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
          maxWidth: 560, width: "100%", maxHeight: "90vh",
          display: "flex", flexDirection: "column",
        }}
      >
        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontWeight: 600, fontSize: 16 }}>
            {step === "impact" ? cfg.impactHeadline(fromTier) : cfg.title}
          </div>
          <button className="btn" onClick={onClose} disabled={submitting} style={{ fontSize: 12 }}>關閉</button>
        </div>

        {/* Body */}
        <div style={{ padding: 20, overflow: "auto", flex: 1 }}>
          {step === "impact" ? (
            <ImpactBody fromLabel={fromLabel} sections={impact} />
          ) : (
            <FeedbackBody
              fromLabel={fromLabel}
              effective={effective}
              kind={kind}
              cfg={cfg}
              reasons={reasons}
              note={note}
              error={error}
              onToggle={toggle}
              onNoteChange={setNote}
            />
          )}
        </div>

        {/* Footer buttons */}
        <div style={{ padding: "12px 20px", borderTop: "1px solid var(--line)", display: "flex", justifyContent: "flex-end", gap: 8 }}>
          {step === "impact" ? (
            <>
              <button className="btn primary" onClick={onClose} style={{ fontSize: 13 }}>
                保留方案
              </button>
              <button
                className="btn"
                onClick={() => setStep("feedback")}
                style={{
                  fontSize: 13,
                  color: kind === "cancel" ? "oklch(45% .15 25)" : undefined,
                  borderColor: kind === "cancel" ? "oklch(75% .12 25)" : undefined,
                }}
              >
                繼續{kind === "cancel" ? "取消" : "降級"}
              </button>
            </>
          ) : (
            <>
              <button className="btn" onClick={() => setStep("impact")} disabled={submitting} style={{ fontSize: 13 }}>
                ← 返回
              </button>
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ImpactBody({ fromLabel, sections }: { fromLabel: string; sections: ImpactSection[] }) {
  return (
    <div>
      <div style={{ fontSize: 13, color: "var(--ink-2)", marginBottom: 16, lineHeight: 1.7 }}>
        如果取消你的 <b>{fromLabel}</b> 訂閱，下列功能會在當期結束後受到影響：
      </div>
      {sections.map((sec, i) => (
        <div key={i} style={{ marginBottom: 16 }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>{sec.title}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {sec.items.map((it, j) => <ImpactRow key={j} item={it} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

function ImpactRow({ item }: { item: ImpactItem }) {
  const colors: Record<ImpactItem["tone"], { icon: string; color: string }> = {
    loss: { icon: "✕", color: "oklch(45% .18 25)" },
    warn: { icon: "▼", color: "oklch(45% .15 60)" },
    keep: { icon: "✓", color: "oklch(40% .15 145)" },
  };
  const c = colors[item.tone];
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13, lineHeight: 1.6 }}>
      <span style={{ color: c.color, fontWeight: 700, flexShrink: 0, width: 16, textAlign: "center" }}>{c.icon}</span>
      <span style={{ color: "var(--ink-2)" }}>{item.text}</span>
    </div>
  );
}

function FeedbackBody({
  fromLabel, effective, kind, cfg, reasons, note, error, onToggle, onNoteChange,
}: {
  fromLabel: string;
  effective: string;
  kind: PlanChangeKind;
  cfg: { intro: string };
  reasons: CancelReasonKey[];
  note: string;
  error: string | null;
  onToggle: (k: CancelReasonKey) => void;
  onNoteChange: (s: string) => void;
}) {
  return (
    <div>
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
            <input type="checkbox" checked={reasons.includes(k)} onChange={() => onToggle(k)} />
            <span style={{ fontSize: 13 }}>{CANCEL_REASON_LABELS[k]}</span>
          </label>
        ))}
      </div>

      <div>
        <div className="eyebrow" style={{ marginBottom: 6 }}>還有想告訴我們的嗎？(選填)</div>
        <textarea
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
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
  );
}
