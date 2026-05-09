"use client";
import { useState, useEffect, useRef } from "react";
import { AD_DURATION_SEC, AD_ADS_PER_SESSION, AD_UNLOCK_MONTHLY_CAP } from "@/lib/plans";

interface Props {
  ticketCost?: number;           // how many tickets this unlock is for (display only)
  onComplete: () => void;        // called after API confirms unlock
  onCancel?: () => void;
}

type Phase = "watching" | "unlocking" | "capped" | "error";

export function AdWatcher({ ticketCost = 1, onComplete, onCancel }: Props) {
  const [adIndex,   setAdIndex]   = useState(1);   // 1-based, 1..AD_ADS_PER_SESSION
  const [countdown, setCountdown] = useState(AD_DURATION_SEC);
  const [phase,     setPhase]     = useState<Phase>("watching");
  const [sessionsLeft, setSessionsLeft] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reset countdown whenever adIndex advances
  useEffect(() => { setCountdown(AD_DURATION_SEC); }, [adIndex]);

  useEffect(() => {
    if (phase !== "watching") return;

    timerRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c > 1) return c - 1;

        clearInterval(timerRef.current!);
        if (adIndex < AD_ADS_PER_SESSION) {
          // Move to next ad
          setAdIndex((i) => i + 1);
        } else {
          // All ads done — call unlock API
          setPhase("unlocking");
          fetch("/api/ads/unlock", { method: "POST" }).then(async (res) => {
            const data = await res.json().catch(() => ({}));
            if (res.status === 429) {
              setPhase("capped");
            } else if (res.ok) {
              setSessionsLeft(data.sessionsLeft ?? null);
              onComplete();
            } else {
              setPhase("error");
            }
          });
        }
        return 0;
      });
    }, 1000);

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adIndex, phase]);

  const pct = Math.round((countdown / AD_DURATION_SEC) * 100);

  if (phase === "capped") return (
    <div style={{ padding: "14px 16px", background: "oklch(98% .02 30)", border: "1px solid oklch(88% .06 30)", borderRadius: 8 }}>
      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4, color: "oklch(40% .12 30)" }}>
        本月廣告解鎖已達上限（{AD_UNLOCK_MONTHLY_CAP} 次）
      </div>
      <div style={{ fontSize: 12, color: "var(--ink-3)", marginBottom: 12 }}>
        下月自動重置，或升級方案獲得更多次數
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <a className="btn primary" href="/pricing" style={{ fontSize: 13 }}>🚀 升級方案</a>
        {onCancel && <button className="btn" onClick={onCancel} style={{ fontSize: 13 }}>稍後再說</button>}
      </div>
    </div>
  );

  if (phase === "error") return (
    <div style={{ padding: "14px 16px", background: "var(--bg-soft)", borderRadius: 8 }}>
      <div style={{ fontSize: 13, color: "var(--ink-3)", marginBottom: 8 }}>驗證失敗，請稍後再試</div>
      {onCancel && <button className="btn" onClick={onCancel} style={{ fontSize: 13 }}>關閉</button>}
    </div>
  );

  if (phase === "unlocking") return (
    <div style={{ padding: "14px 16px", background: "var(--bg-soft)", borderRadius: 8, textAlign: "center" }}>
      <span className="spinner" style={{ width: 16, height: 16, display: "inline-block", marginRight: 8 }} />
      <span style={{ fontSize: 13, color: "var(--ink-3)" }}>驗證中，即將解鎖 +{ticketCost} 張解析券…</span>
    </div>
  );

  // Watching phase
  return (
    <div style={{ padding: "14px 16px", background: "var(--bg-soft)", border: "1px solid var(--line)", borderRadius: 8 }}>
      {/* Ad progress indicator */}
      <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
        {Array.from({ length: AD_ADS_PER_SESSION }, (_, i) => (
          <div key={i} style={{
            flex: 1, height: 4, borderRadius: 2,
            background: i + 1 < adIndex ? "var(--primary)"
                      : i + 1 === adIndex ? "oklch(75% .15 250)"
                      : "var(--line)",
          }} />
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontSize: 13, color: "var(--ink-2)", fontWeight: 500 }}>
          廣告 {adIndex} / {AD_ADS_PER_SESSION}
        </span>
        <span style={{ fontWeight: 700, fontSize: 20, color: "var(--primary)", minWidth: 36, textAlign: "right" }}>
          {countdown}s
        </span>
      </div>

      {/* Simulated ad area — replace with real ad SDK */}
      <div style={{
        background: "var(--bg)", border: "1px dashed var(--line)", borderRadius: 6,
        padding: "20px 16px", textAlign: "center", marginBottom: 10,
      }}>
        <div style={{ fontSize: 11, color: "var(--ink-4)", marginBottom: 4 }}>廣告區域</div>
        <div style={{ fontSize: 12, color: "var(--ink-3)" }}>
          {/* ↑ Replace with: Google AdSense Rewarded / AdMob SDK */}
          觀看廣告以支持服務運營
        </div>
      </div>

      {/* Countdown progress bar */}
      <div style={{ height: 4, background: "var(--line)", borderRadius: 2, overflow: "hidden" }}>
        <div style={{
          height: "100%", width: `${pct}%`,
          background: "var(--primary)", transition: "width 1s linear", borderRadius: 2,
        }} />
      </div>

      <div style={{ fontSize: 11, color: "var(--ink-4)", marginTop: 6 }}>
        全程觀看後自動獲得 +{ticketCost} 張解析券（本月剩餘次數：
        {sessionsLeft !== null ? sessionsLeft : `最多 ${AD_UNLOCK_MONTHLY_CAP} 次`}）
      </div>
    </div>
  );
}
