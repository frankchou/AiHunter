"use client";
import { useState, useEffect } from "react";
import { signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { PLANS, currentMonth } from "@/lib/plans";
import type { PlanTier } from "@/lib/plans";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface UserProfile {
  planTier: string;
  isSuperUser?: boolean;
  insightsUsed: number;
  analysisUsed: number;
  usageMonth: string | null;
  stripeCustomerId: string | null;
}

interface Prefs {
  minScore?: number;
  pushEnabled?: boolean;
  emailDigestEnabled?: boolean;
}

export function SettingsView() {
  const { data: session } = useSession();
  const router = useRouter();
  const { data: profile } = useSWR<UserProfile>("/api/user/profile", fetcher);
  const { data: prefs, mutate: mutatePrefs } = useSWR<Prefs>("/api/preferences", fetcher);

  // SuperUser bypasses all plan limits → render as Max for status displays.
  const tier = ((profile?.isSuperUser ? "max" : profile?.planTier) ?? "free") as PlanTier;
  const plan = PLANS[tier];
  const month = currentMonth();
  const resetNeeded = profile?.usageMonth !== month;
  const insightsUsed = resetNeeded ? 0 : (profile?.insightsUsed ?? 0);
  const analysisUsed = resetNeeded ? 0 : (profile?.analysisUsed ?? 0);
  const insightsLimit = plan.limits.insightsPerMonth;
  const analysisLimit = plan.limits.analysisPerMonth;

  // Notification prefs — persisted in DB via /api/preferences. Phase 1
  // only stores state; actual push/email pipeline ships in Phase 2/3.
  const [minScore, setMinScore] = useState(70);
  const [emailDigest, setEmailDigest] = useState(false);
  const [pushNew, setPushNew] = useState(false);

  // Hydrate from server-side prefs once they load.
  useEffect(() => {
    if (prefs?.minScore !== undefined) setMinScore(prefs.minScore);
    if (prefs?.pushEnabled !== undefined) setPushNew(prefs.pushEnabled);
    if (prefs?.emailDigestEnabled !== undefined) setEmailDigest(prefs.emailDigestEnabled);
  }, [prefs?.minScore, prefs?.pushEnabled, prefs?.emailDigestEnabled]);

  // Display prefs (not persisted yet — i18n not wired).
  const [language, setLanguage] = useState("zh-TW");

  // Privacy
  const [shareAnalytics, setShareAnalytics] = useState(true);

  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch("/api/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          minScore,
          pushEnabled: pushNew,
          emailDigestEnabled: emailDigest,
        }),
      });
      await mutatePrefs();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
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

        {/* Plan */}
        <div className="card" style={{ padding: 18 }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>目前方案</div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 18 }}>
                {plan.nameZh}
                {plan.monthlyTwd > 0 && (
                  <span style={{ fontWeight: 400, fontSize: 13, color: "var(--ink-3)", marginLeft: 8 }}>
                    NT${plan.monthlyTwd}/月
                  </span>
                )}
              </div>
              <div style={{ marginTop: 10, display: "flex", gap: 20, fontSize: 13 }}>
                <div>
                  <div style={{ color: "var(--ink-3)", fontSize: 11, marginBottom: 3 }}>AI 分析</div>
                  <div style={{ fontWeight: 600 }}>
                    {insightsUsed} / {insightsLimit === null ? "∞" : insightsLimit}
                    <span style={{ fontWeight: 400, color: "var(--ink-3)", fontSize: 11, marginLeft: 4 }}>次/月</span>
                  </div>
                </div>
                <div>
                  <div style={{ color: "var(--ink-3)", fontSize: 11, marginBottom: 3 }}>履歷 + CV</div>
                  <div style={{ fontWeight: 600 }}>
                    {analysisUsed} / {analysisLimit === null ? "∞" : analysisLimit}
                    <span style={{ fontWeight: 400, color: "var(--ink-3)", fontSize: 11, marginLeft: 4 }}>次/月</span>
                  </div>
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {tier !== "free" && (
                <button className="btn" style={{ fontSize: 12 }} onClick={() => router.push("/settings/billing")}>
                  管理訂閱
                </button>
              )}
              <button className="btn primary" style={{ fontSize: 12 }} onClick={() => router.push("/pricing?from=settings")}>
                {tier === "free" ? "🚀 升級方案" : "查看方案"}
              </button>
            </div>
          </div>
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
              <div style={{ fontSize: 11, color: "var(--ink-4)", marginTop: 6 }}>
                職缺流會藏起低於此分數或尚未評分的項目
              </div>
            </div>

            <Toggle
              label="推播新職缺提醒"
              sub="有符合條件的新職缺時通知我（瀏覽器推播，即將推出）"
              checked={pushNew}
              onChange={setPushNew}
              comingSoon
            />
            <Toggle
              label="每日 Email 摘要"
              sub="每天寄送今日最佳職缺（即將推出）"
              checked={emailDigest}
              onChange={setEmailDigest}
              comingSoon
            />
          </div>
        </div>

        {/* Display */}
        <div className="card" style={{ padding: 18 }}>
          <div className="eyebrow" style={{ marginBottom: 14 }}>顯示語言</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => setLanguage("zh-TW")}
              className={`btn${language === "zh-TW" ? " primary" : ""}`}
              style={{ fontSize: 13 }}
            >
              繁體中文
            </button>
            <button
              disabled
              title="敬請期待"
              className="btn"
              style={{
                fontSize: 13,
                opacity: 0.5,
                cursor: "not-allowed",
                color: "var(--ink-3)",
              }}
            >
              English（敬請期待）
            </button>
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

        <button
          className="btn primary"
          onClick={handleSave}
          disabled={saving}
          style={{ alignSelf: "stretch", textAlign: "center", justifyContent: "center" }}
        >
          {saving ? "儲存中…" : saved ? "已儲存 ✓" : "儲存設定"}
        </button>
      </div>
    </div>
  );
}

function Toggle({
  label, sub, checked, onChange, comingSoon = false,
}: {
  label: string;
  sub?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  comingSoon?: boolean;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, opacity: comingSoon ? 0.5 : 1 }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500 }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 2 }}>{sub}</div>}
      </div>
      <button
        role="switch"
        aria-checked={checked}
        disabled={comingSoon}
        title={comingSoon ? "敬請期待" : undefined}
        onClick={() => !comingSoon && onChange(!checked)}
        style={{
          width: 44, height: 24, borderRadius: 12, border: "none",
          cursor: comingSoon ? "not-allowed" : "pointer",
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
