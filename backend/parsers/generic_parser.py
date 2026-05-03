import re


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

# Made with Bob
