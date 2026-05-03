import { MarkerType } from "reactflow";
import { buildNodeData } from "./nodeBuilder";

export function computeLayout(apiNodes, apiEdges) {
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

// Made with Bob
