import React, { useState, useCallback, useRef } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
} from "reactflow";
import "reactflow/dist/style.css";

import { API_URL, COLORS, IMPACT_COLORS } from "./config/constants";
import CodeEditor from "./components/CodeEditor";
import FunctionNode from "./components/nodes/FunctionNode";
import ClassGroupNode from "./components/nodes/ClassGroupNode";
import GlowFilters from "./components/GlowFilters";
import { computeLayout } from "./utils/layoutEngine";
import { useHighlight } from "./hooks/useHighlight";

const nodeTypes = {
  codeNode: FunctionNode,
  classGroup: ClassGroupNode,
};

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

  const { lockedNodeRef, onEdgeMouseEnter, onEdgeMouseLeave, onNodeClick, onPaneClick } = 
    useHighlight(setFlowNodes, setFlowEdges);

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
  }, [code, impactCode, language, impactMode, setFlowNodes, setFlowEdges, lockedNodeRef]);

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

// Made with Bob
