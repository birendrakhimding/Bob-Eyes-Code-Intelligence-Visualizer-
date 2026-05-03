import React from "react";
import { COLORS } from "../../config/constants";

export default function ClassGroupNode({ data }) {
  return (
    <div
      style={{
        background: "rgba(76,175,80,0.04)",
        border: `2px dashed ${COLORS.class.border}55`,
        borderRadius: 16,
        padding: 16,
        minWidth: data._groupWidth || 300,
        minHeight: data._groupHeight || 200,
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        position: "relative",
        opacity: data._dimmed ? 0.25 : 1,
        transition: "opacity 0.25s",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: -12,
          left: 16,
          background: "#0a0a12",
          padding: "2px 12px",
          borderRadius: 6,
          border: `1px solid ${COLORS.class.border}44`,
          fontSize: 11,
          fontWeight: 700,
          color: COLORS.class.accent,
          letterSpacing: "0.5px",
        }}
      >
        CLASS: {data.label}
      </div>
    </div>
  );
}

// Made with Bob
