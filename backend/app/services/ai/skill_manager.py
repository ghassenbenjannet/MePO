from __future__ import annotations

_SKILL = {
    "name": "Shadow PO",
    "version": "5.0",
    "system_prompt": "",
    "schema_note": "",
}

_JSON_RETRY_DIRECTIVE = (
    "IMPORTANT: retourne un JSON compact, strictement valide, sans texte hors JSON "
    "et sans repetition inutile."
)

_FILE_SEARCH_AUTHORIZED_BLOCK = (
    "== OUTIL DOCUMENTAIRE AUTORISE POUR CE TOUR ==\n"
    "file_search est explicitement autorise par le runtime pour completer le contexte documentaire. "
    "Ne l'utilise que si les sources locales injectees sont insuffisantes.\n"
    "== FIN OUTIL DOCUMENTAIRE =="
)

_STYLE_INSTRUCTIONS: dict[str, str] = {
    "concise": "STYLE CONCIS : reponse directe, courte, sans sections inutiles. Pas de redites. Pas de decoratif.",
    "balanced": "",
    "detailed": "STYLE DETAILLE : developper l'analyse avec des sections claires et des impacts explicites.",
    "expert": "STYLE EXPERT PO : niveau senior, terminologie precise, profondeur metier maximale.",
}

_DETAIL_INSTRUCTIONS: dict[str, str] = {
    "minimal": "NIVEAU MINIMAL : garder uniquement les points critiques. Certainty et next_actions tres courtes.",
    "normal": "",
    "verbose": "NIVEAU VERBEUX : expliciter les deductions, les incertitudes et les impacts.",
}


def get_skill(name: str = "shadow_po_v1") -> dict[str, str]:
    if name != "shadow_po_v1":
        raise KeyError(f"Unknown skill: {name!r}. Available: ['shadow_po_v1']")
    return _SKILL


def list_skills() -> list[str]:
    return ["shadow_po_v1"]


def get_json_retry_directive() -> str:
    return _JSON_RETRY_DIRECTIVE


def get_file_search_authorized_block() -> str:
    return _FILE_SEARCH_AUTHORIZED_BLOCK


def build_rewrite_existing_ticket_directive(ticket_title: str | None, ticket_id: str | None) -> str:
    safe_title = str(ticket_title or "").strip() or "Ticket existant"
    safe_id = str(ticket_id or "").strip() or "unknown"
    return (
        "[REGLE ECRIRE LA FICHE - OBJET EXISTANT DETECTE]\n"
        f"Ticket credible trouve : '{safe_title}' (ID: {safe_id}).\n"
        "REGLES ABSOLUES :\n"
        "  -> Mode = redaction obligatoire\n"
        "  -> Ne pas proposer create_ticket\n"
        "  -> Produire la fiche complete de ce ticket dans answer_markdown\n"
        "  -> Format obligatoire:\n"
        "     ## Contexte\n"
        "     ## Comportement observe\n"
        "     ## Comportement attendu\n"
        "     ## Perimetre impacte\n"
        "     ## Impacts\n"
        "     ## Criteres d'acceptation\n"
        "     ## A confirmer\n"
        "  -> Markdown structure uniquement, jamais de HTML brut\n"
        "  -> Pas d'invention: s'appuyer uniquement sur le ticket, ses criteres et le contexte injecte\n\n"
    )


def build_rewrite_mode_directive(mode: str, reading_line: str | None, *, requires_payload_complete: bool) -> str:
    safe_mode = str(mode or "redaction").strip() or "redaction"
    safe_reading_line = str(reading_line or "").strip()
    header = f"[INTENTION DETECTEE: mode={safe_mode}"
    if safe_reading_line:
        header += f" - {safe_reading_line}"
    header += "]\n"
    if requires_payload_complete:
        body = (
            "Regle absolue : cette demande est un ordre de creation ou transformation. "
            f"Repondre en mode '{safe_mode}' uniquement. "
            "answer_markdown en markdown pur. "
            "Produire les proposed_actions correspondantes avec payload complet.\n\n"
        )
    else:
        body = (
            "Regle absolue : repondre en mode 'redaction' uniquement. "
            "answer_markdown en markdown pur.\n\n"
        )
    return header + body


def build_test_feedback_redaction_directive() -> str:
    return (
        "[REGLE REDACTION MAIL DE TEST]\n"
        "Choisir d'abord le bon livrable parmi:\n"
        "  1. synthese recette\n"
        "  2. enrichissement ticket recette existant\n"
        "  3. commentaire sur anomalie existante\n"
        "  4. document structure rattache\n"
        "Ne jamais proposer add_comment sans ticket_id.\n"
        "Preferer un ticket recette ou anomalie existant a un ticket de suivi generique.\n\n"
    )


def get_style_directive(
    response_style: str | None,
    detail_level: str | None,
    show_confidence: bool | None = None,
    show_suggestions: bool | None = None,
) -> str:
    parts: list[str] = []

    style_instr = _STYLE_INSTRUCTIONS.get(response_style or "balanced", "")
    if style_instr:
        parts.append(style_instr)

    detail_instr = _DETAIL_INSTRUCTIONS.get(detail_level or "normal", "")
    if detail_instr:
        parts.append(detail_instr)

    if show_confidence is False:
        parts.append(
            'CERTAINTY DESACTIVE : produire "certainty": {"certain": [], "inferred": [], "to_confirm": []}.'
        )

    if show_suggestions is False:
        parts.append('ACTIONS PROPOSEES DESACTIVEES : produire "proposed_actions": [].')

    if not parts:
        return ""

    return "== PREFERENCES UTILISATEUR ==\n" + "\n".join(parts) + "\n== FIN PREFERENCES UTILISATEUR ==\n\n"
