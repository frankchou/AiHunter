"use client";
import { useState } from "react";
import { signOut, useSession } from "next-auth/react";

export function SettingsView() {
  const { data: session } = useSession();

  // Notification prefs (local state for now)
  const [minScore, setMinScore] = useState(70);
  const [emailDigest, setEmailDigest] = useState(false);
  const [pushNew, setPushNew] = useState(true);

  // Display prefs
  const [language, setLanguage] = useState("zh-TW");

  // Privacy
  const [shareAnalytics, setShareAnalytics] = useState(true);

  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="app-content">
      <div className="section-h">
        <h3>設定</h3>
        <span className="sub">帳號與個人偏好</span>
      </div>

      <div style={{ display: "grid", gap: 16, maxWidth: 600 }}>
        {/* Account */}
        <div className="card" style={{ padding: 18 }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>帳號資訊</div>
          {session?.user && (
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
              {session.user.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={session.user.image}
                  alt={session.user.name ?? ""}
                  style={{ width: 52, height: 52, borderRadius: "50%", border: "2px solid var(--line)" }}
                />
              ) : (
                <div style={{ width: 52, height: 52, borderRadius: "50%", background: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, color: "#fff", fontWeight: 700 }}>
                  {(session.user.name?.[0] ?? "U").toUpperCase()}
                </div>
              )}
              <div>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{session.user.name}</div>
                <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 2 }}>{session.user.email}</div>
                <div style={{ fontSize: 11, color: "var(--ink-4)", marginTop: 2 }}>
                  方案：Free
                </div>
              </div>
            </div>
          )}
          <button
            className="btn"
            style={{ color: "#e53e3e" }}
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            登出
          </button>
        </div>

        {/* Notifications */}
        <div className="card" style={{ padding: 18 }}>
          <div className="eyebrow" style={{ marginBottom: 14 }}>通知設定</div>

          <div style={{ display: "grid", gap: 16 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 500, display: "block", marginBottom: 8 }}>
                最低推薦分數門檻：<span style={{ color: "var(--primary)", fontWeight: 700 }}>{minScore} 分</span>
              </label>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={minScore}
                onChange={(e) => setMinScore(Number(e.target.value))}
                style={{ width: "100%", accentColor: "var(--primary)" }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--ink-3)", marginTop: 2 }}>
                <span>0 分（全部）</span>
                <span>100 分（僅頂尖）</span>
              </div>
            </div>

            <Toggle
              label="推播新職缺提醒"
              sub="有符合條件的新職缺時通知我"
              checked={pushNew}
              onChange={setPushNew}
            />
            <Toggle
              label="每日 Email 摘要"
              sub="每天寄送今日最佳職缺"
              checked={emailDigest}
              onChange={setEmailDigest}
            />
          </div>
        </div>

        {/* Display */}
        <div className="card" style={{ padding: 18 }}>
          <div className="eyebrow" style={{ marginBottom: 14 }}>顯示語言</div>
          <div style={{ display: "flex", gap: 8 }}>
            {[["zh-TW", "繁體中文"], ["en", "English"]].map(([val, label]) => (
              <button
                key={val}
                onClick={() => setLanguage(val)}
                className={`btn${language === val ? " primary" : ""}`}
                style={{ fontSize: 13 }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Privacy */}
        <div className="card" style={{ padding: 18 }}>
          <div className="eyebrow" style={{ marginBottom: 14 }}>隱私設定</div>
          <Toggle
            label="分享使用分析資料"
            sub="協助我們改善推薦品質（不包含個人資料）"
            checked={shareAnalytics}
            onChange={setShareAnalytics}
          />
        </div>

        <button className="btn primary" onClick={handleSave} style={{ alignSelf: "flex-start" }}>
          {saved ? "已儲存 ✓" : "儲存設定"}
        </button>
      </div>
    </div>
  );
}

function Toggle({ label, sub, checked, onChange }: {
  label: string; sub?: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500 }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 2 }}>{sub}</div>}
      </div>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        style={{
          width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer",
          background: checked ? "var(--primary)" : "var(--line)",
          position: "relative", flexShrink: 0, transition: "background .2s",
        }}
      >
        <span style={{
          position: "absolute", top: 3, left: checked ? 22 : 3,
          width: 18, height: 18, borderRadius: "50%", background: "#fff",
          transition: "left .2s", display: "block",
        }} />
      </button>
    </div>
  );
}
