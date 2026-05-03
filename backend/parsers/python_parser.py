import ast


class PythonParser(ast.NodeVisitor):
    def __init__(self, source: str):
        self.source = source
        self.nodes = []
        self.edges = []
        self.scope_stack = []
        self._id = 0

    def _nid(self, prefix):
        self._id += 1
        return f"{prefix}_{self._id}"

    def _docstring(self, node):
        if (node.body and isinstance(node.body[0], ast.Expr)
                and isinstance(node.body[0].value, ast.Constant)):
            v = node.body[0].value.value
            return v.strip()[:150] if isinstance(v, str) else None
        return None

    def _calls(self, node):
        calls = []
        for child in ast.walk(node):
            if isinstance(child, ast.Call):
                if isinstance(child.func, ast.Name):
                    calls.append(child.func.id)
                elif isinstance(child.func, ast.Attribute):
                    calls.append(child.func.attr)
        return list(dict.fromkeys(calls))

    def _decorators(self, node):
        decs = []
        for d in getattr(node, "decorator_list", []):
            if isinstance(d, ast.Name):
                decs.append(f"@{d.id}")
            elif isinstance(d, ast.Call) and isinstance(d.func, ast.Name):
                decs.append(f"@{d.func.id}(...)")
            elif hasattr(ast, "unparse"):
                decs.append(f"@{ast.unparse(d)}")
        return decs

    def _body_summary(self, body):
        summary = []
        for node in body:
            if isinstance(node, ast.Assign):
                for t in node.targets:
                    name = t.id if isinstance(t, ast.Name) else "..."
                    val = ast.unparse(node.value) if hasattr(ast, "unparse") else "..."
                    if len(val) > 60: val = val[:57] + "..."
                    summary.append(f"{name} = {val}")
            elif isinstance(node, ast.Return):
                ret = ast.unparse(node.value) if node.value and hasattr(ast, "unparse") else "..."
                if len(ret) > 50: ret = ret[:47] + "..."
                summary.append(f"return {ret}")
            elif isinstance(node, ast.If):
                summary.append("if/else branch")
            elif isinstance(node, ast.For):
                summary.append("for loop")
            elif isinstance(node, ast.While):
                summary.append("while loop")
            elif isinstance(node, ast.With):
                summary.append("with context manager")
            elif isinstance(node, ast.Try):
                summary.append("try/except block")
            elif isinstance(node, ast.Raise):
                summary.append("raise exception")
        return summary[:8]

    def _handle_func(self, node, is_async=False):
        params = []
        for arg in node.args.args:
            p = arg.arg
            if arg.annotation and hasattr(ast, "unparse"):
                p += f": {ast.unparse(arg.annotation)}"
            params.append(p)
        if node.args.vararg:
            params.append(f"*{node.args.vararg.arg}")
        if node.args.kwarg:
            params.append(f"**{node.args.kwarg.arg}")

        ret_type = ast.unparse(node.returns) if node.returns and hasattr(ast, "unparse") else None
        parent = self.scope_stack[-1] if self.scope_stack else None
        nid = self._nid("func")
        prefix = "async " if is_async else ""

        self.nodes.append({
            "id": nid,
            "type": "function",
            "name": f"{prefix}{node.name}",
            "params": params,
            "return_type": ret_type,
            "body_summary": self._body_summary(node.body),
            "calls": self._calls(node),
            "decorators": self._decorators(node),
            "docstring": self._docstring(node),
            "line_start": node.lineno,
            "line_end": getattr(node, "end_lineno", node.lineno),
            "parent": parent,
        })

        for call in self.nodes[-1]["calls"]:
            self.edges.append({"source": nid, "target": call, "label": "calls"})

        self.scope_stack.append(nid)
        self.generic_visit(node)
        self.scope_stack.pop()

    def visit_FunctionDef(self, node):
        self._handle_func(node)

    def visit_AsyncFunctionDef(self, node):
        self._handle_func(node, is_async=True)

    def visit_ClassDef(self, node):
        bases = []
        for b in node.bases:
            bases.append(b.id if isinstance(b, ast.Name) else
                         ast.unparse(b) if hasattr(ast, "unparse") else "...")
        nid = self._nid("class")
        self.nodes.append({
            "id": nid,
            "type": "class",
            "name": node.name,
            "params": bases,
            "return_type": None,
            "body_summary": [f"inherits: {', '.join(bases)}"] if bases else [],
            "calls": [],
            "decorators": self._decorators(node),
            "docstring": self._docstring(node),
            "line_start": node.lineno,
            "line_end": getattr(node, "end_lineno", node.lineno),
            "parent": self.scope_stack[-1] if self.scope_stack else None,
        })
        self.scope_stack.append(nid)
        self.generic_visit(node)
        self.scope_stack.pop()

    def visit_Import(self, node):
        for alias in node.names:
            self.nodes.append({
                "id": self._nid("import"), "type": "import",
                "name": alias.asname or alias.name, "params": [],
                "return_type": None,
                "body_summary": [f"import {alias.name}"],
                "calls": [], "decorators": [],
                "docstring": None,
                "line_start": node.lineno, "line_end": node.lineno,
                "parent": None,
            })

    def visit_ImportFrom(self, node):
        module = node.module or ""
        names = [a.asname or a.name for a in node.names]
        self.nodes.append({
            "id": self._nid("import"), "type": "import",
            "name": f"from {module}", "params": names,
            "return_type": None,
            "body_summary": [f"from {module} import {', '.join(names)}"],
            "calls": [], "decorators": [],
            "docstring": None,
            "line_start": node.lineno, "line_end": node.lineno,
            "parent": None,
        })

    def visit_Assign(self, node):
        if self.scope_stack:
            return
        for target in node.targets:
            if isinstance(target, ast.Name):
                val = ast.unparse(node.value) if hasattr(ast, "unparse") else "..."
                if len(val) > 80: val = val[:77] + "..."
                self.nodes.append({
                    "id": self._nid("var"), "type": "variable",
                    "name": target.id, "params": [],
                    "return_type": None,
                    "body_summary": [f"= {val}"],
                    "calls": self._calls(node), "decorators": [],
                    "docstring": None,
                    "line_start": node.lineno, "line_end": node.lineno,
                    "parent": None,
                })

    def parse(self):
        tree = ast.parse(self.source)
        self.visit(tree)
        # resolve edge targets from names to node IDs
        name_to_id = {}
        for n in self.nodes:
            name_to_id[n["name"]] = n["id"]
            name_to_id[n["name"].replace("async ", "")] = n["id"]
        resolved = []
        for e in self.edges:
            if e["target"] in name_to_id:
                e["target"] = name_to_id[e["target"]]
                resolved.append(e)
        self.edges = resolved
        return self.nodes, self.edges

# Made with Bob
