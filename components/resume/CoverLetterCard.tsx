"use client";
import { useEffect, useState } from "react";
import useSWR from "swr";
import { AdWatcher } from "@/components/subscription/AdWatcher";
import { AD_UNLOCK_ENABLED } from "@/lib/plans";

interface CoverLetterRow {
  id: string;
  fileName: string | null;
  content: string;
  version: number;
  createdAt: string;
}

interface LimitInfo { planTier: string; tickets: number; adSessionsLeft: number }

const fetcher = (url: string) => fetch(url).then((r) => (r.ok ? r.json() : null));

export function CoverLetterCard() {
  const { data: cv, mutate } = useSWR<CoverLetterRow | null>("/api/cover-letter", fetcher);
  const [draft, setDraft]       = useState<string>("");
  const [editing, setEditing]   = useState<boolean>(false);
  const [drafting, setDrafting] = useState<boolean>(false);
  const [saving, setSaving]     = useState<boolean>(false);
  const [limit, setLimit]       = useState<LimitInfo | null>(null);
  const [adWatching, setAdWatching] = useState(false);

  // Sync incoming server content into the editable draft once when first loaded
  // or when the server version changes (e.g. after save).
  useEffect(() => {
    if (cv && !editing) setDraft(cv.content);
  }, [cv, editing]);

  const stale = editing && cv && draft !== cv.content;

  const onAiDraft = async () => {
    setDrafting(true);
    setLimit(null);
    try {
      const r = await fetch("/api/cover-letter/draft", { method: "POST" });
      if (r.status === 402) { setLimit(await r.json()); return; }
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        alert(data.error ?? "AI 起草失敗，請稍後再試");
        return;
      }
      const { content } = await r.json();
      setDraft(content);
      setEditing(true);
    } finally {
      setDrafting(false);
    }
  };

  const onSave = async () => {
    if (!draft.trim()) { alert("CV 內容不可為空"); return; }
    setSaving(true);
    try {
      const r = await fetch("/api/cover-letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: draft }),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        alert(data.error ?? "儲存失敗");
        return;
      }
      setEditing(false);
      mutate();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card" style={{ padding: 18, marginTop: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div className="eyebrow">個人 CV (Cover Letter)</div>
          <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 4 }}>
            {cv ? `v${cv.version} · 最後儲存 ${new Date(cv.createdAt).toLocaleString("zh-TW", { dateStyle: "short", timeStyle: "short" })}`
                : "尚未建立"}
            {stale && <span style={{ color: "oklch(50% .12 30)", marginLeft: 8 }}>· 未儲存變更</span>}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn" onClick={onAiDraft} disabled={drafting} style={{ fontSize: 12 }}>
            {drafting ? <><span className="spinner" style={{ width: 10, height: 10 }} /> AI 起草中…</>
                      : (cv ? "✨ AI 重新起草" : "✨ AI 起草")}
          </button>
          <button className="btn primary" onClick={onSave} disabled={saving || !stale} style={{ fontSize: 12 }}>
            {saving ? "儲存中…" : "儲存"}
          </button>
        </div>
      </div>

      {limit && !adWatching && (
        <div style={{ marginTop: 12, padding: "12px 14px", background: "oklch(98% .02 30)", border: "1px solid oklch(88% .06 30)", borderRadius: 8 }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4, color: "oklch(40% .12 30)" }}>本月履歷+CV 配額已用完</div>
          <div style={{ fontSize: 12, color: "var(--ink-3)", marginBottom: 8 }}>
            解析券：<b>{limit.tickets}</b> 張
            {limit.planTier === "free" && <>　·　廣告解鎖剩餘：<b>{limit.adSessionsLeft}</b> 次</>}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {AD_UNLOCK_ENABLED && limit.planTier === "free" && limit.adSessionsLeft > 0 && (
              <button className="btn primary" style={{ fontSize: 13 }} onClick={() => setAdWatching(true)}>
                📺 看廣告獲得 +1 解析券
              </button>
            )}
            <a className="btn" href="/pricing" style={{ fontSize: 13 }}>🚀 升級方案</a>
          </div>
        </div>
      )}
      {adWatching && (
        <div style={{ marginTop: 12 }}>
          <AdWatcher
            ticketCost={1}
            onComplete={() => { setAdWatching(false); setLimit(null); onAiDraft(); }}
            onCancel={() => setAdWatching(false)}
          />
        </div>
      )}

      <textarea
        value={draft}
        onChange={(e) => { setDraft(e.target.value); setEditing(true); }}
        placeholder="貼上或撰寫你的個人 cover letter… 也可點上方「AI 起草」由 AI 依你的履歷產生初稿，再自行修改"
        style={{
          width: "100%", marginTop: 12, padding: 12, minHeight: 220,
          fontFamily: "inherit", fontSize: 13.5, lineHeight: 1.6,
          border: "1px solid var(--line)", borderRadius: 6, background: "var(--bg)",
          color: "var(--ink-1)", resize: "vertical",
        }}
      />
      <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 6 }}>
        每次 AI 起草消耗 1 次「履歷+CV 配額」（與履歷解析共用）。手動儲存不計費。
      </div>
    </div>
  );
}
