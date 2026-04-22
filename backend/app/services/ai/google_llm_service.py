"""Google LLM provider used by the standard MePO chat runtime."""
from __future__ import annotations

import json
import logging
import re

from app.core.config import settings

logger = logging.getLogger(__name__)

_USE_CASE_LABELS = {
    "analyse": "Analyse",
    "bogue": "Bogue / Bug",
    "recette": "Recette / Test",
    "question_generale": "Question generale",
    "redaction_besoin": "Redaction besoin / evolution / solution",
    "structuration_sujet": "Structuration sujet / topic / docs / tickets",
}

# Use cases that require documentary evidence — weak answers must be flagged.
EVIDENCE_REQUIRED_USE_CASES = {
    "analyse",
    "bogue",
    "recette",
    "redaction_besoin",
    "structuration_sujet",
}

_SYSTEM_BASE = """Tu es un assistant IA integre a MePO, specialise dans l'analyse produit et fonctionnelle.
Tu aides les equipes produit sur 6 cas metier precis.

REGLES ABSOLUES :
- Reponds TOUJOURS en JSON valide avec la structure ci-dessous.
- N'invente jamais d'informations non presentes dans le contexte fourni.
- Si le contexte documentaire est insuffisant, indique-le EXPLICITEMENT dans answer_markdown ET dans evidence_level.
- Reste concis et oriente action.

REGLES DE TRAÇABILITE DOCUMENTAIRE (NON NEGOCIABLES) :
- Le CONTEXTE PROJET contient des blocs [DOCUMENT doc_id=<id>]...[/DOCUMENT doc_id=<id>].

PROTOCOLE DE LECTURE OBLIGATOIRE — applique avant de rediger quoi que ce soit :
  1. Lis chaque bloc [DOCUMENT] du corpus, du premier au dernier, sans en ignorer aucun.
  2. Pour chaque bloc : note mentalement si son contenu touche de pres ou de loin la demande.
  3. Classe chaque document dans l'une des 3 categories :
       A) Directement pertinent  → tu DOIS l'exploiter et le citer
       B) Partiellement pertinent → tu DOIS l'exploiter pour les points qu'il couvre
       C) Non pertinent           → tu peux l'ignorer, mais justifie-toi si > 3 doc ignores
  4. Commence a rediger ta reponse SEULEMENT apres avoir parcouru tout le corpus.

- Pour CHAQUE document exploite : ajoute une entree dans sources_used avec :
    * "doc_id" : valeur EXACTE lue apres "doc_id=" dans la balise ouvrante
    * "title"  : valeur exacte du champ "Titre:" du bloc
    * "role"   : regle_metier | preuve_technique | validation | contradiction | reference
- Dans answer_markdown, cite chaque source sous la forme [source: Titre exact du document].
- EXEMPLE :
    {"doc_id": "a1b2c3d4", "title": "Livret Codes et Synchro", "role": "regle_metier"}
- Si aucun [DOCUMENT] n'est pertinent : laisse sources_used vide, evidence_level="none", document_backed=false.
- document_backed=true UNIQUEMENT si sources_used contient au moins 1 entree valide.
- STANDARD QUALITE : une analyse avec 5 sources est meilleure qu'une avec 2. Exploite le corpus au maximum.

FORMAT DE REPONSE OBLIGATOIRE (JSON uniquement, sans texte avant ou apres) :
{
  "answer_markdown": "reponse complete en markdown structuree selon le cas metier, avec [source: titre] pour chaque document cite",
  "mode": "analyse|bogue|recette|question_generale|redaction_besoin|structuration_sujet",
  "understanding": "phrase resumant ce que tu as compris de la demande",
  "proposed_actions": [],
  "related_objects": [],
  "next_actions": [],
  "sources_used": [
    {
      "doc_id": "valeur exacte du doc_id lu dans la balise [DOCUMENT doc_id=...]",
      "title": "titre exact du document",
      "role": "regle_metier|preuve_technique|validation|contradiction|reference"
    }
  ],
  "evidence_level": "strong|moderate|weak|none",
  "document_backed": true
}

evidence_level :
- "strong"   : 3+ documents exploites avec preuves directes
- "moderate" : 1-2 documents exploites, preuves indirectes ou partielles
- "weak"     : documents trouves mais peu pertinents
- "none"     : aucun document pertinent, corpus vide, ou 0 source citee

proposed_actions : actions concretes dans MePO.
Format : {"action_id": "uuid-v4", "type": "create_ticket|create_document|add_comment", "label": "libelle court", "payload": {}}

related_objects : objets MePO directement lies.
Format : {"kind": "ticket|topic|document", "id": "id-objet", "label": "libelle"}

next_actions : liste de strings — suggestions de prochaines etapes immediates.
"""

_USE_CASE_INSTRUCTIONS: dict[str, str] = {
    "analyse": """
STRUCTURE OBLIGATOIRE DE answer_markdown POUR CE CAS (analyse) :

## Comprehension
[1-2 phrases resumant la demande analysee]

## Analyse
[Corps principal de l'analyse, organise par theme ou par point de l'analyse demandee.]

Pour CHAQUE affirmation ou point analyse :
- Indique le niveau de certitude sur la meme ligne :
    **Certain** : prouve par au moins 1 [source: doc] du corpus
    **Deduit**  : logiquement infere depuis le corpus, non explicitement ecrit
    **A confirmer** : hypothese ou information absente du corpus a verifier
- Cite la source immediatement apres : [source: Titre exact du document]
- Si le point contredit un document : indique-le explicitement avec [source: ...]

Exemple de format attendu :
> Le statut ACTIF peut etre surcharge localement par le sous-groupement. **Certain** [source: Livret Codes et Synchro]
> La desaffectation se fait uniquement via IHM. **Deduit** [source: SP_Livret_Parametrage_pharmacie]
> La balise XML de desaffectation n'existe pas. **A confirmer** — absent du corpus.

## Points non documentes
[Lister les aspects qui ne sont PAS couverts par le corpus.
Pour chaque point : expliquer pourquoi il manque et quelle action permettrait de le confirmer.]

## Verdict PO
[Conclusion synthétique : l'analyse/spec soumise est-elle correcte ? Quels points sont solides, lesquels sont a risque ?
Format : "Valide", "Partiellement valide", ou "A retravailler" avec justification courte.]

## Recommandations
[Liste d'actions concretes. Chaque action importante = 1 entree dans proposed_actions.]

OBLIGATIONS SPECIFIQUES :
- CHAQUE point de l'analyse DOIT avoir un label Certain / Deduit / A confirmer
- sources_used DOIT contenir chaque [DOCUMENT] reellement exploite (meme usage partiel)
- Si aucun [DOCUMENT] disponible : ajouter en bas : "> ⚠ Analyse produite sans preuve documentaire suffisante."
- next_actions doit contenir au moins 1 suggestion
""",
    "bogue": """
STRUCTURE OBLIGATOIRE DE answer_markdown POUR CE CAS (bogue) :

## Symptome identifie
[Description precise du comportement anormal]

## Cause probable
[Explication causale. Citer [source: doc] si un document le prouve. Sinon : "Hypothese non documentee."]

## Actions correctives
[Etapes de resolution — chaque etape importante = 1 entree dans proposed_actions]

## Verification
[Comment valider que le bug est corrige — critere de done]

OBLIGATIONS SPECIFIQUES :
- proposed_actions DOIT avoir au moins 1 action de type create_ticket ou add_comment
- sources_used DOIT citer tout document [DOCUMENT] qui explique le comportement attendu
- Si aucun doc disponible : ajouter "> ⚠ Analyse produite sans preuve documentaire suffisante."
""",
    "recette": """
STRUCTURE OBLIGATOIRE DE answer_markdown POUR CE CAS (recette) :

## Perimetre de recette
[Fonctionnalites ou scenarios concernes par la recette]

## Cas de test
[Liste des scenarios a tester. Chaque scenario important = 1 entree dans proposed_actions]

## Criteres d'acceptation
[Conditions pour valider chaque cas — citer [source: doc] si derive d'une spec documentee]

## Donnees de test
[Donnees ou preconditions necessaires]

## Resultats attendus
[Ce qui doit etre observe pour valider]

OBLIGATIONS SPECIFIQUES :
- proposed_actions DOIT lister les cas de test comme tickets ou actions
- sources_used DOIT citer les specs ou regles metier utilisees pour construire la recette
- Si aucune spec disponible : ajouter "> ⚠ Recette produite sans specification documentee."
""",
    "question_generale": """
STRUCTURE POUR CE CAS (question_generale) :

Reponds directement et de facon concise. Pas de structure imposee.
Si des documents [DOCUMENT] sont pertinents, cite-les. Sinon, reponds a partir de ta connaissance generale.
sources_used peut etre vide si aucun document n'est pertinent.
""",
    "redaction_besoin": """
STRUCTURE OBLIGATOIRE DE answer_markdown POUR CE CAS (redaction_besoin) :

## Contexte fonctionnel
[Contexte du besoin — citer [source: doc] si derive d'un document existant.
Chaque affirmation contextuelles : label Certain / Deduit / A confirmer]

## Besoin exprime
[Expression formelle du besoin, de l'evolution ou de la solution.
Si une regle metier issue du corpus est utilisee : citer [source: doc] + label Certain.]

## Criteres d'acceptation
[Conditions de validation — aussi precis que possible.
Label : Certain si prouve par le corpus, Deduit si infere, A confirmer sinon.]

## Points d'attention
[Risques, contraintes, dependances. Indiquer si documente ou hypothese.]

## Prochaines etapes
[Aligner avec next_actions]

OBLIGATIONS SPECIFIQUES :
- sources_used DOIT citer tout document [DOCUMENT] utilise pour cadrer le besoin
- Chaque critere d'acceptation DOIT avoir un label Certain / Deduit / A confirmer
- proposed_actions DOIT suggerer la creation d'un ticket ou document si pertinent
- Si aucun doc disponible : ajouter "> ⚠ Besoin redige sans preuve documentaire suffisante."
""",
    "structuration_sujet": """
STRUCTURE OBLIGATOIRE DE answer_markdown POUR CE CAS (structuration_sujet) :

## Structure proposee
[Organisation suggeree : sections, topics, sous-sujets]

## Elements a documenter
[Ce qui doit etre redige, clarifie ou formalise — citer [source: doc] si un existant sert de base]

## Decoupage en tickets
[Si applicable : decoupage propose en tickets — chaque ticket = 1 entree dans proposed_actions]

## Prochaines etapes
[Aligner avec next_actions — actions immediates pour structurer]

OBLIGATIONS SPECIFIQUES :
- proposed_actions DOIT contenir au moins 1 action si la structuration implique des tickets ou documents
- next_actions DOIT contenir au moins 1 suggestion immediate
""",
}


def _get_use_case_instructions(use_case: str) -> str:
    return _USE_CASE_INSTRUCTIONS.get(use_case, "")


def _extract_string_field(text: str, key: str) -> str | None:
    """Scan a JSON-like string for a key's string value, handling literal newlines/unescaped chars."""
    search_key = f'"{key}"'
    idx = text.find(search_key)
    if idx == -1:
        return None
    i = idx + len(search_key)
    while i < len(text) and text[i] in ' \t\r\n':
        i += 1
    if i >= len(text) or text[i] != ':':
        return None
    i += 1
    while i < len(text) and text[i] in ' \t\r\n':
        i += 1
    if i >= len(text) or text[i] != '"':
        return None
    i += 1
    chars: list[str] = []
    escape_map = {'"': '"', '\\': '\\', '/': '/', 'n': '\n', 'r': '\r', 't': '\t', 'b': '\b', 'f': '\f'}
    while i < len(text):
        c = text[i]
        if c == '\\' and i + 1 < len(text):
            nc = text[i + 1]
            if nc in escape_map:
                chars.append(escape_map[nc])
                i += 2
                continue
            if nc == 'u' and i + 5 < len(text):
                try:
                    chars.append(chr(int(text[i + 2:i + 6], 16)))
                    i += 6
                    continue
                except ValueError:
                    pass
        elif c == '"':
            break
        chars.append(c)
        i += 1
    return ''.join(chars) if chars else None


def _build_system_prompt(
    skill_context: str | None,
    use_case: str,
    corpus_context: str | None = None,
) -> str:
    use_case_label = _USE_CASE_LABELS.get(use_case, use_case)
    parts = [_SYSTEM_BASE]

    has_skill = bool(skill_context and skill_context.strip())

    if has_skill:
        # Skill defines the format — inject it first as primary authority
        parts.append(
            f"\n\n=== SKILL ACTIF (instructions comportement et format) ===\n"
            f"ATTENTION : Cette section contient TES INSTRUCTIONS DE COMPORTEMENT, pas un document du corpus.\n"
            f"INTERDIT : citer le skill dans sources_used. INTERDIT : ecrire [source: Shadow PO] ou [source: Skill] ou tout nom de skill dans answer_markdown.\n"
            f"Seuls les blocs [DOCUMENT] du corpus peuvent apparaitre dans sources_used et dans les citations [source: ...].\n"
            f"{skill_context.strip()}\n"
            f"=== FIN SKILL ACTIF ==="
        )
    else:
        # No skill — use built-in per-use-case format instructions
        use_case_instructions = _get_use_case_instructions(use_case)
        if use_case_instructions:
            parts.append(use_case_instructions)

    if corpus_context and corpus_context.strip():
        parts.append(
            f"\n\n=== CORPUS DOCUMENTAIRE (documents du projet a exploiter) ===\n"
            f"{corpus_context.strip()}\n"
            f"=== FIN CORPUS DOCUMENTAIRE ==="
        )

    parts.append(f"\n\nCAS METIER EN COURS : {use_case_label}")
    return "\n".join(parts)


def _build_user_prompt(
    message: str,
    conversation_history: list[dict],
    context_summary: str | None,
) -> str:
    parts: list[str] = []

    if context_summary and context_summary.strip():
        parts.append(f"[Resume conversation precedente]\n{context_summary.strip()}\n")

    if conversation_history:
        parts.append("[Historique recent]")
        for turn in conversation_history[-6:]:
            role_label = "Utilisateur" if turn.get("role") == "user" else "Assistant"
            content = str(turn.get("content") or "").strip()
            if content:
                parts.append(f"{role_label} : {content}")
        parts.append("")

    parts.append(f"[Demande]\n{message.strip()}")
    return "\n".join(parts)


def _fallback_response(message: str, use_case: str) -> dict:
    preview = message.strip()
    if len(preview) > 600:
        preview = preview[:600].rstrip() + "..."
    return {
        "answer_markdown": (
            "Reponse Google indisponible. Voici une synthese locale de la demande.\n\n"
            f"- Use case: `{use_case}`\n"
            f"- Demande: {preview}\n"
            "- Action: configurez `GOOGLE_API_KEY` pour activer Gemini."
        ),
        "mode": use_case,
        "understanding": preview[:240],
        "proposed_actions": [],
        "related_objects": [],
        "next_actions": ["Verifier la configuration Google si une reponse IA complete est attendue."],
        "sources_used": [],
        "evidence_level": "none",
        "document_backed": False,
    }


def call_google_llm(
    *,
    message: str,
    use_case: str,
    skill_context: str | None = None,
    corpus_context: str | None = None,
    conversation_history: list[dict] | None = None,
    context_summary: str | None = None,
) -> dict:
    """Call Gemini and always return a structured dict."""
    if not settings.google_api_key:
        return _fallback_response(message, use_case)

    try:
        import google.generativeai as genai
    except Exception:
        return _fallback_response(message, use_case)

    genai.configure(api_key=settings.google_api_key)

    system_prompt = _build_system_prompt(skill_context, use_case, corpus_context=corpus_context)
    user_prompt = _build_user_prompt(
        message=message,
        conversation_history=conversation_history or [],
        context_summary=context_summary,
    )

    model = genai.GenerativeModel(
        model_name=settings.ai_google_default_model,
        system_instruction=system_prompt,
        generation_config=genai.types.GenerationConfig(
            response_mime_type="application/json",
            temperature=0.2,
        ),
    )

    logger.info(
        "Google LLM call - model=%s use_case=%s history_turns=%d has_corpus=%s",
        settings.ai_google_default_model,
        use_case,
        len(conversation_history or []),
        bool(skill_context),
    )

    try:
        response = model.generate_content(user_prompt)
    except Exception:
        return _fallback_response(message, use_case)

    try:
        result = json.loads(response.text)
    except (json.JSONDecodeError, ValueError) as exc:
        logger.warning("Google LLM JSON parse error: %s - raw: %.200s", exc, response.text)
        result = {
            "answer_markdown": response.text or "Reponse non structuree.",
            "mode": use_case,
            "understanding": "",
            "proposed_actions": [],
            "related_objects": [],
            "next_actions": [],
            "sources_used": [],
            "evidence_level": "none",
            "document_backed": False,
        }

    # Gemini sometimes wraps the entire expected JSON inside answer_markdown.
    # When json.loads decoded the outer JSON, \\n sequences became literal \n chars,
    # making inner json.loads unparseable → scan for the string value directly.
    for depth in range(5):
        answer_md = result.get("answer_markdown", "")
        if not (isinstance(answer_md, str) and answer_md.strip().startswith("{")):
            break
        try:
            inner = json.loads(answer_md)
        except (json.JSONDecodeError, ValueError):
            extracted = _extract_string_field(answer_md, "answer_markdown")
            if extracted is not None:
                logger.warning("Google LLM scanner-extracted answer_markdown (depth=%d)", depth + 1)
                result["answer_markdown"] = extracted
            break
        if not (isinstance(inner, dict) and "answer_markdown" in inner):
            break
        logger.warning("Google LLM nested JSON in answer_markdown (depth=%d) — unwrapping.", depth + 1)
        result = inner

    result.setdefault("mode", use_case)
    result.setdefault("understanding", "")
    result.setdefault("proposed_actions", [])
    result.setdefault("related_objects", [])
    result.setdefault("next_actions", [])
    result.setdefault("sources_used", [])
    result.setdefault("evidence_level", "none")
    result.setdefault("document_backed", False)

    return result
