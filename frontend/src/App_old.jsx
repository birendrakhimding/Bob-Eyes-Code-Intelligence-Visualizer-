import React, { useState, useCallback, useRef } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
  Handle,
  Position,
} from "reactflow";
import "reactflow/dist/style.css";

// ── Configuration ──────────────────────────────────────────

const API_URL = "http://localhost:8000";

const COLORS = {
  function: { bg: "#1a1a2e", border: "#6C63FF", text: "#E8E6FF", accent: "#A59BFF" },
  class: { bg: "#1a2a1a", border: "#4CAF50", text: "#E6FFE6", accent: "#81C784" },
  variable: { bg: "#2a1a1a", border: "#FF7043", text: "#FFE6DC", accent: "#FFAB91" },
  import: { bg: "#1a2a2a", border: "#26C6DA", text: "#E0F7FA", accent: "#80DEEA" },
  lambda: { bg: "#2a1a2a", border: "#AB47BC", text: "#F3E5F5", accent: "#CE93D8" },
};

const IMPACT_COLORS = {
  added: { border: "#4CAF50", glow: "rgba(76,175,80,0.3)" },
  modified: { border: "#FF9800", glow: "rgba(255,152,0,0.3)" },
  removed: { border: "#f44336", glow: "rgba(244,67,54,0.3)" },
  affected: { border: "#9C27B0", glow: "rgba(156,39,176,0.3)" },
  unchanged: { border: "#555", glow: "none" },
};

// ── Code Editor with Line Numbers ──────────────────────────

function CodeEditor({ value, onChange, placeholder, background = "#0d0d14" }) {
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

// ── Custom Node Components ─────────────────────────────────

function FunctionNode({ data }) {
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

// Group node: visually wraps a class and its methods
function ClassGroupNode({ data }) {
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

const nodeTypes = {
  codeNode: FunctionNode,
  classGroup: ClassGroupNode,
};

// ── SVG Glow Filters ──────────────────────────────────────

function GlowFilters() {
  return (
    <svg style={{ position: "absolute", width: 0, height: 0 }}>
      <defs>
        <filter id="edge-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <filter id="edge-glow-strong" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
    </svg>
  );
}

// ── Tree Layout Engine ─────────────────────────────────────

function computeLayout(apiNodes, apiEdges) {
  if (apiNodes.length === 0) return { rfNodes: [], rfEdges: [] };

  const NODE_W = 300;
  const NODE_H_BASE = 120;
  const H_GAP = 150;
  const V_GAP = 80;
  const GROUP_PAD = 24;
  const METHOD_H_GAP = 200;

  const idSet = new Set(apiNodes.map((n) => n.id));

  // Separate node types
  const imports = apiNodes.filter((n) => n.type === "import");
  const variables = apiNodes.filter((n) => n.type === "variable");
  const classes = apiNodes.filter((n) => n.type === "class");
  const functions = apiNodes.filter((n) => n.type === "function");

  // Build parent map: which functions belong to which class
  const classChildren = {};
  classes.forEach((c) => { classChildren[c.id] = []; });
  const topFunctions = [];

  functions.forEach((f) => {
    if (f.parent && classChildren[f.parent] !== undefined) {
      classChildren[f.parent].push(f);
    } else {
      topFunctions.push(f);
    }
  });

  // Build call graph among top-level callables (classes treated as single units + top functions)
  const topIds = new Set([
    ...classes.map((c) => c.id),
    ...topFunctions.map((f) => f.id),
  ]);

  // Map function names to their top-level owner (for methods, the class)
  const nameToTopId = {};
  classes.forEach((c) => {
    nameToTopId[c.name] = c.id;
    (classChildren[c.id] || []).forEach((m) => {
      nameToTopId[m.name] = c.id;
      nameToTopId[m.name.replace("async ", "")] = c.id;
    });
  });
  topFunctions.forEach((f) => {
    nameToTopId[f.name] = f.id;
    nameToTopId[f.name.replace("async ", "")] = f.id;
  });

  const callsOut = {};
  const calledBy = {};
  topIds.forEach((id) => { callsOut[id] = new Set(); calledBy[id] = new Set(); });

  apiEdges.forEach((e) => {
    const src = e.source;
    const tgt = e.target;
    // Find top-level owner of source and target
    let srcTop = topIds.has(src) ? src : null;
    let tgtTop = topIds.has(tgt) ? tgt : null;

    if (!srcTop) {
      const srcNode = apiNodes.find((n) => n.id === src);
      if (srcNode && srcNode.parent) srcTop = srcNode.parent;
    }
    if (!tgtTop) {
      const tgtNode = apiNodes.find((n) => n.id === tgt);
      if (tgtNode && tgtNode.parent) tgtTop = tgtNode.parent;
    }

    if (srcTop && tgtTop && srcTop !== tgtTop && topIds.has(srcTop) && topIds.has(tgtTop)) {
      callsOut[srcTop].add(tgtTop);
      calledBy[tgtTop].add(srcTop);
    }
  });

  // BFS to assign depths (top-down tree)
  const depths = {};
  const roots = [...topIds].filter((id) => calledBy[id].size === 0);
  if (roots.length === 0 && topIds.size > 0) {
    // No roots found, pick first
    roots.push([...topIds][0]);
  }

  const queue = [];
  roots.forEach((id) => { depths[id] = 0; queue.push(id); });

  while (queue.length > 0) {
    const cur = queue.shift();
    const nd = (depths[cur] || 0) + 1;
    callsOut[cur].forEach((child) => {
      if (depths[child] === undefined || nd > depths[child]) {
        depths[child] = nd;
        queue.push(child);
      }
    });
  }

  // Assign depth to anything still missing
  topIds.forEach((id) => { if (depths[id] === undefined) depths[id] = 0; });

  // Estimate node height
  function estHeight(node) {
    let h = 60;
    if (node.params?.length) h += 40;
    if (node.return_type) h += 20;
    if (node.body_summary?.length) h += 24 + node.body_summary.length * 22;
    if (node.docstring || node.ai_description) h += 30;
    h += 20;
    return Math.max(NODE_H_BASE, h);
  }

  // Group by depth
  const levels = {};
  topIds.forEach((id) => {
    const d = depths[id];
    if (!levels[d]) levels[d] = [];
    levels[d].push(id);
  });

  // Sort within each level by line_start
  const nodeById = {};
  apiNodes.forEach((n) => { nodeById[n.id] = n; });
  Object.values(levels).forEach((ids) => {
    ids.sort((a, b) => (nodeById[a]?.line_start || 0) - (nodeById[b]?.line_start || 0));
  });

  // Place imports and variables at the very top
  const resultNodes = [];
  let currentY = 0;

  // Row 0: imports
  if (imports.length > 0) {
    const rowW = imports.length * (NODE_W + H_GAP) - H_GAP;
    imports.forEach((imp, i) => {
      resultNodes.push({
        id: imp.id,
        type: "codeNode",
        position: { x: i * (NODE_W + H_GAP), y: currentY },
        data: buildNodeData(imp, false),
      });
    });
    currentY += NODE_H_BASE + V_GAP;
  }

  // Row 1: variables
  if (variables.length > 0) {
    variables.forEach((v, i) => {
      resultNodes.push({
        id: v.id,
        type: "codeNode",
        position: { x: i * (NODE_W + H_GAP), y: currentY },
        data: buildNodeData(v, false),
      });
    });
    currentY += NODE_H_BASE + V_GAP;
  }

  // Now place callable tree levels
  const sortedDepths = Object.keys(levels).map(Number).sort((a, b) => a - b);

  // Pre-compute sizes for class groups
  function classGroupSize(classNode) {
    const methods = classChildren[classNode.id] || [];
    if (methods.length === 0) {
      return { w: NODE_W + GROUP_PAD * 2, h: estHeight(classNode) + GROUP_PAD * 2 + 30 };
    }
    // Methods laid out horizontally inside the group
    const methodW = methods.length * (260 + METHOD_H_GAP) - METHOD_H_GAP + GROUP_PAD * 2;
    const maxMethodH = Math.max(...methods.map(estHeight));
    const classH = estHeight(classNode);
    const totalH = classH + 20 + maxMethodH + GROUP_PAD * 2 + 30;
    return { w: Math.max(NODE_W + GROUP_PAD * 2, methodW), h: totalH };
  }

  for (const depth of sortedDepths) {
    const ids = levels[depth];
    // Calculate total row width
    let totalW = 0;
    const itemWidths = [];
    ids.forEach((id) => {
      const node = nodeById[id];
      if (!node) return;
      if (node.type === "class") {
        const sz = classGroupSize(node);
        itemWidths.push({ id, w: sz.w, h: sz.h, isClass: true });
        totalW += sz.w;
      } else {
        const h = estHeight(node);
        itemWidths.push({ id, w: NODE_W, h, isClass: false });
        totalW += NODE_W;
      }
    });
    totalW += (itemWidths.length - 1) * H_GAP;

    let x = 0;
    let maxH = 0;

    itemWidths.forEach((item) => {
      const node = nodeById[item.id];
      if (!node) return;

      if (item.isClass) {
        const methods = classChildren[node.id] || [];
        const sz = classGroupSize(node);

        // Place group background node
        resultNodes.push({
          id: `group_${node.id}`,
          type: "classGroup",
          position: { x, y: currentY },
          data: {
            label: node.name,
            _groupWidth: sz.w,
            _groupHeight: sz.h,
          },
          style: { zIndex: -1 },
          selectable: false,
          draggable: false,
        });

        // Place the class node itself inside the group
        resultNodes.push({
          id: node.id,
          type: "codeNode",
          position: { x: x + GROUP_PAD, y: currentY + 30 },
          data: buildNodeData(node, false),
        });

        // Place methods below the class header inside the group
        const classNodeH = estHeight(node);
        const methodY = currentY + 30 + classNodeH + 20;

        methods.forEach((m, mi) => {
          resultNodes.push({
            id: m.id,
            type: "codeNode",
            position: {
              x: x + GROUP_PAD + mi * (260 + METHOD_H_GAP),
              y: methodY,
            },
            data: buildNodeData(m, true),
          });
        });

        x += sz.w + H_GAP;
        maxH = Math.max(maxH, sz.h);
      } else {
        resultNodes.push({
          id: node.id,
          type: "codeNode",
          position: { x, y: currentY },
          data: buildNodeData(node, false),
        });
        x += NODE_W + H_GAP;
        maxH = Math.max(maxH, item.h);
      }
    });

    currentY += maxH + V_GAP;
  }

  // Build edges
  const rfEdges = apiEdges
    .filter((e) => idSet.has(e.source) && idSet.has(e.target))
    .map((e, i) => {
      const edgeColor =
        e.label === "inherits" ? "#81C784" :
        e.label === "imports" ? "#80DEEA" :
        "#A59BFF";

      return {
        id: `e-${i}`,
        source: e.source,
        target: e.target,
        label: e.label || "calls",
        animated: true,
        type: "bezier",
        style: {
          stroke: edgeColor,
          strokeWidth: 3,
          opacity: 1,
          filter: "url(#edge-glow)",
        },
        labelStyle: {
          fill: "#ddd",
          fontSize: 10,
          fontWeight: 600,
        },
        labelBgStyle: {
          fill: "#0a0a12",
          fillOpacity: 0.95,
        },
        labelBgPadding: [6, 3],
        labelBgBorderRadius: 4,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: edgeColor,
          width: 18,
          height: 18,
        },
        _originalStroke: edgeColor,
        _originalWidth: 3,
      };
    });

  return { rfNodes: resultNodes, rfEdges };
}

function buildNodeData(node, isMethod) {
  return {
    label: node.name,
    nodeType: node.type,
    params: node.params,
    returnType: node.return_type,
    bodySummary: node.body_summary,
    calls: node.calls,
    decorators: node.decorators,
    docstring: node.docstring,
    aiDescription: node.ai_description,
    lineStart: node.line_start,
    lineEnd: node.line_end,
    impact: node.impact,
    _isMethod: isMethod,
  };
}

// ── Main App ──────────────────────────────────────────────

export default function App() {
  const [code, setCode] = useState("");
  const [impactCode, setImpactCode] = useState("");
  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState([]);
  const [flowEdges, setFlowEdges, onEdgesChange] = useEdgesState([]);
  const [language, setLanguage] = useState("auto");
  const [detectedLang, setDetectedLang] = useState("");
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [impactMode, setImpactMode] = useState(false);
  const [panelWidth, setPanelWidth] = useState(400);
  const isDragging = useRef(false);
  const lockedNodeRef = useRef(null);

  const handleMouseDown = useCallback(() => {
    isDragging.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const handleMouseMove = (e) => {
      if (!isDragging.current) return;
      const newWidth = Math.min(Math.max(250, e.clientX), window.innerWidth - 400);
      setPanelWidth(newWidth);
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, []);

  // Highlight helpers
  const applyHighlight = useCallback(
    (nodeId) => {
      const connectedEdgeIds = new Set();
      const connectedNodeIds = new Set([nodeId]);

      setFlowEdges((eds) => {
        eds.forEach((e) => {
          if (e.source === nodeId || e.target === nodeId) {
            connectedEdgeIds.add(e.id);
            connectedNodeIds.add(e.source);
            connectedNodeIds.add(e.target);
          }
        });

        return eds.map((e) => ({
          ...e,
          style: {
            ...e.style,
            stroke: connectedEdgeIds.has(e.id) ? "#FFD54F" : e._originalStroke || "#A59BFF",
            strokeWidth: connectedEdgeIds.has(e.id) ? 5 : e._originalWidth || 3,
            opacity: connectedEdgeIds.has(e.id) ? 1 : 0.1,
            filter: connectedEdgeIds.has(e.id) ? "url(#edge-glow-strong)" : "none",
          },
        }));
      });

      setFlowNodes((nds) =>
        nds.map((n) => ({
          ...n,
          data: {
            ...n.data,
            _highlighted: connectedNodeIds.has(n.id),
            _dimmed: !connectedNodeIds.has(n.id),
          },
        }))
      );
    },
    [setFlowNodes, setFlowEdges]
  );

  const clearHighlight = useCallback(() => {
    setFlowNodes((nds) =>
      nds.map((n) => ({
        ...n,
        data: { ...n.data, _highlighted: false, _dimmed: false },
      }))
    );
    setFlowEdges((eds) =>
      eds.map((e) => ({
        ...e,
        style: {
          ...e.style,
          stroke: e._originalStroke || "#A59BFF",
          strokeWidth: e._originalWidth || 3,
          opacity: 1,
          filter: "url(#edge-glow)",
        },
      }))
    );
  }, [setFlowNodes, setFlowEdges]);

  const onEdgeMouseEnter = useCallback(
    (event, edge) => {
      if (lockedNodeRef.current) return;
      const connectedNodeIds = new Set([edge.source, edge.target]);
      setFlowNodes((nds) =>
        nds.map((n) => ({
          ...n,
          data: {
            ...n.data,
            _highlighted: connectedNodeIds.has(n.id),
            _dimmed: !connectedNodeIds.has(n.id),
          },
        }))
      );
      setFlowEdges((eds) =>
        eds.map((e) => ({
          ...e,
          style: {
            ...e.style,
            stroke: e.id === edge.id ? "#FFD54F" : e._originalStroke || "#A59BFF",
            strokeWidth: e.id === edge.id ? 5 : e._originalWidth || 3,
            opacity: e.id === edge.id ? 1 : 0.1,
            filter: e.id === edge.id ? "url(#edge-glow-strong)" : "none",
          },
        }))
      );
    },
    [setFlowNodes, setFlowEdges]
  );

  const onEdgeMouseLeave = useCallback(() => {
    if (lockedNodeRef.current) return;
    clearHighlight();
  }, [clearHighlight]);

  const onNodeClick = useCallback(
    (event, node) => {
      if (node.type === "classGroup") return;
      if (lockedNodeRef.current === node.id) {
        lockedNodeRef.current = null;
        clearHighlight();
      } else {
        lockedNodeRef.current = node.id;
        applyHighlight(node.id);
      }
    },
    [applyHighlight, clearHighlight]
  );

  const onPaneClick = useCallback(() => {
    if (lockedNodeRef.current) {
      lockedNodeRef.current = null;
      clearHighlight();
    }
  }, [clearHighlight]);

  const parseCode = useCallback(async () => {
    if (!code.trim()) return;
    setLoading(true);
    setError("");
    lockedNodeRef.current = null;

    try {
      let endpoint, body;

      if (impactMode && impactCode.trim()) {
        endpoint = "/impact";
        body = { old_code: code, new_code: impactCode, language };
      } else {
        endpoint = "/parse";
        body = { code, language };
      }

      const res = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (data.error) {
        setError(data.error);
        return;
      }

      setDetectedLang(data.language || "");
      setStats(data.stats || null);

      const { rfNodes, rfEdges } = computeLayout(data.nodes, data.edges);

      setFlowNodes(rfNodes);
      setFlowEdges(rfEdges);
    } catch (err) {
      setError(`Failed to connect to backend: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [code, impactCode, language, impactMode, setFlowNodes, setFlowEdges]);

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "#0a0a0f",
        color: "#e0e0e0",
        fontFamily: "'Inter', sans-serif",
        overflow: "hidden",
      }}
    >
      <GlowFilters />

      {/* Header */}
      <div
        style={{
          padding: "16px 24px",
          background: "linear-gradient(135deg, #0a0a1a 0%, #1a0a2a 100%)",
          borderBottom: "1px solid #6C63FF33",
          display: "flex",
          alignItems: "center",
          gap: 16,
          flexShrink: 0,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: "linear-gradient(135deg, #6C63FF, #AB47BC)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
              fontWeight: 800,
              color: "#fff",
            }}
          >
            CI
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: "#fff" }}>
              Code Intelligence Visualizer
            </div>
            <div style={{ fontSize: 11, color: "#888" }}>
              IBM Bob Dev Day Hackathon
            </div>
          </div>
        </div>

        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          style={{
            marginLeft: "auto",
            background: "#1a1a2e",
            color: "#e0e0e0",
            border: "1px solid #6C63FF44",
            borderRadius: 6,
            padding: "6px 12px",
            fontSize: 12,
          }}
        >
          <option value="auto">Auto-detect</option>
          <option value="python">Python</option>
          <option value="javascript">JavaScript</option>
          <option value="typescript">TypeScript</option>
          <option value="java">Java</option>
          <option value="go">Go</option>
          <option value="rust">Rust</option>
          <option value="cpp">C++</option>
          <option value="c">C</option>
          <option value="ruby">Ruby</option>
          <option value="php">PHP</option>
        </select>

        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            cursor: "pointer",
            color: impactMode ? "#FF9800" : "#e0e0e0",
          }}
        >
          <input
            type="checkbox"
            checked={impactMode}
            onChange={(e) => setImpactMode(e.target.checked)}
          />
          Impact Mode
        </label>

        <button
          onClick={parseCode}
          disabled={loading}
          style={{
            ...btnStyle("#6C63FF"),
            fontWeight: 700,
            padding: "8px 24px",
            opacity: loading ? 0.5 : 1,
          }}
        >
          {loading
            ? "Analyzing..."
            : impactMode && impactCode.trim()
            ? "Compare Impact"
            : "Analyze Code"}
        </button>
      </div>

      {/* Stats bar */}
      {stats && (
        <div
          style={{
            padding: "8px 24px",
            background: "#111118",
            borderBottom: "1px solid #ffffff0a",
            display: "flex",
            gap: 24,
            fontSize: 12,
            flexShrink: 0,
          }}
        >
          {detectedLang && (
            <span style={{ color: "#6C63FF", fontWeight: 600 }}>
              {detectedLang.toUpperCase()}
            </span>
          )}
          <span>
            Functions: <b style={{ color: "#A59BFF" }}>{stats.functions}</b>
          </span>
          <span>
            Classes: <b style={{ color: "#81C784" }}>{stats.classes}</b>
          </span>
          <span>
            Variables: <b style={{ color: "#FFAB91" }}>{stats.variables}</b>
          </span>
          <span>
            Imports: <b style={{ color: "#80DEEA" }}>{stats.imports}</b>
          </span>
          <span>
            Connections: <b style={{ color: "#CE93D8" }}>{stats.connections}</b>
          </span>
        </div>
      )}

      {/* Error bar */}
      {error && (
        <div
          style={{
            padding: "8px 24px",
            background: "#2a0a0a",
            color: "#f44336",
            fontSize: 12,
            flexShrink: 0,
          }}
        >
          {error}
        </div>
      )}

      {/* Main content */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>
        {/* Code editor panel */}
        <div
          style={{
            width: panelWidth,
            display: "flex",
            flexDirection: "column",
            flexShrink: 0,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "8px 16px",
                fontSize: 11,
                color: "#888",
                borderBottom: "1px solid #ffffff08",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexShrink: 0,
              }}
            >
              <span>
                {impactMode ? "Original code" : "Paste your code below — any language"}
              </span>
              <button
                onClick={() => setCode("")}
                style={{
                  background: "#ffffff11",
                  border: "1px solid #ffffff22",
                  color: "#ffffff",
                  fontSize: 11,
                  cursor: "pointer",
                  padding: "4px 12px",
                  borderRadius: 4,
                }}
              >
                Clear
              </button>
            </div>
            <CodeEditor
              value={code}
              onChange={setCode}
              placeholder="Paste your code here..."
            />
          </div>

          {impactMode && (
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                borderTop: "2px solid #FF980044",
                minHeight: 0,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: "8px 16px",
                  fontSize: 11,
                  color: "#FF9800",
                  borderBottom: "1px solid #ffffff08",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: "#FF980008",
                  flexShrink: 0,
                }}
              >
                <span>Updated code (paste modified version)</span>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => setImpactCode(code)}
                    style={{
                      background: "#ffffff11",
                      border: "1px solid #ffffff22",
                      color: "#ffffff",
                      fontSize: 11,
                      cursor: "pointer",
                      padding: "4px 12px",
                      borderRadius: 4,
                    }}
                  >
                    Copy from above
                  </button>
                  <button
                    onClick={() => setImpactCode("")}
                    style={{
                      background: "#ffffff11",
                      border: "1px solid #ffffff22",
                      color: "#ffffff",
                      fontSize: 11,
                      cursor: "pointer",
                      padding: "4px 12px",
                      borderRadius: 4,
                    }}
                  >
                    Clear
                  </button>
                </div>
              </div>
              <CodeEditor
                value={impactCode}
                onChange={setImpactCode}
                placeholder="Paste the updated version of your code here to see what changed..."
                background="#0d0d10"
              />
            </div>
          )}
        </div>

        {/* Draggable divider */}
        <div
          onMouseDown={handleMouseDown}
          style={{
            width: 6,
            cursor: "col-resize",
            background: "#ffffff0a",
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "background 0.2s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#6C63FF44")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "#ffffff0a")}
        >
          <div style={{ width: 2, height: 40, borderRadius: 1, background: "#ffffff22" }} />
        </div>

        {/* Graph visualization */}
<div style={{ flex: 1, overflow: "hidden", minWidth: 0, position: "relative" }}>

  {/* Loading overlay */}
  {loading && (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "rgba(10,10,18,0.85)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10,
        gap: 16,
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          border: "4px solid #6C63FF22",
          borderTop: "4px solid #6C63FF",
          borderRadius: "50%",
          animation: "spin 1s linear infinite",
        }}
      />
      <div style={{ color: "#A59BFF", fontSize: 14, fontWeight: 600 }}>
        Analyzing code structure...
      </div>
      <div style={{ color: "#555", fontSize: 12 }}>
        Parsing functions, classes, and connections
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )}

  {flowNodes.length > 0 ? (
    <ReactFlow
      nodes={flowNodes}
      edges={flowEdges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onEdgeMouseEnter={onEdgeMouseEnter}
      onEdgeMouseLeave={onEdgeMouseLeave}
      onNodeClick={onNodeClick}
      onPaneClick={onPaneClick}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.3 }}
      minZoom={0.05}
      maxZoom={2}
      style={{ background: "#0a0a12", width: "100%", height: "100%" }}
      defaultEdgeOptions={{
        animated: true,
        style: { strokeWidth: 3 },
      }}
    >
      <Background color="#ffffff08" gap={20} />
      <Controls
        style={{
          background: "#1a1a2e",
          borderRadius: 8,
          border: "1px solid #6C63FF33",
        }}
      />
      <MiniMap
        nodeColor={(n) => {
          if (n.type === "classGroup") return COLORS.class.border;
          const type = n.data?.nodeType || "function";
          return COLORS[type]?.border || "#6C63FF";
        }}
        style={{
          background: "#0d0d14",
          border: "1px solid #ffffff0a",
          borderRadius: 8,
        }}
      />
    </ReactFlow>
  ) : (
    <div
      style={{
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: 16,
        color: "#555",
      }}
    >
      <div style={{ fontSize: 48, opacity: 0.3 }}>{"{ }"}</div>
      <div style={{ fontSize: 14 }}>
        Paste code and click <b>Analyze Code</b> to visualize
      </div>
      <div style={{ fontSize: 12, opacity: 0.6 }}>
        Supports Python, JavaScript, TypeScript, Java, Go, Rust, C/C++, Ruby, PHP
      </div>
      <div style={{ fontSize: 11, opacity: 0.4, marginTop: 8 }}>
        Click a node to lock its connections · Click empty space to unlock
      </div>
    </div>
  )}
</div>
</div>

      {/* Impact Legend */}
      {impactMode && (
        <div
          style={{
            padding: "8px 24px",
            background: "#111118",
            borderTop: "1px solid #ffffff0a",
            display: "flex",
            gap: 20,
            fontSize: 11,
            flexShrink: 0,
          }}
        >
          <span style={{ fontWeight: 600, color: "#888" }}>IMPACT:</span>
          {Object.entries(IMPACT_COLORS).map(([key, val]) => (
            <span key={key} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 3,
                  background: val.border,
                }}
              />
              {key}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function btnStyle(color) {
  return {
    background: `${color}22`,
    color: color,
    border: `1px solid ${color}44`,
    borderRadius: 6,
    padding: "6px 14px",
    fontSize: 12,
    cursor: "pointer",
    transition: "all 0.2s",
  };
}