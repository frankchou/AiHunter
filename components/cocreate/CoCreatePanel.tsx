"use client";
import { useEffect, useRef, useState } from "react";
import useSWR, { mutate as globalMutate } from "swr";
import type { DocKind } from "@/lib/ai/co-create";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export interface CoCreateContext {
  docKind: DocKind;
  jobId?:  string;
  // Human label shown in the header so the user knows the chat scope
  label:   string;
}

interface ChatMessage {
  id:         string;
  role:       "user" | "assistant";
  content:    string;
  editTarget: string | null;
  editBefore: string | null;
  editAfter:  string | null;
  applied:    boolean;
  createdAt:  string;
}

interface ThreadSummary {
  id: string;
  title: string;
  docKind: string;
  jobId: string | null;
  updatedAt: string;
  _count: { messages: number };
}

interface ThreadDetail {
  id: string;
  title: string;
  docKind: string;
  jobId: string | null;
  messages: ChatMessage[];
}

export function CoCreatePanel({ ctx, onClose }: { ctx: CoCreateContext; onClose: () => void }) {
  // Threads list (scoped to this doc)
  const threadListKey = `/api/chat/threads?docKind=${ctx.docKind}${ctx.jobId ? `&jobId=${ctx.jobId}` : ""}`;
  const { data: list } = useSWR<{ threads: ThreadSummary[] }>(threadListKey, fetcher);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [view, setView] = useState<"chat" | "history">("chat");

  // Auto-pick most recent thread on first open
  useEffect(() => {
    if (!activeId && list?.threads && list.threads.length > 0) {
      setActiveId(list.threads[0].id);
    }
  }, [list, activeId]);

  const threadKey = activeId ? `/api/chat/threads/${activeId}` : null;
  const { data: thread, mutate: mutateThread } = useSWR<{ thread: ThreadDetail }>(threadKey, fetcher);

  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread?.thread?.messages?.length]);

  const ensureThread = async (): Promise<string | null> => {
    if (activeId) return activeId;
    const res = await fetch("/api/chat/threads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ docKind: ctx.docKind, jobId: ctx.jobId ?? null }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error === "MAX_ONLY" ? "AI 共創為 Max 旗艦專屬功能" : "建立對話失敗");
      return null;
    }
    const { thread: t } = await res.json();
    setActiveId(t.id);
    globalMutate(threadListKey);
    return t.id as string;
  };

  const send = async () => {
    if (!draft.trim() || sending) return;
    const id = await ensureThread();
    if (!id) return;

    setSending(true);
    const text = draft.trim();
    setDraft("");
    try {
      const r = await fetch(`/api/chat/threads/${id}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        alert(data.error ?? "發送失敗");
        setDraft(text);
        return;
      }
      mutateThread();
      globalMutate(threadListKey);
    } finally {
      setSending(false);
    }
  };

  const apply = async (msgId: string) => {
    if (!activeId) return;
    const r = await fetch(`/api/chat/threads/${activeId}/apply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId: msgId }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) { alert(data.error ?? "套用失敗"); return; }
    mutateThread();
    // Trigger relevant page-level data refresh
    if (ctx.docKind === "cv-a")     globalMutate("/api/cover-letter");
    if (ctx.docKind === "resume-a") globalMutate("/api/resume");
    if (ctx.docKind === "cv-b" && ctx.jobId)     globalMutate(`/api/jobs/${ctx.jobId}/cover-letter`);
    if (ctx.docKind === "resume-b" && ctx.jobId) globalMutate(`/api/jobs/${ctx.jobId}/cv`);
  };

  const newThread = async () => {
    setActiveId(null);
    setView("chat");
  };

  const removeThread = async (id: string) => {
    if (!confirm("確定刪除這場對話？")) return;
    await fetch(`/api/chat/threads/${id}`, { method: "DELETE" });
    if (id === activeId) setActiveId(null);
    globalMutate(threadListKey);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.35)", zIndex: 200 }}
      />
      {/* Panel */}
      <div className="cocreate-panel">
        <div className="cocreate-head">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>🤖 AI 共創助理</div>
            <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              編輯中：{ctx.label}
            </div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button className="btn" style={{ fontSize: 11, padding: "4px 8px" }}
              onClick={() => setView(view === "chat" ? "history" : "chat")}>
              {view === "chat" ? "📜 歷史" : "← 返回"}
            </button>
            <button className="btn" style={{ fontSize: 11, padding: "4px 8px" }} onClick={newThread}>
              ➕ 新對話
            </button>
            <button className="btn" style={{ fontSize: 11, padding: "4px 8px" }} onClick={onClose}>
              ✕
            </button>
          </div>
        </div>

        {view === "history" ? (
          <div className="cocreate-body">
            <div style={{ fontSize: 11, color: "var(--ink-3)", padding: "8px 12px" }}>
              最近 30 場對話（同一份文件）
            </div>
            {(list?.threads ?? []).map((t) => (
              <div
                key={t.id}
                style={{
                  display: "flex", gap: 6, alignItems: "center",
                  padding: "10px 12px", borderTop: "1px solid var(--line)",
                  background: t.id === activeId ? "var(--bg-soft)" : undefined,
                }}
              >
                <button
                  onClick={() => { setActiveId(t.id); setView("chat"); }}
                  style={{
                    flex: 1, textAlign: "left", background: "none", border: "none",
                    cursor: "pointer", padding: 0, color: "var(--ink-1)",
                    fontFamily: "inherit", fontSize: 13, minWidth: 0,
                  }}
                >
                  <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {t.title}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 2 }}>
                    {t._count.messages} 則 · {new Date(t.updatedAt).toLocaleString("zh-TW", { dateStyle: "short", timeStyle: "short" })}
                  </div>
                </button>
                <button className="btn" style={{ fontSize: 11, padding: "3px 8px" }} onClick={() => removeThread(t.id)}>
                  刪
                </button>
              </div>
            ))}
            {(list?.threads ?? []).length === 0 && (
              <div style={{ fontSize: 13, color: "var(--ink-3)", padding: 24, textAlign: "center" }}>
                尚無歷史對話
              </div>
            )}
          </div>
        ) : (
          <div className="cocreate-body">
            {!thread && !activeId && (
              <div style={{ padding: 24, textAlign: "center", color: "var(--ink-3)", fontSize: 13 }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>✨</div>
                <div style={{ fontWeight: 600, color: "var(--ink-1)", marginBottom: 4 }}>開始與 AI 共創</div>
                <div>輸入問題或要求，AI 會根據你的文件給建議。</div>
                <div style={{ marginTop: 12, fontSize: 11 }}>
                  例如：「幫我把 summary 改更有衝擊性」、「這條 bullet 加數字」
                </div>
              </div>
            )}
            {thread?.thread?.messages.map((m) => (
              <MessageRow key={m.id} m={m} onApply={() => apply(m.id)} />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}

        <div className="cocreate-input">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="輸入訊息… (Enter 送出，Shift+Enter 換行)"
            disabled={sending}
            rows={2}
            style={{
              width: "100%", padding: 10, fontFamily: "inherit", fontSize: 13.5,
              border: "1px solid var(--line)", borderRadius: 6, background: "var(--bg)",
              resize: "none", lineHeight: 1.5, color: "var(--ink-1)",
            }}
          />
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
            <button className="btn primary" onClick={send} disabled={sending || !draft.trim()} style={{ fontSize: 13 }}>
              {sending ? "傳送中…" : "送出"}
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        .cocreate-panel {
          position: fixed; z-index: 201;
          background: var(--bg-elev);
          display: flex; flex-direction: column;
          box-shadow: -8px 0 32px rgba(0,0,0,.18);
        }
        @media (min-width: 768px) {
          .cocreate-panel {
            top: 0; right: 0; bottom: 0; width: 480px; max-width: 90vw;
            border-left: 1px solid var(--line);
          }
        }
        @media (max-width: 767px) {
          .cocreate-panel {
            top: 0; left: 0; right: 0; bottom: 0;
          }
        }
        .cocreate-head {
          display: flex; align-items: center; gap: 10px;
          padding: 12px 14px; border-bottom: 1px solid var(--line);
        }
        .cocreate-body {
          flex: 1; overflow-y: auto; padding: 12px;
          display: flex; flex-direction: column; gap: 10px;
        }
        .cocreate-input {
          padding: 10px 12px; border-top: 1px solid var(--line); background: var(--bg);
        }
      `}</style>
    </>
  );
}

function MessageRow({ m, onApply }: { m: ChatMessage; onApply: () => void }) {
  const isUser = m.role === "user";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: isUser ? "flex-end" : "flex-start" }}>
      <div
        style={{
          maxWidth: "92%",
          padding: "8px 12px",
          borderRadius: 10,
          background: isUser ? "oklch(60% .18 250)" : "var(--bg-soft)",
          color: isUser ? "white" : "var(--ink-1)",
          fontSize: 13.5,
          lineHeight: 1.6,
          whiteSpace: "pre-wrap",
        }}
      >
        {m.content}
      </div>
      {!isUser && m.editTarget && m.editAfter != null && (
        <div
          style={{
            maxWidth: "92%",
            border: "1px solid var(--line)",
            borderRadius: 8,
            padding: 10,
            background: "var(--bg)",
            fontSize: 12,
          }}
        >
          <div style={{ fontSize: 10, color: "var(--ink-3)", marginBottom: 4, fontFamily: "var(--font-mono)" }}>
            修改目標：{m.editTarget}
          </div>
          {m.editBefore && (
            <div style={{ marginBottom: 6 }}>
              <div className="eyebrow" style={{ fontSize: 10, marginBottom: 2 }}>修改前</div>
              <div style={{ background: "oklch(96% .03 30)", padding: 6, borderRadius: 4, color: "oklch(35% .12 30)" }}>{m.editBefore}</div>
            </div>
          )}
          <div>
            <div className="eyebrow" style={{ fontSize: 10, marginBottom: 2 }}>修改後</div>
            <div style={{ background: "oklch(96% .04 145)", padding: 6, borderRadius: 4, color: "oklch(35% .12 145)" }}>{m.editAfter}</div>
          </div>
          <div style={{ marginTop: 8, display: "flex", justifyContent: "flex-end" }}>
            {m.applied
              ? <span style={{ fontSize: 11, color: "oklch(40% .15 145)" }}>✓ 已套用</span>
              : <button className="btn primary" onClick={onApply} style={{ fontSize: 11, padding: "4px 10px" }}>套用</button>}
          </div>
        </div>
      )}
    </div>
  );
}
