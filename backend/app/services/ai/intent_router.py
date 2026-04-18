"""Intent Router — detects the Shadow PO work mode from the user message.

Modes (8):
  cadrage               → comprendre un mail, remarque, retour recette, demande floue
  impact                → identifier tickets/topics/docs concernés, dépendances, scope
  pilotage              → backlog, priorités, blocages, plan d'action, quoi faire aujourd'hui
  analyse_fonctionnelle → besoin métier, règle fonctionnelle, périmètre, analyse de valeur
  analyse_technique     → BDD, SQL, API, DAL, LINQ, stacktrace, code, investigation
  redaction             → rédiger fiche bug, évolution, plan de recette, commentaire, note, doc
  transformation        → convertir : technique→fonctionnel, analyse→ticket, mail→commentaire
  memoire               → faits, décisions, risques, dépendances, questions ouvertes du topic
"""
from __future__ import annotations

import re
import unicodedata

from app.schemas.ai import IntentResult


def _normalize(text: str) -> str:
    """Lowercase + strip accents for robust matching."""
    nfkd = unicodedata.normalize("NFKD", text.lower())
    return "".join(c for c in nfkd if not unicodedata.combining(c))

# ─── Keyword tables ───────────────────────────────────────────────────────────

_MODE_KEYWORDS: dict[str, list[str]] = {
    "cadrage": [
        "mail", "email", "retour", "remarque", "recette", "feedback",
        "comprend", "comprendre", "explique", "expliquer", "clarif",
        "vague", "flou", "floue", "demande", "besoin", "résumé", "résume",
        "que veut", "qu'est-ce que", "que signifie", "interpréter",
        "reformule", "reformuler", "contexte",
    ],
    "impact": [
        "impact", "impacte", "affecte", "concerne", "dépendance", "dépend",
        "lié à", "lié", "relation", "scope", "périmètre", "qui est touché",
        "quels tickets", "quels topics", "quels documents", "ripple",
        "cascade", "propagation", "version", "release",
    ],
    "pilotage": [
        "priorité", "priorités", "prioriser", "backlog", "quoi faire",
        "aujourd'hui", "sprint", "plan", "planning", "roadmap", "retard",
        "blocage", "bloqué", "bloque", "suivant", "next", "milestone",
        "livraison", "delivery", "status", "état", "avancement",
        "que faire", "par où commencer", "commencer par",
    ],
    "analyse_fonctionnelle": [
        "règle métier", "règle fonctionnelle", "besoin métier", "valeur",
        "use case", "cas d'usage", "fonctionnel", "fonctionnalité",
        "user story", "critère d'acceptation", "acceptance", "périmètre",
        "scope fonctionnel", "analyse de valeur", "ROI", "enjeu",
        "objectif métier", "processus métier", "flux", "workflow",
    ],
    "analyse_technique": [
        "sql", "bdd", "base de données", "requête", "query", "jointure",
        "index", "migration", "schema", "table", "colonne", "api",
        "endpoint", "dal", "linq", "orm", "stacktrace", "erreur technique",
        "exception", "log", "trace", "debug", "code", "performance",
        "latence", "timeout", "architecture technique", "microservice",
        "infra", "déploiement", "docker", "kubernetes",
    ],
    "redaction": [
        "rédige", "rédiger", "écris", "écrire", "fiche", "ticket",
        "bug report", "note", "commentaire", "documentation", "doc",
        "compte-rendu", "CR", "rapport", "plan de recette", "recette",
        "template", "modèle", "prépare", "préparer", "génère", "générer",
        "créer un ticket", "créer un document",
    ],
    "transformation": [
        "transforme", "transformer", "convertis", "convertir", "traduis",
        "traduire", "reformule en", "reformuler en", "extrais", "extraire",
        "technique en fonctionnel", "fonctionnel en technique",
        "mail en ticket", "mail en commentaire", "analyse en ticket",
        "ticket à partir", "synthétise", "synthétiser",
    ],
    "memoire": [
        "mémoire", "mémorise", "mémoriser", "memoire", "memorise", "memoriser",
        "enregistre", "retenir", "retient",
        "décision", "décisions", "decision", "decisions",
        "risque", "risques", "fait", "faits",
        "note importante", "à retenir", "a retenir",
        "qu'avons-nous décidé", "qu avons nous decide",
        "ce qui a été décidé", "historique", "contexte projet",
        "dépendance connue", "dependance connue", "question ouverte",
    ],
}

# Default mode when nothing matches
_DEFAULT_MODE = "cadrage"

# ─── Imperative creation detection ───────────────────────────────────────────
# These patterns take PRIORITY over keyword scoring.
# They detect explicit imperative verbs that mean "produce this object NOW".
# Applied on normalized (accent-stripped, lowercase) text.

_IMPERATIVE_REDACTION_RE = re.compile(
    r"\b("
    r"cree?[sz]?"             # crée, crées, créer, creer, crée
    r"|redige[sz]?"           # rédige, rédiges
    r"|redige?r"              # rédiger
    r"|ecri[st]"              # écris, écrit
    r"|ecrire"                # écrire
    r"|prepare[sz]?"          # prépare, prépares
    r"|preparer"              # préparer
    r"|gene?re[sz]?"          # génère, générer
    r"|generer"               # générer
    r"|produi[st]"            # produis, produit
    r"|elabore[sz]?"          # élabore
    r"|fais? une? (fiche|note|ticket|doc|plan|recette|rapport)"
    r"|sors? un"              # sors un
    r"|lance? un"             # lance un
    r")\b"
)

# Patterns that signal "rewrite / improve an EXISTING object"
# When matched, Shadow PO must NOT create a new ticket if one already exists.
# The LLM is instructed to produce the fiche in answer_markdown instead.
_REWRITE_EXISTING_RE = re.compile(
    r"\b("
    r"(ecri[st]?|ecrire)\s+(la|le|une?|cette|ce)?\s*(fiche|ticket)"
    r"|(refai[st]?|refaire)\s+(la|le|une?|cette|ce)?\s*(fiche|ticket)"
    r"|(ameliore[sz]?|ameliorer)\s+(la|le|une?|cette|ce)?\s*(fiche|ticket)"
    r"|(redige[sz]?|rediger)\s+(la|le|une?|cette|ce)?\s*(fiche|ticket)"
    r"|(reprend[sz]?|reprendre)\s+(la|le|une?|cette|ce)?\s*(fiche|ticket)"
    r"|(complete[sz]?|completer)\s+(la|le|une?|cette|ce)?\s*(fiche|ticket)"
    r"|(mets?\s+a\s+jour|maj)\s+(la|le|une?|cette|ce)?\s*(fiche|ticket)"
    r")\b"
    r"|fiche\s+(bug|ticket|evolution|anomalie)"  # "fiche bug de X"
    r"|la\s+fiche\s+(du|de\s+l[ae']?|de\s+ce)"  # "la fiche du bug"
)

_IMPERATIVE_TRANSFORMATION_RE = re.compile(
    r"\b("
    r"transforme[sz]?"        # transforme
    r"|transformer"           # transformer
    r"|convertis"             # convertis
    r"|convertir"             # convertir
    r"|tradui[st]"            # traduis, traduit
    r"|traduire"              # traduire
    r"|reformule[sz]? en"     # reformule en
    r"|extrais"               # extrais
    r"|extraire"              # extraire
    r"|syntheti[sz]e"         # synthétise
    r")\b"
)


# ─── Scoring ──────────────────────────────────────────────────────────────────

def _score_message(message: str) -> dict[str, int]:
    """Score each mode by counting keyword matches.

    Both the message and keywords are accent-normalized before matching
    so that 'memorise' matches 'mémorise', etc.
    """
    text = _normalize(message)
    scores: dict[str, int] = {mode: 0 for mode in _MODE_KEYWORDS}
    for mode, keywords in _MODE_KEYWORDS.items():
        for kw in keywords:
            nkw = _normalize(kw)
            if re.search(r'\b' + re.escape(nkw) + r'\b', text):
                scores[mode] += 1
    return scores


def _reading_line(mode: str, message: str) -> str:
    """Generate a one-line summary describing what was understood."""
    _LINES: dict[str, str] = {
        "cadrage":               "Demande de cadrage / compréhension d'un message ou d'une situation",
        "impact":                "Analyse d'impact — identification des objets et dépendances concernés",
        "pilotage":              "Question de pilotage — priorisation, plan d'action ou état d'avancement",
        "analyse_fonctionnelle": "Analyse fonctionnelle — règle métier, périmètre ou valeur",
        "analyse_technique":     "Investigation technique — SQL, API, code ou architecture",
        "redaction":             "Demande de rédaction — ticket, note, document ou commentaire",
        "transformation":        "Transformation de contenu — conversion ou reformulation",
        "memoire":               "Gestion de la mémoire — faits, décisions ou risques à retenir",
    }
    return _LINES.get(mode, "Demande analysée")


# ─── Public API ───────────────────────────────────────────────────────────────

def detect_intent(message: str) -> IntentResult:
    """Detect the best Shadow PO work mode for the given message.

    Priority:
      1. Imperative creation/transformation patterns  → immediate redaction/transformation
      2. Keyword scoring                              → standard mode detection
      3. Fallback to cadrage                         → when nothing matches

    Returns an IntentResult with:
      - mode        : one of the 8 modes
      - confidence  : high | medium | low
      - reading_line: one-line description of what was understood
    """
    text_norm = _normalize(message)

    # ── Priority 1: Imperative creation detection ─────────────────────────────
    # When a user explicitly demands creation/production, bypass scoring entirely.
    # "crée un ticket bug", "rédige une fiche", "génère un document", etc.

    # Rewrite-existing: "écris la fiche", "refais la fiche", "améliore le ticket"
    # These are redaction but the user is referring to an EXISTING object.
    # We flag is_rewrite_existing so the runtime can enforce no-create_ticket.
    if _REWRITE_EXISTING_RE.search(text_norm):
        return IntentResult(
            mode="redaction",
            confidence="high",
            reading_line="Demande de rédaction/refonte d'une fiche existante — ne pas créer un nouveau ticket si un objet crédible existe",
            is_rewrite_existing=True,
        )

    if _IMPERATIVE_REDACTION_RE.search(text_norm):
        return IntentResult(
            mode="redaction",
            confidence="high",
            reading_line="Demande impérative de création — ticket, fiche, document ou note",
        )
    if _IMPERATIVE_TRANSFORMATION_RE.search(text_norm):
        return IntentResult(
            mode="transformation",
            confidence="high",
            reading_line="Demande impérative de transformation — conversion ou reformulation",
        )

    # ── Priority 2: Keyword scoring ───────────────────────────────────────────
    scores = _score_message(message)
    top_score = max(scores.values())

    if top_score == 0:
        return IntentResult(
            mode=_DEFAULT_MODE,
            confidence="low",
            reading_line=_reading_line(_DEFAULT_MODE, message),
        )

    # Find the winning mode (highest score); break ties by _MODE_KEYWORDS order
    mode = max(_MODE_KEYWORDS.keys(), key=lambda m: scores[m])

    # Confidence: high if winner has clear lead; medium if tied/close; low if only 1 match
    sorted_scores = sorted(scores.values(), reverse=True)
    if top_score >= 3:
        confidence = "high"
    elif top_score >= 2 and (len(sorted_scores) < 2 or sorted_scores[1] < top_score):
        confidence = "medium"
    elif top_score >= 2:
        confidence = "medium"
    else:
        confidence = "low"

    return IntentResult(
        mode=mode,
        confidence=confidence,
        reading_line=_reading_line(mode, message),
    )
