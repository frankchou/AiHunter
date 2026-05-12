"use client";
import { signIn } from "next-auth/react";
import { Logo } from "@/components/ui/Logo";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { LandingFooter } from "@/components/landing/LandingFooter";
import "@/components/landing/landing.css";

export function LoginPage() {
  return (
    <div className="landing" style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <LandingHeader compact hideAuth />
      <main style={{
        flex: 1,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "60px 24px",
      }}>
      <div style={{ width: "100%", maxWidth: 380, textAlign: "center" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 6 }}>
          <Logo size={40} />
          <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 28, letterSpacing: "-.03em" }}>
            AI Hunter
          </span>
        </div>
        <div style={{ fontSize: 14, color: "var(--ink-3)", marginBottom: 36 }}>
          AI 驅動求職助手 — 掃描全球職缺，量身定制面試策略
        </div>

        <div className="card" style={{ padding: 28 }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>歡迎回來</div>
          <div style={{ fontSize: 13, color: "var(--ink-3)", marginBottom: 22 }}>
            使用 Google 帳號登入，立即開始
          </div>

          <button
            onClick={() => signIn("google", { callbackUrl: "/feed" })}
            style={{
              width: "100%", display: "flex", alignItems: "center", justifyContent: "center",
              gap: 10, padding: "11px 16px", borderRadius: 8,
              border: "1px solid var(--line)", background: "var(--bg-elev)",
              cursor: "pointer", fontSize: 14, fontWeight: 500, fontFamily: "inherit",
              color: "var(--ink)", transition: "background .15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-soft)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "var(--bg-elev)")}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
              <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
            使用 Google 登入
          </button>

          <div style={{ marginTop: 18, fontSize: 11, color: "var(--ink-4)", lineHeight: 1.6 }}>
            登入即表示同意本服務條款。<br />僅供個人求職使用。
          </div>
        </div>

        <div style={{ marginTop: 24, fontSize: 11, color: "var(--ink-4)", display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
          <span>Powered by Claude claude-sonnet-4-6</span>
          <span>·</span>
          <span>104 / Remotive / Adzuna</span>
        </div>
      </div>
      </main>
      <LandingFooter />
    </div>
  );
}
