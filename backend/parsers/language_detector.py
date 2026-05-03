import re


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

# Made with Bob
