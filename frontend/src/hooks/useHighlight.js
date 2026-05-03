import { useCallback, useRef } from "react";

export function useHighlight(setFlowNodes, setFlowEdges) {
  const lockedNodeRef = useRef(null);

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

  return {
    lockedNodeRef,
    onEdgeMouseEnter,
    onEdgeMouseLeave,
    onNodeClick,
    onPaneClick,
  };
}

// Made with Bob
