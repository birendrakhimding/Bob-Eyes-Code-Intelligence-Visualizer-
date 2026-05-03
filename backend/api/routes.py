from fastapi import APIRouter
from models.schemas import ParseRequest, ImpactRequest
from parsers import detect_language, PythonParser, GenericParser, LANG_INDICATORS
from ai import get_granite_descriptions
from services import compute_impact

router = APIRouter()


@router.post("/parse")
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


@router.post("/impact")
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


@router.get("/health")
def health():
    return {"status": "ok", "languages": list(LANG_INDICATORS.keys())}

# Made with Bob
