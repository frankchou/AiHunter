"use client";
import { useState } from "react";
import useSWR from "swr";
import { CoCreatePanel, type CoCreateContext } from "@/components/cocreate/CoCreatePanel";

const profileFetcher = (url: string) => fetch(url).then((r) => (r.ok ? r.json() : null));

interface ProfileShape {
  planTier?: string;
  isSuperUser?: boolean;
}

// Renders a floating button (bottom-right) that opens the AI co-create panel.
// Only visible to Max plan / super users. Caller passes the doc context that
// the chat is operating on (which doc the user is currently editing).
//
// Pages with multiple possible docs (e.g. /resume has both A 履歷 and A CV)
// can pass an array `contextOptions` and the user picks which to chat about
// when they open the panel.
export function CoCreateButton({
  context,
  contextOptions,
}: {
  context?: CoCreateContext;
  contextOptions?: CoCreateContext[];
}) {
  const { data: profile } = useSWR<ProfileShape>("/api/user/profile", profileFetcher, {
    revalidateOnFocus: false,
  });
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<CoCreateContext | null>(null);
  const [picking, setPicking] = useState(false);

  const isMax = !!profile && (profile.isSuperUser || profile.planTier === "max");
  if (!isMax) return null;

  const candidates = contextOptions ?? (context ? [context] : []);
  if (candidates.length === 0) return null;

  const onClick = () => {
    if (candidates.length === 1) {
      setPicked(candidates[0]);
      setOpen(true);
    } else {
      setPicking(true);
    }
  };

  return (
    <>
      <button
        onClick={onClick}
        title="AI 共創履歷"
        style={{
          position: "fixed",
          right: 20,
          bottom: 20,
          zIndex: 150,
          width: 56,
          height: 56,
          borderRadius: "50%",
          border: "none",
          background: "linear-gradient(135deg, oklch(60% .18 250), oklch(55% .22 280))",
          color: "white",
          fontSize: 24,
          cursor: "pointer",
          boxShadow: "0 6px 20px rgba(80, 80, 200, 0.35)",
        }}
      >
        ✨
      </button>

      {/* Doc context picker (when multiple options) */}
      {picking && (
        <div
          onClick={() => setPicking(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: "var(--bg-elev)", borderRadius: 10, padding: 18, minWidth: 280, maxWidth: 420 }}
          >
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 10 }}>要對哪份文件共創？</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {candidates.map((c) => (
                <button
                  key={`${c.docKind}-${c.jobId ?? ""}`}
                  className="btn"
                  onClick={() => { setPicked(c); setOpen(true); setPicking(false); }}
                  style={{ justifyContent: "flex-start", padding: "10px 12px", fontSize: 13 }}
                >
                  📝 {c.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {open && picked && (
        <CoCreatePanel ctx={picked} onClose={() => { setOpen(false); setPicked(null); }} />
      )}
    </>
  );
}
