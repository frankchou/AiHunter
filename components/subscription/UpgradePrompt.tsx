"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AD_DURATION_SEC } from "@/lib/plans";

interface Props {
  planTier: string;
  feature: "insight" | "cv";
  onUnlocked?: () => void;
  onClose?: () => void;
}

export function UpgradePrompt({ planTier, feature, onUnlocked, onClose }: Props) {
  const router = useRouter();
  const [watching, setWatching] = useState(false);
  const [countdown, setCountdown] = useState(AD_DURATION_SEC);
  const [unlocking, setUnlocking] = useState(false);
  const [done, setDone] = useState(false);

  const featureLabel = feature === "insight" ? "AI 深度分析" : "CV 客製";
  const isFree = planTier === "free";

  const startAd = () => {
    setWatching(true);
    setCountdown(AD_DURATION_SEC);
    const timer = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(timer);
          handleAdComplete();
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  };

  const handleAdComplete = async () => {
    setUnlocking(true);
    try {
      const res = await fetch("/api/ads/unlock", { method: "POST" });
      if (res.ok) {
        setDone(true);
        onUnlocked?.();
      }
    } finally {
      setUnlocking(false);
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,.5)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 200, padding: 20,
    }}>
      <div className="card" style={{ maxWidth: 440, width: "100%", padding: 28, position: "relative" }}>
        {onClose && (
          <button onClick={onClose} style={{ position: "absolute", top: 12, right: 14, background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "var(--ink-3)" }}>✕</button>
        )}

        {done ? (
          <div style={{ textAlign: "center", padding: "16px 0" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🎉</div>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>解鎖成功！</div>
            <div style={{ color: "var(--ink-3)", fontSize: 13, marginBottom: 20 }}>
              已解鎖 1 次{featureLabel}，請繼續操作
            </div>
            <button className="btn primary" onClick={onClose}>確認</button>
          </div>
        ) : watching ? (
          <div style={{ textAlign: "center", padding: "8px 0" }}>
            {/* Simulated ad area — replace with real ad SDK in production */}
            <div style={{
              background: "var(--bg-soft)", borderRadius: 8, padding: "32px 20px",
              marginBottom: 16, border: "1px solid var(--line)",
            }}>
              <div style={{ fontSize: 13, color: "var(--ink-3)", marginBottom: 8 }}>廣告播放中</div>
              <div style={{ fontSize: 36, fontWeight: 800, color: "var(--ink)", marginBottom: 4 }}>
                {countdown}
              </div>
              <div style={{ fontSize: 12, color: "var(--ink-3)" }}>秒後解鎖</div>
              {/* ↑ Replace this block with real ad SDK (Google AdMob / AdSense Rewarded) */}
            </div>
            <div style={{ fontSize: 12, color: "var(--ink-4)" }}>觀看廣告以支持服務運營，感謝你的理解</div>
            {unlocking && <div style={{ marginTop: 12, fontSize: 12, color: "var(--ink-3)" }}>驗證中…</div>}
          </div>
        ) : (
          <>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>🔒</div>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>
                本月{featureLabel}次數已用完
              </div>
              <div style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.6 }}>
                {isFree
                  ? `Free 方案每月 ${feature === "insight" ? "3" : "1"} 次免費使用。\n看完 30 秒廣告可解鎖 1 次額外使用。`
                  : "升級到更高方案以獲得更多次數。"}
              </div>
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              {isFree && (
                <button className="btn primary" onClick={startAd} style={{ width: "100%", padding: "10px 0" }}>
                  📺 觀看 30 秒廣告解鎖 1 次
                </button>
              )}
              <button
                className="btn"
                onClick={() => router.push("/pricing")}
                style={{ width: "100%", padding: "10px 0" }}
              >
                🚀 升級方案（$9.9/月起）
              </button>
              {onClose && (
                <button className="btn" onClick={onClose} style={{ width: "100%", color: "var(--ink-3)" }}>
                  稍後再說
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
