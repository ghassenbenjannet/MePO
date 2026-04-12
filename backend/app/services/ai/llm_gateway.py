"""LLM Gateway — calls OpenAI Chat Completions API with structured JSON output.

Falls back to a stub response when no API key is configured, so the app
remains functional in dev without credentials.
"""
import json
import logging

from app.core.config import settings

logger = logging.getLogger(__name__)

# ─── System prompt ─────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """Tu es Shadow PO, un assistant IA expert en gestion de produit, analyse fonctionnelle et pilotage de projets agiles.

Tu dois répondre UNIQUEMENT en JSON valide avec ce schéma exact :
{
  "mode": "<cadrage|impact|pilotage|analyse_fonctionnelle|analyse_technique|redaction|transformation|memoire>",
  "message": "<ta réponse principale en français, markdown autorisé>",
  "evidence": [
    {"label": "<observation factuelle>", "confidence": "<certain|inferred|to_confirm>"}
  ],
  "suggestions": [
    {"type": "<create_ticket|create_document|update_memory|save_artifact>", "label": "<libellé court>", "requires_confirmation": true}
  ]
}

Règles impératives :
- Détecte le mode selon la nature de la demande
- Sois précis, structuré, orienté action PO
- Maximum 4 évidences, maximum 3 suggestions
- Les suggestions doivent être actionnables dans Shadow PO
- Réponds TOUJOURS avec du JSON valide, rien d'autre"""


# ─── Stub fallback ──────────────────────────────────────────────────────────────

def _stub_response(user_message: str) -> dict:
    """Used when no OpenAI API key is configured."""
    return {
        "mode": "pilotage",
        "message": (
            f"**[Mode démo — aucune clé API configurée]**\n\n"
            f"Ta demande : *{user_message}*\n\n"
            "Pour activer Shadow Core, ajoute `OPENAI_API_KEY=sk-...` dans l'environnement du backend."
        ),
        "evidence": [
            {"label": "Aucune clé API OpenAI détectée", "confidence": "certain"},
            {"label": "Le mode démo retourne une réponse statique", "confidence": "certain"},
        ],
        "suggestions": [
            {"type": "update_memory", "label": "Configurer la clé API", "requires_confirmation": True},
        ],
    }


# ─── Real OpenAI call ──────────────────────────────────────────────────────────

def call_shadow_core(user_message: str, context_summary: str = "") -> dict:
    api_key = settings.openai_api_key

    if not api_key:
        logger.warning("OPENAI_API_KEY not set — returning stub response")
        return _stub_response(user_message)

    try:
        from openai import OpenAI  # lazy import — optional dependency

        client = OpenAI(api_key=api_key)

        messages: list[dict] = [{"role": "system", "content": SYSTEM_PROMPT}]

        if context_summary:
            messages.append({
                "role": "system",
                "content": f"Contexte de l'espace actuel :\n{context_summary}",
            })

        messages.append({"role": "user", "content": user_message})

        response = client.chat.completions.create(
            model=settings.openai_model,
            messages=messages,
            response_format={"type": "json_object"},
            temperature=0.3,
            max_tokens=1024,
        )

        raw = response.choices[0].message.content or "{}"
        result = json.loads(raw)

        # Ensure required keys exist
        result.setdefault("mode", "pilotage")
        result.setdefault("message", "")
        result.setdefault("evidence", [])
        result.setdefault("suggestions", [])
        return result

    except ImportError:
        logger.error("openai package not installed — add it to pyproject.toml")
        return _stub_response(user_message)

    except Exception as exc:
        logger.exception("OpenAI API error: %s", exc)
        return {
            "mode": "pilotage",
            "message": f"⚠️ Erreur OpenAI : {exc}",
            "evidence": [{"label": str(exc), "confidence": "certain"}],
            "suggestions": [],
        }
