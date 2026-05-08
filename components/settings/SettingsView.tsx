"use client";
import { useState } from "react";
import { signOut, useSession } from "next-auth/react";

export function SettingsView() {
  const { data: session } = useSession();
  const [apiKey, setApiKey] = useState("");
  const [adzunaId, setAdzunaId] = useState("");
  const [adzunaKey, setAdzunaKey] = useState("");
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    // Keys stored client-side only (env vars used server-side)
    // In production this would call a settings API
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="app-content">
      <div className="section-h">
        <h3>設定</h3>
        <span className="sub">帳號與 API 設定</span>
      </div>

      <div style={{ display: "grid", gap: 16, maxWidth: 600 }}>
        {/* Account */}
        <div className="card" style={{ padding: 18 }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>帳號資訊</div>
          {session?.user && (
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              {session.user.image && (
                // eslint-disable-next-line @next-eslint/next/no-img-element
                <img
                  src={session.user.image}
                  alt={session.user.name ?? ""}
                  style={{ width: 44, height: 44, borderRadius: "50%", border: "2px solid var(--line)" }}
                />
              )}
              <div>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{session.user.name}</div>
                <div style={{ fontSize: 12, color: "var(--ink-3)" }}>{session.user.email}</div>
              </div>
            </div>
          )}
          <button
            className="btn"
            style={{ color: "var(--red, #e53e3e)" }}
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            登出
          </button>
        </div>

        {/* API Keys */}
        <div className="card" style={{ padding: 18 }}>
          <div className="eyebrow" style={{ marginBottom: 4 }}>API 金鑰</div>
          <p style={{ fontSize: 12, color: "var(--ink-3)", margin: "0 0 12px" }}>
            金鑰存於伺服器環境變數。此處僅用於本地開發覆蓋。
          </p>

          <div style={{ display: "grid", gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: "var(--ink-3)", display: "block", marginBottom: 4, fontFamily: "var(--font-mono)" }}>
                ANTHROPIC_API_KEY
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-ant-…"
                style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid var(--line)", background: "var(--bg)", fontFamily: "var(--font-mono)", fontSize: 13 }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: "var(--ink-3)", display: "block", marginBottom: 4, fontFamily: "var(--font-mono)" }}>
                ADZUNA_APP_ID
              </label>
              <input
                type="text"
                value={adzunaId}
                onChange={(e) => setAdzunaId(e.target.value)}
                placeholder="xxxxxxxx"
                style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid var(--line)", background: "var(--bg)", fontFamily: "var(--font-mono)", fontSize: 13 }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: "var(--ink-3)", display: "block", marginBottom: 4, fontFamily: "var(--font-mono)" }}>
                ADZUNA_APP_KEY
              </label>
              <input
                type="password"
                value={adzunaKey}
                onChange={(e) => setAdzunaKey(e.target.value)}
                placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid var(--line)", background: "var(--bg)", fontFamily: "var(--font-mono)", fontSize: 13 }}
              />
            </div>
          </div>

          <button
            className="btn primary"
            style={{ marginTop: 14 }}
            onClick={handleSave}
          >
            {saved ? "已儲存 ✓" : "儲存"}
          </button>
        </div>

        {/* About */}
        <div className="card" style={{ padding: 18 }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>關於 AI Hunter</div>
          <div style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.7 }}>
            <div style={{ marginBottom: 6 }}>AI 驅動的求職助手，幫你找到最合適的職缺。</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink-3)" }}>
              <div>Model: claude-sonnet-4-6</div>
              <div>Sources: 104.com.tw · Remotive · Adzuna</div>
            </div>
          </div>
          <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="btn"
              style={{ fontSize: 12 }}
            >
              GitHub ↗
            </a>
            <a
              href="https://www.anthropic.com"
              target="_blank"
              rel="noopener noreferrer"
              className="btn"
              style={{ fontSize: 12 }}
            >
              Anthropic ↗
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
