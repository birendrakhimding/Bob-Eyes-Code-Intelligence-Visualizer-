def compute_impact(old_nodes, old_edges, new_nodes, new_edges):
    """
    Compare old and new parse results. Return each node tagged
    with a status: 'unchanged', 'added', 'modified', 'removed'.
    """
    old_map = {n["name"]: n for n in old_nodes}
    new_map = {n["name"]: n for n in new_nodes}

    result_nodes = []

    # Check new/modified
    for name, node in new_map.items():
        if name not in old_map:
            node["impact"] = "added"
        else:
            old = old_map[name]
            if (old["body_summary"] != node["body_summary"] or
                    old["params"] != node["params"] or
                    old["calls"] != node["calls"]):
                node["impact"] = "modified"
            else:
                node["impact"] = "unchanged"
        result_nodes.append(node)

    # Check removed
    for name, node in old_map.items():
        if name not in new_map:
            node["impact"] = "removed"
            result_nodes.append(node)

    # Mark downstream impact: if A calls B and B is modified, A is "affected"
    modified_names = {n["name"] for n in result_nodes if n.get("impact") in ("modified", "added")}
    for node in result_nodes:
        if node.get("impact") == "unchanged":
            for call in node.get("calls", []):
                if call in modified_names:
                    node["impact"] = "affected"
                    break

    return result_nodes, new_edges

# Made with Bob
