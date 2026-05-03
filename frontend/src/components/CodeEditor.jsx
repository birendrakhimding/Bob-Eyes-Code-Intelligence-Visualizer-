import React, { useRef } from "react";

export default function CodeEditor({ value, onChange, placeholder, background = "#0d0d14" }) {
  const textareaRef = useRef(null);
  const lineNumbersRef = useRef(null);
  const lines = value.split("\n");
  const lineCount = lines.length;

  const handleChange = (e) => {
    onChange(e.target.value);
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.scrollLeft = 0;
      }
    });
  };

  const handleScroll = () => {
    if (textareaRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  return (
    <div style={{ flex: 1, display: "flex", overflow: "hidden", background, minHeight: 0 }}>
      <div
        ref={lineNumbersRef}
        style={{
          padding: "16px 0",
          textAlign: "right",
          userSelect: "none",
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          fontSize: 13,
          lineHeight: 1.6,
          color: "#ffffff33",
          background: "#00000033",
          minWidth: 48,
          flexShrink: 0,
          overflow: "hidden",
        }}
      >
        {Array.from({ length: Math.max(lineCount, 1) }, (_, i) => (
          <div key={i} style={{ paddingRight: 12, paddingLeft: 8 }}>
            {i + 1}
          </div>
        ))}
      </div>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onScroll={handleScroll}
        placeholder={placeholder}
        spellCheck={false}
        style={{
          flex: 1,
          background: "transparent",
          color: "#e0e0e0",
          border: "none",
          padding: "16px 16px 16px 12px",
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          fontSize: 13,
          lineHeight: 1.6,
          resize: "none",
          outline: "none",
          tabSize: 4,
          whiteSpace: "pre",
          overflowWrap: "normal",
          overflowX: "auto",
          overflowY: "auto",
          minHeight: 0,
        }}
      />
    </div>
  );
}

// Made with Bob
