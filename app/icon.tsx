import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: "linear-gradient(135deg, #0d1117 0%, #0f1a2e 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
      >
        {/* Corner brackets */}
        <div style={{ position: "absolute", top: 3, left: 3, width: 5, height: 5, borderTop: "1px solid rgba(56,189,248,0.4)", borderLeft: "1px solid rgba(56,189,248,0.4)" }} />
        <div style={{ position: "absolute", top: 3, right: 3, width: 5, height: 5, borderTop: "1px solid rgba(56,189,248,0.4)", borderRight: "1px solid rgba(56,189,248,0.4)" }} />
        <div style={{ position: "absolute", bottom: 3, left: 3, width: 5, height: 5, borderBottom: "1px solid rgba(56,189,248,0.4)", borderLeft: "1px solid rgba(56,189,248,0.4)" }} />
        <div style={{ position: "absolute", bottom: 3, right: 3, width: 5, height: 5, borderBottom: "1px solid rgba(56,189,248,0.4)", borderRight: "1px solid rgba(56,189,248,0.4)" }} />

        {/* A left leg */}
        <div
          style={{
            position: "absolute",
            width: 2,
            height: 14,
            background: "linear-gradient(180deg, #ffffff 0%, #7dd3fc 100%)",
            borderRadius: 2,
            top: 7,
            left: 9,
            transform: "rotate(18deg)",
            transformOrigin: "top center",
          }}
        />
        {/* A right leg */}
        <div
          style={{
            position: "absolute",
            width: 2,
            height: 14,
            background: "linear-gradient(180deg, #ffffff 0%, #7dd3fc 100%)",
            borderRadius: 2,
            top: 7,
            right: 9,
            transform: "rotate(-18deg)",
            transformOrigin: "top center",
          }}
        />
        {/* A crossbar */}
        <div
          style={{
            position: "absolute",
            width: 11,
            height: 1.5,
            background: "linear-gradient(90deg, #38bdf8 0%, #818cf8 100%)",
            borderRadius: 2,
            top: 19,
            left: 10.5,
          }}
        />
        {/* Apex dot */}
        <div
          style={{
            position: "absolute",
            width: 4,
            height: 4,
            borderRadius: "50%",
            background: "#38bdf8",
            top: 5,
            left: 14,
            boxShadow: "0 0 4px #38bdf8",
          }}
        />
        <div
          style={{
            position: "absolute",
            width: 2,
            height: 2,
            borderRadius: "50%",
            background: "#ffffff",
            top: 6,
            left: 15,
          }}
        />
      </div>
    ),
    { ...size }
  );
}
