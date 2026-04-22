from __future__ import annotations

from datetime import datetime

from sqlalchemy.orm import Session

from app.models.project import Project
from app.models.project_skill_settings import ProjectSkillSettings
from app.models.project_skill_version import ProjectSkillVersion

# ─── Skill v2 : Copilot PO/BA/QA documentaire ────────────────────────────────
# Contenu canonique de l'assistant MePO. Utilisé comme défaut à la création.
# Ne jamais stocker comme document de connaissance.
SKILL_V2_PAYLOAD: dict[str, str] = {
    "main_skill_text": (
        "Tu es un Copilot PO/BA/QA documentaire integre a MePO.\n"
        "Tu es specialise dans l'analyse produit et fonctionnelle a partir de preuves documentaires.\n\n"
        "Tes competences principales :\n"
        "- Analyser un comportement ou une situation a partir des specs, referentiels et documents importes\n"
        "- Identifier les ecarts entre l'existant, la cible, la documentation, la BDD et les tests\n"
        "- Rediger dans un format metier strict selon le cas traite\n"
        "- Proposer des topics, documents, tickets, fiches ADO ou plans de recette\n"
        "- Dire honnetement quand le corpus ne permet pas de conclure\n\n"
        "Ton engagement documentaire :\n"
        "- Tu t'appuies TOUJOURS sur les documents importes dans le corpus [Connaissance]\n"
        "- Tu cites CHAQUE document utilise dans sources_used avec son doc_id exact\n"
        "- Tu indiques TOUJOURS si une analyse est documentee ou non\n"
        "- Tu n'inventes JAMAIS de regles metier, de noms de tables, de schemas ou de specs"
    ),
    "general_directives_text": (
        "DIRECTIVES GLOBALES (non negociables) :\n\n"
        "1. PREUVE DOCUMENTAIRE\n"
        "   - Si [Connaissance] disponible : exploite et cite chaque document pertinent\n"
        "   - Si aucun document disponible : dis-le explicitement dans answer_markdown\n"
        "   - Ne produis jamais d'analyse sans indiquer son niveau de preuve\n\n"
        "2. FORMAT STRICT\n"
        "   - Respecte la structure imposee par le cas metier (use_case)\n"
        "   - Chaque section demandee doit etre presente, meme vide avec explication\n"
        "   - proposed_actions, next_actions et sources_used doivent toujours etre des listes\n\n"
        "3. HONNETETE\n"
        "   - Si tu ne sais pas : dis-le\n"
        "   - Si le corpus est insuffisant : signale-le avec le bloc warning\n"
        "   - Ne fournis jamais une analyse qui donne l'impression d'etre complete si elle ne l'est pas\n\n"
        "4. ACTIONS CONCRETES\n"
        "   - Pour chaque cas metier, propose au moins 1 action concrete dans proposed_actions\n"
        "   - Les actions doivent etre immediatement actionnables dans MePO"
    ),
    "mode_policies_text": (
        "POLITIQUES PAR CAS METIER :\n\n"
        "analyse :\n"
        "  Structure : ## Comprehension / ## Analyse / ## Points non documentes / ## Recommandations\n"
        "  sources_used obligatoire si corpus disponible. Bloc warning si aucune preuve.\n\n"
        "bogue :\n"
        "  Structure : ## Symptome / ## Cause probable / ## Actions correctives / ## Verification\n"
        "  proposed_actions >= 1 action create_ticket\n\n"
        "recette :\n"
        "  Structure : ## Perimetre / ## Cas de test / ## Criteres acceptation / ## Donnees / ## Resultats\n"
        "  proposed_actions = liste des cas de test a creer\n\n"
        "question_generale :\n"
        "  Reponse directe, concise. Citer les [Connaissance] si pertinents.\n\n"
        "redaction_besoin :\n"
        "  Structure : ## Contexte / ## Besoin / ## Criteres acceptation / ## Points attention / ## Etapes\n"
        "  proposed_actions = create_document ou create_ticket\n\n"
        "structuration_sujet :\n"
        "  Structure : ## Structure proposee / ## Elements a documenter / ## Decoupage / ## Etapes\n"
        "  next_actions >= 1 etape immediate"
    ),
    "action_policies_text": (
        "POLITIQUES D'ACTIONS :\n\n"
        "Types autorises : create_ticket | create_document | add_comment\n"
        "Regles :\n"
        "  - bogue et recette : >= 1 create_ticket obligatoire\n"
        "  - redaction_besoin : >= 1 create_document ou create_ticket\n"
        "  - question_generale : actions optionnelles\n"
        "  - Chaque action : label clair et actionnable"
    ),
    "output_templates_text": (
        "STRUCTURE OBLIGATOIRE PAR CAS METIER :\n\n"
        "analyse : ## Comprehension / ## Analyse [source: titre] / ## Points non documentes / ## Recommandations\n"
        "bogue : ## Symptome identifie / ## Cause probable / ## Actions correctives / ## Verification\n"
        "recette : ## Perimetre / ## Cas de test / ## Criteres d'acceptation / ## Donnees / ## Resultats\n"
        "redaction_besoin : ## Contexte / ## Besoin / ## Criteres / ## Points attention / ## Etapes\n"
        "structuration_sujet : ## Structure / ## Elements a documenter / ## Decoupage / ## Etapes"
    ),
    "guardrails_text": (
        "GARDE-FOUS ABSOLUS :\n\n"
        "- Ne jamais inventer de noms de tables SQL, de champs ou de regles metier\n"
        "- Ne jamais affirmer qu'un document dit quelque chose sans le citer\n"
        "- Si document_backed=false pour un cas critique : bloc warning obligatoire dans answer_markdown\n"
        "- Ne jamais donner une reponse propre sans indiquer le niveau de preuve"
    ),
}


EDITOR_KEYS = (
    "main_skill_text",
    "general_directives_text",
    "mode_policies_text",
    "action_policies_text",
    "output_templates_text",
    "guardrails_text",
)

LEGACY_EDITOR_KEYS = (
    "main_skill_text",
    "general_directives_text",
    "source_hierarchy_text",
    "mode_policies_text",
    "action_policies_text",
    "output_templates_text",
    "guardrails_text",
)

SECTION_LABELS = {
    "main_skill_text": "Contexte general",
    "general_directives_text": "Directives globales",
    "mode_policies_text": "Regles par use-case",
    "action_policies_text": "Politiques d'actions",
    "output_templates_text": "Structure de sortie",
    "guardrails_text": "Garde-fous",
}


def _clean_text(value: str | None) -> str:
    return (value or "").strip()


def _legacy_payload_to_editor_payload(settings: ProjectSkillSettings | None) -> dict[str, str]:
    payload: dict[str, str] = {}
    if not settings:
        for key in LEGACY_EDITOR_KEYS:
            payload[key] = ""
        return payload
    for key in LEGACY_EDITOR_KEYS:
        payload[key] = _clean_text(getattr(settings, key, None))
    return payload


def build_compiled_context(editor_payload_json: dict | None) -> str:
    payload = editor_payload_json or {}

    # If main_skill_text is a full markdown document (contains ## headers),
    # treat it as a self-contained skill and inject as-is — do not fragment.
    main = _clean_text(payload.get("main_skill_text"))
    other_sections = [_clean_text(payload.get(k)) for k in EDITOR_KEYS if k != "main_skill_text"]
    is_full_document = main.startswith("#") or "\n## " in main or "\n# " in main
    if is_full_document and not any(other_sections):
        return main

    sections: list[str] = []
    for key in EDITOR_KEYS:
        text = _clean_text(payload.get(key))
        if not text:
            continue
        label = SECTION_LABELS.get(key, key)
        sections.append(f"[{label}]\n{text}")
    return "\n\n".join(sections).strip()


def _next_version_label(db: Session, project_id: str) -> str:
    versions = (
        db.query(ProjectSkillVersion)
        .filter(ProjectSkillVersion.project_id == project_id)
        .order_by(ProjectSkillVersion.created_at.desc(), ProjectSkillVersion.version_label.desc())
        .all()
    )
    max_number = 0
    for version in versions:
        label = (version.version_label or "").strip().lower()
        if label.startswith("v") and label[1:].isdigit():
            max_number = max(max_number, int(label[1:]))
    return f"v{max_number + 1}"


def get_active_skill_version(db: Session, project_id: str) -> ProjectSkillVersion | None:
    project = db.get(Project, project_id)
    if not project:
        return None
    if project.active_skill_version_id:
        active = db.get(ProjectSkillVersion, project.active_skill_version_id)
        if active:
            return active
    return (
        db.query(ProjectSkillVersion)
        .filter(ProjectSkillVersion.project_id == project_id)
        .order_by(ProjectSkillVersion.created_at.desc())
        .first()
    )


def ensure_active_skill_version(db: Session, project_id: str) -> ProjectSkillVersion:
    project = db.get(Project, project_id)
    if not project:
        raise ValueError("Project not found.")

    active = get_active_skill_version(db, project_id)
    if active:
        if not project.active_skill_version_id:
            project.active_skill_version_id = active.id
            db.add(project)
            db.flush()
        return active

    legacy_settings = (
        db.query(ProjectSkillSettings)
        .filter(ProjectSkillSettings.project_id == project_id)
        .one_or_none()
    )
    legacy_payload = _legacy_payload_to_editor_payload(legacy_settings)
    # Use Skill v2 as default when no meaningful legacy content exists
    has_legacy = any(v.strip() for v in legacy_payload.values())
    editor_payload = legacy_payload if has_legacy else SKILL_V2_PAYLOAD
    compiled_context = build_compiled_context(editor_payload)

    version = ProjectSkillVersion(
        project_id=project_id,
        version_label=_next_version_label(db, project_id),
        editor_payload_json=editor_payload,
        compiled_context_text=compiled_context,
        compiled_runtime_text=compiled_context,
        source_kind="mepo_skill_editor",
        created_at=datetime.utcnow(),
    )
    db.add(version)
    db.flush()

    project.active_skill_version_id = version.id
    db.add(project)
    db.flush()
    return version


def list_skill_versions(db: Session, project_id: str) -> list[ProjectSkillVersion]:
    ensure_active_skill_version(db, project_id)
    return (
        db.query(ProjectSkillVersion)
        .filter(ProjectSkillVersion.project_id == project_id)
        .order_by(ProjectSkillVersion.created_at.desc())
        .all()
    )


def create_skill_version(db: Session, project_id: str, editor_payload_json: dict | None) -> ProjectSkillVersion:
    project = db.get(Project, project_id)
    if not project:
        raise ValueError("Project not found.")

    payload = editor_payload_json or {}
    normalized_payload: dict[str, str] = {}
    for key in LEGACY_EDITOR_KEYS:
        normalized_payload[key] = _clean_text(payload.get(key))

    compiled_context = build_compiled_context(normalized_payload)
    version = ProjectSkillVersion(
        project_id=project_id,
        version_label=_next_version_label(db, project_id),
        editor_payload_json=normalized_payload,
        compiled_context_text=compiled_context,
        compiled_runtime_text=compiled_context,
        source_kind="mepo_skill_editor",
        created_at=datetime.utcnow(),
    )
    db.add(version)
    db.flush()

    project.active_skill_version_id = version.id
    db.add(project)
    db.flush()
    return version


def activate_skill_version(db: Session, project_id: str, version_id: str) -> ProjectSkillVersion:
    project = db.get(Project, project_id)
    if not project:
        raise ValueError("Project not found.")

    version = db.get(ProjectSkillVersion, version_id)
    if not version or version.project_id != project_id:
        raise ValueError("Skill version not found.")

    project.active_skill_version_id = version.id
    db.add(project)
    db.flush()
    return version


def apply_skill_v2(db: Session, project_id: str) -> ProjectSkillVersion:
    """Create and activate Skill v2 (Copilot PO/BA/QA) for the given project."""
    project = db.get(Project, project_id)
    if not project:
        raise ValueError("Project not found.")

    compiled_context = build_compiled_context(SKILL_V2_PAYLOAD)
    version = ProjectSkillVersion(
        project_id=project_id,
        version_label=_next_version_label(db, project_id),
        editor_payload_json=SKILL_V2_PAYLOAD,
        compiled_context_text=compiled_context,
        compiled_runtime_text=compiled_context,
        source_kind="mepo_skill_v2",
        created_at=datetime.utcnow(),
    )
    db.add(version)
    db.flush()

    project.active_skill_version_id = version.id
    db.add(project)
    db.flush()
    return version
