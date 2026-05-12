// Replicates the official AI Hunter logo (from app/icon.tsx) as a real
// React component, so it can be rendered at any size in landing /
// header / footer instead of relying on the 32px favicon image.

interface Props {
  size?: number;
}

export function LogoMark({ size = 36 }: Props) {
  const s = size;
  const px = (n: number) => (n / 32) * s;   // scale everything off the 32px source
  return (
    <div
      style={{
        width: s,
        height: s,
        borderRadius: px(8),
        background: "linear-gradient(135deg, #0d1117 0%, #0f1a2e 100%)",
        display: "inline-block",
        position: "relative",
        flexShrink: 0,
      }}
    >
      {/* Corner brackets */}
      <div style={{ position: "absolute", top: px(3),    left: px(3),    width: px(5), height: px(5), borderTop: `1px solid rgba(56,189,248,.4)`, borderLeft:  `1px solid rgba(56,189,248,.4)` }} />
      <div style={{ position: "absolute", top: px(3),    right: px(3),   width: px(5), height: px(5), borderTop: `1px solid rgba(56,189,248,.4)`, borderRight: `1px solid rgba(56,189,248,.4)` }} />
      <div style={{ position: "absolute", bottom: px(3), left: px(3),    width: px(5), height: px(5), borderBottom: `1px solid rgba(56,189,248,.4)`, borderLeft:  `1px solid rgba(56,189,248,.4)` }} />
      <div style={{ position: "absolute", bottom: px(3), right: px(3),   width: px(5), height: px(5), borderBottom: `1px solid rgba(56,189,248,.4)`, borderRight: `1px solid rgba(56,189,248,.4)` }} />

      {/* A — left leg */}
      <div
        style={{
          position: "absolute",
          width: px(2), height: px(14),
          background: "linear-gradient(180deg, #ffffff 0%, #7dd3fc 100%)",
          borderRadius: px(2),
          top: px(7), left: px(9),
          transform: "rotate(18deg)", transformOrigin: "top center",
        }}
      />
      {/* A — right leg */}
      <div
        style={{
          position: "absolute",
          width: px(2), height: px(14),
          background: "linear-gradient(180deg, #ffffff 0%, #7dd3fc 100%)",
          borderRadius: px(2),
          top: px(7), right: px(9),
          transform: "rotate(-18deg)", transformOrigin: "top center",
        }}
      />
      {/* A — crossbar */}
      <div
        style={{
          position: "absolute",
          width: px(11), height: px(1.5),
          background: "linear-gradient(90deg, #38bdf8 0%, #818cf8 100%)",
          borderRadius: px(2),
          top: px(19), left: px(10.5),
        }}
      />
      {/* Apex glowing dot */}
      <div
        style={{
          position: "absolute",
          width: px(4), height: px(4), borderRadius: "50%",
          background: "#38bdf8",
          top: px(5), left: px(14),
          boxShadow: `0 0 ${px(4)}px #38bdf8`,
        }}
      />
      <div
        style={{
          position: "absolute",
          width: px(2), height: px(2), borderRadius: "50%",
          background: "#ffffff",
          top: px(6), left: px(15),
        }}
      />
    </div>
  );
}
