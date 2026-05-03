

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import ast
import re
from typing import Optional
import os
from dotenv import load_dotenv
load_dotenv()

app = FastAPI(title="Code Intelligence Visualizer")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Models ──────────────────────────────────────────────────

class ParseRequest(BaseModel):
    code: str
    language: str = "auto"


class ImpactRequest(BaseModel):
    old_code: str
    new_code: str
    language: str = "auto"


# ── Language Detection ──────────────────────────────────────

LANG_INDICATORS = {
    "python": [
        r'\bdef\s+\w+\s*\(.*\)\s*:', r'\bfrom\s+\w+\s+import\b',
        r'if\s+__name__\s*==', r'\bself\.', r'\bprint\s*\(',
    ],
    "typescript": [
        r'\binterface\s+\w+', r':\s*(?:string|number|boolean|void)\b',
        r'\btype\s+\w+\s*=', r'\bReadonly<', r'\bPartial<',
    ],
    "javascript": [
        r'\bconst\s+\w+\s*=', r'\blet\s+\w+\s*=', r'=>',
        r'\bconsole\.log\b', r'\brequire\s*\(', r'\bexport\s+default\b',
    ],
    "java": [
        r'\bpublic\s+class\b', r'\bprivate\s+', r'\bSystem\.out\.',
        r'\bvoid\s+main\s*\(', r'@Override',
    ],
    "go": [
        r'\bfunc\s+', r'\bpackage\s+\w+', r'\bfmt\.', r':=',
    ],
    "rust": [
        r'\bfn\s+\w+', r'\blet\s+mut\b', r'\bimpl\s+',
        r'\bpub\s+fn\b', r'\bOption<', r'\bResult<',
    ],
    "cpp": [
        r'#include\s*<', r'\bstd::', r'\bcout\b',
        r'\bnamespace\s+', r'\btemplate\s*<',
    ],
    "c": [
        r'#include\s*<stdio\.h>', r'\bprintf\s*\(',
        r'\bmalloc\s*\(', r'\btypedef\s+struct\b',
    ],
    "ruby": [
        r'\bdef\s+\w+', r'\bend\b', r'\bputs\s+',
        r'\brequire\s+["\']', r'\.each\s+do\b',
    ],
    "php": [
        r'<\?php', r'\$\w+\s*=', r'\becho\s+',
        r'\bpublic\s+function\b',
    ],
}


def detect_language(code: str) -> str:
    scores = {}
    for lang, patterns in LANG_INDICATORS.items():
        scores[lang] = sum(len(re.findall(p, code, re.MULTILINE)) for p in patterns)
    if scores.get("typescript", 0) > 0 and scores.get("javascript", 0) > 0:
        if scores["typescript"] >= scores["javascript"] * 0.3:
            scores["javascript"] = 0
    if scores.get("c", 0) > 0 and scores.get("cpp", 0) > 0:
        if scores["cpp"] > scores["c"]:
            scores["c"] = 0
    best = max(scores, key=scores.get) if scores else "python"
    return best if scores.get(best, 0) > 0 else "python"


# ── Python AST Parser (full fidelity) ──────────────────────

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


# ── Generic Regex Parser (JS/TS/Java/Go/Rust/C/C++/Ruby/PHP) ──

class GenericParser:
    """
    Regex-based parser for all non-Python languages.
    Extracts functions, classes/structs/interfaces, variables,
    imports, and call relationships.
    """

    def __init__(self, source: str, language: str):
        self.source = source
        self.lines = source.split("\n")
        self.lang = language
        self.nodes = []
        self.edges = []
        self._id = 0

    def _nid(self, prefix):
        self._id += 1
        return f"{prefix}_{self._id}"

    def _find_block_end(self, start_line: int) -> int:
        """Find matching closing brace from a given line."""
        depth = 0
        in_str = False
        str_ch = None
        for i in range(start_line, len(self.lines)):
            line = self.lines[i]
            j = 0
            while j < len(line):
                ch = line[j]
                if in_str:
                    if ch == '\\':
                        j += 2
                        continue
                    if ch == str_ch:
                        in_str = False
                else:
                    if ch in ('"', "'", '`'):
                        in_str = True
                        str_ch = ch
                    elif ch == '{':
                        depth += 1
                    elif ch == '}':
                        depth -= 1
                        if depth == 0:
                            return i
                j += 1
        return min(start_line + 50, len(self.lines) - 1)

    def _extract_calls(self, body_text: str) -> list[str]:
        """Find function calls in a body of code."""
        # Skip common keywords
        skip = {
            'if', 'else', 'for', 'while', 'switch', 'case', 'return',
            'new', 'throw', 'catch', 'typeof', 'instanceof', 'sizeof',
            'print', 'println', 'printf', 'fmt', 'log', 'console',
            'var', 'let', 'const', 'def', 'fn', 'func', 'function',
            'class', 'struct', 'enum', 'interface', 'type', 'impl',
            'import', 'from', 'require', 'include', 'use', 'package',
            'pub', 'public', 'private', 'protected', 'static', 'final',
            'async', 'await', 'yield', 'match', 'where',
        }
        calls = re.findall(r'(\w+)\s*\(', body_text)
        return list(dict.fromkeys(c for c in calls if c not in skip and not c[0].isupper()))

    def _extract_body_summary(self, body_text: str) -> list[str]:
        """Extract key operations from the body text."""
        summary = []
        for line in body_text.strip().split('\n'):
            line = line.strip()
            if not line or line.startswith('//') or line.startswith('#') or line.startswith('/*'):
                continue
            # Assignments
            m = re.match(r'(?:let|const|var|int|float|double|string|bool|auto)\s+(\w+)\s*=\s*(.+)', line)
            if m:
                val = m.group(2)[:50]
                summary.append(f"{m.group(1)} = {val}")
                continue
            # Return
            m = re.match(r'return\s+(.+)', line)
            if m:
                summary.append(f"return {m.group(1)[:50]}")
                continue
            # Control flow
            if re.match(r'if\s*\(|if\s+', line):
                summary.append("if/else branch")
            elif re.match(r'for\s*\(|for\s+', line):
                summary.append("for loop")
            elif re.match(r'while\s*\(', line):
                summary.append("while loop")
            elif re.match(r'try\s*\{', line):
                summary.append("try/catch block")
            elif re.match(r'switch\s*\(', line):
                summary.append("switch statement")
            elif re.match(r'match\s+', line):
                summary.append("match expression")
        return summary[:8]

    def parse(self):
        self._parse_imports()
        self._parse_classes()
        self._parse_functions()
        self._parse_variables()
        self._resolve_edges()
        return self.nodes, self.edges

    def _parse_imports(self):
        patterns = {
            "javascript": r'^import\s+(?:(?:\{[^}]+\}|\w+)\s+from\s+)?[\'"]([^\'"]+)[\'"]',
            "typescript": r'^import\s+(?:(?:type\s+)?(?:\{[^}]+\}|\w+)\s+from\s+)?[\'"]([^\'"]+)[\'"]',
            "java":       r'^import\s+(?:static\s+)?([\w.]+);',
            "go":         r'^\s*"([\w./]+)"',
            "rust":       r'^use\s+([\w:]+)',
            "cpp":        r'^#include\s*[<"]([^>"]+)[>"]',
            "c":          r'^#include\s*[<"]([^>"]+)[>"]',
            "ruby":       r'^require\s+[\'"]([^\'"]+)[\'"]',
            "php":        r'^(?:use|require(?:_once)?|include(?:_once)?)\s+[\'"]?([^\'";\s]+)',
        }
        pat = patterns.get(self.lang)
        if not pat:
            return
        for i, line in enumerate(self.lines):
            m = re.match(pat, line.strip())
            if m:
                self.nodes.append({
                    "id": self._nid("import"), "type": "import",
                    "name": m.group(1), "params": [],
                    "return_type": None,
                    "body_summary": [line.strip()[:80]],
                    "calls": [], "decorators": [],
                    "docstring": None,
                    "line_start": i + 1, "line_end": i + 1,
                    "parent": None,
                })

    def _parse_classes(self):
        patterns = {
            "javascript":  r'^(?:export\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?\s*\{',
            "typescript":  r'^(?:export\s+)?(?:abstract\s+)?class\s+(\w+)(?:<[^>]+>)?(?:\s+extends\s+(\w+))?',
            "java":        r'^(?:public|private|protected)?\s*(?:abstract\s+)?class\s+(\w+)(?:<[^>]+>)?(?:\s+extends\s+(\w+))?',
            "go":          r'^type\s+(\w+)\s+struct\s*\{',
            "rust":        r'^(?:pub\s+)?struct\s+(\w+)(?:<[^>]+>)?\s*(?:\{|\()',
            "cpp":         r'^class\s+(\w+)(?:\s*:\s*(?:public|private|protected)\s+(\w+))?\s*\{',
            "ruby":        r'^class\s+(\w+)(?:\s*<\s*(\w+))?',
            "php":         r'^(?:abstract\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?',
        }
        pat = patterns.get(self.lang)
        if not pat:
            return
        for i, line in enumerate(self.lines):
            m = re.match(pat, line.strip())
            if m:
                name = m.group(1)
                base = m.group(2) if m.lastindex >= 2 else None
                if self.lang == "ruby":
                    end_line = self._find_ruby_end(i)
                else:
                    end_line = self._find_block_end(i)
                self.nodes.append({
                    "id": self._nid("class"), "type": "class",
                    "name": name,
                    "params": [base] if base else [],
                    "return_type": None,
                    "body_summary": [f"inherits: {base}"] if base else [],
                    "calls": [], "decorators": [],
                    "docstring": None,
                    "line_start": i + 1, "line_end": end_line + 1,
                    "parent": None,
                })

        # Also parse interfaces (TS/Java) and impl blocks (Rust)
        if self.lang == "typescript":
            for i, line in enumerate(self.lines):
                m = re.match(r'^(?:export\s+)?interface\s+(\w+)(?:<[^>]+>)?', line.strip())
                if m:
                    self.nodes.append({
                        "id": self._nid("interface"), "type": "class",
                        "name": f"interface {m.group(1)}",
                        "params": [], "return_type": None,
                        "body_summary": ["TypeScript interface"],
                        "calls": [], "decorators": [],
                        "docstring": None,
                        "line_start": i + 1,
                        "line_end": self._find_block_end(i) + 1,
                        "parent": None,
                    })
        if self.lang == "rust":
            for i, line in enumerate(self.lines):
                m = re.match(r'^impl(?:<[^>]+>)?\s+(?:(\w+)\s+for\s+)?(\w+)', line.strip())
                if m:
                    trait = m.group(1)
                    target = m.group(2)
                    label = f"impl {trait} for {target}" if trait else f"impl {target}"
                    self.nodes.append({
                        "id": self._nid("impl"), "type": "class",
                        "name": label, "params": [],
                        "return_type": None,
                        "body_summary": [label],
                        "calls": [], "decorators": [],
                        "docstring": None,
                        "line_start": i + 1,
                        "line_end": self._find_block_end(i) + 1,
                        "parent": None,
                    })

    def _parse_functions(self):
        func_patterns = {
            "javascript": [
                r'^(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)',
                r'^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(([^)]*)\)\s*=>',
                r'^\s+(?:async\s+)?(\w+)\s*\(([^)]*)\)\s*\{',
            ],
            "typescript": [
                r'^(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*(?:<[^>]+>)?\s*\(([^)]*)\)',
                r'^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*(?::[^=]+)?\s*=\s*(?:async\s+)?(?:<[^>]+>)?\s*\(([^)]*)\)\s*(?::[^=]+)?\s*=>',
                r'^\s+(?:async\s+)?(\w+)\s*\(([^)]*)\)\s*(?::\s*\w[^{]*)?\s*\{',
            ],
            "java": [
                r'^\s*(?:(?:public|private|protected|static|final|abstract|synchronized)\s+)*(?:[\w<>\[\]]+)\s+(\w+)\s*\(([^)]*)\)\s*(?:throws\s+[\w,\s]+)?\s*\{',
            ],
            "go": [
                r'^func\s+(?:\(\s*\w+\s+\*?\w+\s*\)\s+)?(\w+)\s*\(([^)]*)\)',
            ],
            "rust": [
                r'^\s*(?:pub(?:\([\w]+\))?\s+)?(?:async\s+)?fn\s+(\w+)\s*(?:<[^>]+>)?\s*\(([^)]*)\)',
            ],
            "cpp": [
                r'^\s*(?:(?:virtual|static|inline|explicit|constexpr)\s+)*(?:[\w<>:*&]+)\s+(\w+)\s*\(([^)]*)\)\s*(?:const)?\s*(?:override)?\s*\{',
                r'^\s*(\w+)\s*::\s*(\w+)\s*\(([^)]*)\)',
            ],
            "c": [
                r'^\s*(?:static\s+)?(?:[\w*]+)\s+(\w+)\s*\(([^)]*)\)\s*\{',
            ],
            "ruby": [
                r'^\s*def\s+(?:self\.)?(\w+[?!]?)\s*(?:\(([^)]*)\))?',
            ],
            "php": [
                r'^\s*(?:(?:public|private|protected|static|final|abstract)\s+)*function\s+(\w+)\s*\(([^)]*)\)',
            ],
        }
        pats = func_patterns.get(self.lang, [])
        seen_lines = set()

        for pat in pats:
            for i, line in enumerate(self.lines):
                if i in seen_lines:
                    continue
                m = re.match(pat, line.strip() if not line.startswith(' ') else line)
                if not m:
                    m = re.match(pat, line)
                if m:
                    groups = m.groups()
                    # Handle C++ Class::Method pattern
                    if len(groups) == 3:
                        name = f"{groups[0]}::{groups[1]}"
                        params_str = groups[2]
                    else:
                        name = groups[0]
                        params_str = groups[1] if len(groups) > 1 and groups[1] else ""

                    # Skip if name is a keyword
                    if name in ('if', 'for', 'while', 'switch', 'catch', 'return', 'new', 'else'):
                        continue

                    seen_lines.add(i)
                    if self.lang == "ruby":
                        end_line = self._find_ruby_end(i)
                    else:
                        end_line = self._find_block_end(i)

                    body = '\n'.join(self.lines[i:end_line + 1])
                    params = [p.strip() for p in params_str.split(',') if p.strip()] if params_str else []

                    # Detect parent class
                    parent = None
                    for cn in self.nodes:
                        if cn["type"] == "class" and cn["line_start"] <= i + 1 <= cn["line_end"]:
                            parent = cn["id"]

                    # Check for decorators (line above)
                    decorators = []
                    if i > 0:
                        prev = self.lines[i - 1].strip()
                        if prev.startswith('@'):
                            decorators.append(prev)

                    # Detect return type from signature
                    ret_type = None
                    if self.lang in ("typescript", "rust", "go"):
                        ret_match = re.search(r'\)\s*(?:->|:)\s*([\w<>\[\]|&]+)', line)
                        if ret_match:
                            ret_type = ret_match.group(1)

                    nid = self._nid("func")
                    self.nodes.append({
                        "id": nid, "type": "function",
                        "name": name, "params": params,
                        "return_type": ret_type,
                        "body_summary": self._extract_body_summary(body),
                        "calls": self._extract_calls(body),
                        "decorators": decorators,
                        "docstring": None,
                        "line_start": i + 1, "line_end": end_line + 1,
                        "parent": parent,
                    })
                    for call in self.nodes[-1]["calls"]:
                        self.edges.append({"source": nid, "target": call, "label": "calls"})

    def _parse_variables(self):
        """Top-level / module-level variables only."""
        patterns = {
            "javascript":  r'^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?!.*=>)(.+)',
            "typescript":  r'^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*(?::\s*[^=]+)?\s*=\s*(?!.*=>)(.+)',
            "go":          r'^var\s+(\w+)\s+\w+\s*=\s*(.+)',
            "rust":        r'^(?:static|const)\s+(\w+)\s*:\s*\w+\s*=\s*(.+)',
            "cpp":         r'^(?:const\s+)?(?:auto|int|float|double|string|bool|char)\s+(\w+)\s*=\s*(.+);',
            "c":           r'^(?:const\s+)?(?:int|float|double|char)\s+(\w+)\s*=\s*(.+);',
            "ruby":        r'^(\w+)\s*=\s*(.+)',
            "php":         r'^\$(\w+)\s*=\s*(.+);',
        }
        pat = patterns.get(self.lang)
        if not pat:
            return
        for i, line in enumerate(self.lines):
            # Only match truly top-level (no leading whitespace)
            if line.startswith(' ') or line.startswith('\t'):
                continue
            m = re.match(pat, line.strip())
            if m:
                # Skip if inside a function or class
                inside = False
                for n in self.nodes:
                    if n["type"] in ("function", "class") and n["line_start"] <= i + 1 <= n["line_end"]:
                        inside = True
                        break
                if inside:
                    continue
                val = m.group(2)[:80]
                self.nodes.append({
                    "id": self._nid("var"), "type": "variable",
                    "name": m.group(1), "params": [],
                    "return_type": None,
                    "body_summary": [f"= {val}"],
                    "calls": [], "decorators": [],
                    "docstring": None,
                    "line_start": i + 1, "line_end": i + 1,
                    "parent": None,
                })

    def _find_ruby_end(self, start_line: int) -> int:
        """Find matching 'end' for Ruby def/class blocks."""
        depth = 0
        for i in range(start_line, len(self.lines)):
            line = self.lines[i].strip()
            if re.match(r'^(def|class|module|do|if|unless|while|until|for|begin|case)\b', line):
                depth += 1
            if line == 'end' or line.startswith('end '):
                depth -= 1
                if depth == 0:
                    return i
        return min(start_line + 50, len(self.lines) - 1)

    def _resolve_edges(self):
        name_to_id = {}
        for n in self.nodes:
            clean = n["name"].replace("async ", "")
            name_to_id[clean] = n["id"]
            name_to_id[n["name"]] = n["id"]
        resolved = []
        for e in self.edges:
            if e["target"] in name_to_id:
                e["target"] = name_to_id[e["target"]]
                resolved.append(e)
        self.edges = resolved


# ── IBM Granite AI Descriptions (optional) ─────────────────

def get_granite_descriptions(nodes: list[dict]) -> dict:
    try:
        from ibm_watsonx_ai.foundation_models import ModelInference
        from ibm_watsonx_ai.metanames import GenTextParamsMetaNames

        api_key = os.environ.get("WATSONX_API_KEY")
        project_id = os.environ.get("WATSONX_PROJECT_ID")
        url = os.environ.get("WATSONX_URL", "https://us-south.ml.cloud.ibm.com")

        if not api_key or not project_id:
            print("Warning: WATSONX_API_KEY or WATSONX_PROJECT_ID not found in .env")
            return {}

        model = ModelInference(
            model_id="ibm/granite-8b-code-instruct",
            credentials={"apikey": api_key, "url": url},
            project_id=project_id,
            params={
                GenTextParamsMetaNames.MAX_NEW_TOKENS: 60,
                GenTextParamsMetaNames.TEMPERATURE: 0.1,
            },
        )

        descriptions = {}
        for node in nodes:
            if node["type"] != "function":
                continue
            prompt = (
                f"Describe this function in exactly one short sentence (max 15 words).\n"
                f"Function: {node['name']}({', '.join(node['params'])})\n"
                f"Body: {'; '.join(node['body_summary'][:3])}\n"
                f"Description:"
            )
            result = model.generate_text(prompt)
            print(f"AI: {node['name']} -> {result.strip()}")
            descriptions[node["id"]] = result.strip()
        return descriptions

    except Exception as e:
        print(f"Granite AI skipped: {e}")
        return {}


# ── Impact Analysis ────────────────────────────────────────

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


# ── API Endpoints ──────────────────────────────────────────

@app.post("/parse")
def parse_code(req: ParseRequest):
    lang = req.language if req.language != "auto" else detect_language(req.code)

    try:
        if lang == "python":
            parser = PythonParser(req.code)
        else:
            parser = GenericParser(req.code, lang)
        nodes, edges = parser.parse()
    except Exception as e:
        return {"error": str(e), "nodes": [], "edges": [], "language": lang}

    # Optional: enrich with Granite descriptions
    descriptions = get_granite_descriptions(nodes)
    for n in nodes:
        if n["id"] in descriptions:
            n["ai_description"] = descriptions[n["id"]]

    # Stats
    stats = {
        "functions": sum(1 for n in nodes if n["type"] == "function"),
        "classes": sum(1 for n in nodes if n["type"] == "class"),
        "variables": sum(1 for n in nodes if n["type"] == "variable"),
        "imports": sum(1 for n in nodes if n["type"] == "import"),
        "connections": len(edges),
    }

    return {"nodes": nodes, "edges": edges, "language": lang, "stats": stats}


@app.post("/impact")
def analyze_impact(req: ImpactRequest):
    lang = req.language if req.language != "auto" else detect_language(req.new_code)

    try:
        if lang == "python":
            old_p = PythonParser(req.old_code)
            new_p = PythonParser(req.new_code)
        else:
            old_p = GenericParser(req.old_code, lang)
            new_p = GenericParser(req.new_code, lang)
        old_nodes, old_edges = old_p.parse()
        new_nodes, new_edges = new_p.parse()
    except Exception as e:
        return {"error": str(e)}

    result_nodes, result_edges = compute_impact(old_nodes, old_edges, new_nodes, new_edges)

    return {
        "nodes": result_nodes,
        "edges": result_edges,
        "language": lang,
    }


@app.get("/health")
def health():
    return {"status": "ok", "languages": list(LANG_INDICATORS.keys())}