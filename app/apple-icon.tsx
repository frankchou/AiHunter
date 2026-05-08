import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          borderRadius: 40,
          background: "linear-gradient(135deg, #0d1117 0%, #0f1a2e 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
      >
        {/* Corner brackets */}
        <div style={{ position: "absolute", top: 18, left: 18, width: 28, height: 28, borderTop: "2px solid rgba(56,189,248,0.5)", borderLeft: "2px solid rgba(56,189,248,0.5)" }} />
        <div style={{ position: "absolute", top: 18, right: 18, width: 28, height: 28, borderTop: "2px solid rgba(56,189,248,0.5)", borderRight: "2px solid rgba(56,189,248,0.5)" }} />
        <div style={{ position: "absolute", bottom: 18, left: 18, width: 28, height: 28, borderBottom: "2px solid rgba(56,189,248,0.5)", borderLeft: "2px solid rgba(56,189,248,0.5)" }} />
        <div style={{ position: "absolute", bottom: 18, right: 18, width: 28, height: 28, borderBottom: "2px solid rgba(56,189,248,0.5)", borderRight: "2px solid rgba(56,189,248,0.5)" }} />

        {/* A left leg */}
        <div
          style={{
            position: "absolute",
            width: 10,
            height: 80,
            background: "linear-gradient(180deg, #ffffff 0%, #7dd3fc 100%)",
            borderRadius: 5,
            top: 40,
            left: 48,
            transform: "rotate(18deg)",
            transformOrigin: "top center",
          }}
        />
        {/* A right leg */}
        <div
          style={{
            position: "absolute",
            width: 10,
            height: 80,
            background: "linear-gradient(180deg, #ffffff 0%, #7dd3fc 100%)",
            borderRadius: 5,
            top: 40,
            right: 48,
            transform: "rotate(-18deg)",
            transformOrigin: "top center",
          }}
        />
        {/* A crossbar */}
        <div
          style={{
            position: "absolute",
            width: 62,
            height: 8,
            background: "linear-gradient(90deg, #38bdf8 0%, #818cf8 100%)",
            borderRadius: 4,
            top: 108,
            left: 59,
          }}
        />
        {/* Apex dot */}
        <div
          style={{
            position: "absolute",
            width: 20,
            height: 20,
            borderRadius: "50%",
            background: "#38bdf8",
            top: 28,
            left: 80,
            boxShadow: "0 0 16px #38bdf8",
          }}
        />
        <div
          style={{
            position: "absolute",
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: "#ffffff",
            top: 33,
            left: 85,
          }}
        />
      </div>
    ),
    { ...size }
  );
}
