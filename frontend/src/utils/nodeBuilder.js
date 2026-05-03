export function buildNodeData(node, isMethod) {
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

// Made with Bob
