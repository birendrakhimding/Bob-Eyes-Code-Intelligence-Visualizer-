import React from "react";
import { Handle, Position } from "reactflow";
import { COLORS, IMPACT_COLORS } from "../../config/constants";

export default function FunctionNode({ data }) {
  const colors = COLORS[data.nodeType] || COLORS.function;
  const impact = data.impact ? IMPACT_COLORS[data.impact] : null;
  const isHighlighted = data._highlighted;
  const isMethod = data._isMethod;

  return (
    <div
      style={{
        background: colors.bg,
        border: `2px solid ${impact ? impact.border : colors.border}`,
        borderRadius: 12,
        padding: 0,
        minWidth: isMethod ? 240 : 260,
        maxWidth: 380,
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        fontSize: 12,
        boxShadow: impact
          ? `0 0 20px ${impact.glow}`
          : isHighlighted
          ? `0 0 24px rgba(165,155,255,0.5), 0 0 48px rgba(165,155,255,0.2)`
          : `0 4px 20px rgba(0,0,0,0.3)`,
        position: "relative",
        overflow: "hidden",
        opacity: data._dimmed ? 0.25 : 1,
        transition: "opacity 0.25s, box-shadow 0.25s",
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: colors.border, width: 10, height: 10 }} />

      {/* Header */}
      <div
        style={{
          background: `${colors.border}22`,
          padding: "10px 14px",
          borderBottom: `1px solid ${colors.border}44`,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span
          style={{
            background: colors.border,
            color: "#fff",
            padding: "2px 8px",
            borderRadius: 4,
            fontSize: 10,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.5px",
          }}
        >
          {isMethod ? "method" : data.nodeType}
        </span>
        <span style={{ color: colors.text, fontWeight: 600, fontSize: 13 }}>
          {data.label}
        </span>
        {data.impact && (
          <span
            style={{
              marginLeft: "auto",
              background: IMPACT_COLORS[data.impact].border,
              color: "#fff",
              padding: "2px 6px",
              borderRadius: 4,
              fontSize: 9,
              fontWeight: 700,
              textTransform: "uppercase",
            }}
          >
            {data.impact}
          </span>
        )}
      </div>

      {data.decorators?.length > 0 && (
        <div style={{ padding: "6px 14px 0", color: "#CE93D8", fontSize: 11 }}>
          {data.decorators.map((d, i) => (
            <div key={i}>{d}</div>
          ))}
        </div>
      )}

      {data.params?.length > 0 && (
        <div style={{ padding: "8px 14px 0" }}>
          <div style={{ color: colors.accent, fontSize: 10, marginBottom: 4, fontWeight: 600 }}>
            PARAMS
          </div>
          <div style={{ color: colors.text, opacity: 0.85, fontSize: 11 }}>
            ({data.params.join(", ")})
          </div>
        </div>
      )}

      {data.returnType && (
        <div style={{ padding: "6px 14px 0" }}>
          <span style={{ color: colors.accent, fontSize: 10, fontWeight: 600 }}>RETURNS </span>
          <span style={{ color: "#81C784", fontSize: 11 }}>{data.returnType}</span>
        </div>
      )}

      {data.bodySummary?.length > 0 && (
        <div style={{ padding: "8px 14px" }}>
          <div style={{ color: colors.accent, fontSize: 10, marginBottom: 4, fontWeight: 600 }}>
            LOGIC
          </div>
          {data.bodySummary.map((line, i) => (
            <div
              key={i}
              style={{
                color: colors.text,
                opacity: 0.75,
                fontSize: 11,
                padding: "2px 0",
                borderLeft: `2px solid ${colors.border}44`,
                paddingLeft: 8,
                marginBottom: 2,
              }}
            >
              {line}
            </div>
          ))}
        </div>
      )}

      {data.aiDescription && (
        <div
          style={{
            padding: "8px 14px 10px",
            borderTop: `1px solid ${colors.border}22`,
            background: `${colors.border}11`,
            color: "#A59BFF",
            fontSize: 11,
            fontStyle: "italic",
          }}
        >
          AI: {data.aiDescription}
        </div>
      )}

      {data.docstring && !data.aiDescription && (
        <div
          style={{
            padding: "8px 14px 10px",
            borderTop: `1px solid ${colors.border}22`,
            color: colors.accent,
            fontSize: 11,
            fontStyle: "italic",
            opacity: 0.8,
          }}
        >
          {data.docstring}
        </div>
      )}

      <div
        style={{
          padding: "4px 14px 8px",
          color: colors.text,
          opacity: 0.4,
          fontSize: 10,
          textAlign: "right",
        }}
      >
        Lines {data.lineStart}–{data.lineEnd}
      </div>

      <Handle type="source" position={Position.Bottom} style={{ background: colors.border, width: 10, height: 10 }} />
    </div>
  );
}

// Made with Bob
