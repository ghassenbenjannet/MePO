from collections.abc import Generator

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import settings


class Base(DeclarativeBase):
    pass


engine = create_engine(settings.database_url, future=True, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency — yields a DB session and closes it after the request."""
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables() -> None:
    """Create all tables declared in app.models (call once on startup)."""
    import app.models  # noqa: F401 — registers all models with Base

    Base.metadata.create_all(bind=engine)
    run_compat_migrations()


def run_compat_migrations() -> None:
    """Apply lightweight compatibility migrations for local/dev environments."""
    inspector = inspect(engine)

    with engine.begin() as connection:
        if "projects" in inspector.get_table_names():
            project_columns = {column["name"] for column in inspector.get_columns("projects")}
            if "status" not in project_columns:
                connection.execute(text("ALTER TABLE projects ADD COLUMN status VARCHAR(50) NOT NULL DEFAULT 'active'"))
            if "image_url" not in project_columns:
                connection.execute(text("ALTER TABLE projects ADD COLUMN image_url TEXT"))
            if "openai_strategy" not in project_columns:
                connection.execute(text(
                    "ALTER TABLE projects ADD COLUMN openai_strategy VARCHAR(80) NOT NULL DEFAULT 'responses_plus_conversation'"
                ))
            if "active_skill_version_id" not in project_columns:
                connection.execute(text("ALTER TABLE projects ADD COLUMN active_skill_version_id VARCHAR(36)"))

        if "spaces" in inspector.get_table_names():
            space_columns = {column["name"] for column in inspector.get_columns("spaces")}
            if "status" not in space_columns:
                connection.execute(text("ALTER TABLE spaces ADD COLUMN status VARCHAR(50) NOT NULL DEFAULT 'active'"))
            if "description" not in space_columns:
                connection.execute(text("ALTER TABLE spaces ADD COLUMN description TEXT"))
            if "is_favorite" not in space_columns:
                connection.execute(text("ALTER TABLE spaces ADD COLUMN is_favorite BOOLEAN NOT NULL DEFAULT FALSE"))

        if "topics" in inspector.get_table_names():
            topic_columns = {column["name"] for column in inspector.get_columns("topics")}
            if "topic_nature" not in topic_columns:
                connection.execute(text("ALTER TABLE topics ADD COLUMN topic_nature VARCHAR(50) NOT NULL DEFAULT 'study_delivery'"))
            if "color" not in topic_columns:
                connection.execute(text("ALTER TABLE topics ADD COLUMN color VARCHAR(50) NOT NULL DEFAULT 'indigo'"))
            if "roadmap_start_date" not in topic_columns:
                connection.execute(text("ALTER TABLE topics ADD COLUMN roadmap_start_date DATE"))
            if "roadmap_end_date" not in topic_columns:
                connection.execute(text("ALTER TABLE topics ADD COLUMN roadmap_end_date DATE"))
            if "dependencies" not in topic_columns:
                connection.execute(text("ALTER TABLE topics ADD COLUMN dependencies JSON NOT NULL DEFAULT '[]'"))
            if "tags" not in topic_columns:
                connection.execute(text("ALTER TABLE topics ADD COLUMN tags JSON NOT NULL DEFAULT '[]'"))
            if "updated_at" not in topic_columns:
                connection.execute(text("ALTER TABLE topics ADD COLUMN updated_at TIMESTAMP"))
                connection.execute(text("UPDATE topics SET updated_at = created_at WHERE updated_at IS NULL"))
                connection.execute(text("ALTER TABLE topics ALTER COLUMN updated_at SET NOT NULL"))

        if "tickets" in inspector.get_table_names():
            ticket_columns = {column["name"] for column in inspector.get_columns("tickets")}
            if "reporter" not in ticket_columns:
                connection.execute(text("ALTER TABLE tickets ADD COLUMN reporter VARCHAR(255)"))
            if "due_date" not in ticket_columns:
                connection.execute(text("ALTER TABLE tickets ADD COLUMN due_date DATE"))
            if "estimate" not in ticket_columns:
                connection.execute(text("ALTER TABLE tickets ADD COLUMN estimate FLOAT"))
            if "dependencies" not in ticket_columns:
                connection.execute(text("ALTER TABLE tickets ADD COLUMN dependencies JSON NOT NULL DEFAULT '[]'"))
            if "linked_document_ids" not in ticket_columns:
                connection.execute(text("ALTER TABLE tickets ADD COLUMN linked_document_ids JSON NOT NULL DEFAULT '[]'"))
            if "ticket_details" not in ticket_columns:
                connection.execute(text("ALTER TABLE tickets ADD COLUMN ticket_details JSON NOT NULL DEFAULT '{}'"))
            if "updated_at" not in ticket_columns:
                connection.execute(text("ALTER TABLE tickets ADD COLUMN updated_at TIMESTAMP"))
                connection.execute(text("UPDATE tickets SET updated_at = created_at WHERE updated_at IS NULL"))
                connection.execute(text("ALTER TABLE tickets ALTER COLUMN updated_at SET NOT NULL"))

        if "documents" in inspector.get_table_names():
            doc_columns = {column["name"] for column in inspector.get_columns("documents")}
            if "type" not in doc_columns:
                connection.execute(text("ALTER TABLE documents ADD COLUMN type VARCHAR(50) NOT NULL DEFAULT 'page'"))
            if "tags" not in doc_columns:
                connection.execute(text("ALTER TABLE documents ADD COLUMN tags JSON NOT NULL DEFAULT '[]'"))
            if "doc_metadata" not in doc_columns:
                connection.execute(text("ALTER TABLE documents ADD COLUMN doc_metadata JSON NOT NULL DEFAULT '{}'"))
            if "icon" not in doc_columns:
                connection.execute(text("ALTER TABLE documents ADD COLUMN icon VARCHAR(50)"))
            if "is_archived" not in doc_columns:
                connection.execute(text("ALTER TABLE documents ADD COLUMN is_archived BOOLEAN NOT NULL DEFAULT FALSE"))

        if "ai_conversations" in inspector.get_table_names():
            conv_columns = {column["name"] for column in inspector.get_columns("ai_conversations")}
            if "project_id" not in conv_columns:
                connection.execute(text("ALTER TABLE ai_conversations ADD COLUMN project_id VARCHAR(36)"))
            if "updated_at" not in conv_columns:
                connection.execute(text("ALTER TABLE ai_conversations ADD COLUMN updated_at TIMESTAMP"))
                connection.execute(text("UPDATE ai_conversations SET updated_at = created_at WHERE updated_at IS NULL"))
            if "skill_version_id_snapshot" not in conv_columns:
                connection.execute(text("ALTER TABLE ai_conversations ADD COLUMN skill_version_id_snapshot VARCHAR(36)"))
            if "openai_conversation_id" not in conv_columns:
                connection.execute(text("ALTER TABLE ai_conversations ADD COLUMN openai_conversation_id VARCHAR(255)"))
            if "openai_response_id" not in conv_columns:
                connection.execute(text("ALTER TABLE ai_conversations ADD COLUMN openai_response_id VARCHAR(255)"))
            if "summary_memory" not in conv_columns:
                connection.execute(text("ALTER TABLE ai_conversations ADD COLUMN summary_memory VARCHAR(4000)"))

        # project_knowledge_documents is created by create_all() on first run.
        # The block below handles environments where the table was created before
        # later columns were added (schema evolution safety net).
        if "project_knowledge_documents" in inspector.get_table_names():
            pkd_columns = {column["name"] for column in inspector.get_columns("project_knowledge_documents")}
            if "scope" not in pkd_columns:
                connection.execute(text("ALTER TABLE project_knowledge_documents ADD COLUMN scope VARCHAR(50) NOT NULL DEFAULT 'project'"))
            else:
                connection.execute(text("UPDATE project_knowledge_documents SET scope = 'project' WHERE scope IS NULL OR scope = ''"))
            if "document_type" not in pkd_columns:
                connection.execute(text("ALTER TABLE project_knowledge_documents ADD COLUMN document_type VARCHAR(100) NOT NULL DEFAULT 'reference'"))
            if "category" not in pkd_columns:
                connection.execute(text("ALTER TABLE project_knowledge_documents ADD COLUMN category VARCHAR(100) NOT NULL DEFAULT 'reference'"))
            elif "document_type" in pkd_columns:
                connection.execute(text("UPDATE project_knowledge_documents SET document_type = category WHERE document_type IS NULL OR document_type = ''"))
            if "source_type" not in pkd_columns:
                connection.execute(text("ALTER TABLE project_knowledge_documents ADD COLUMN source_type VARCHAR(50) NOT NULL DEFAULT 'upload'"))
            if "local_file_id" not in pkd_columns:
                connection.execute(text("ALTER TABLE project_knowledge_documents ADD COLUMN local_file_id VARCHAR(100)"))
            if "mime_type" not in pkd_columns:
                connection.execute(text("ALTER TABLE project_knowledge_documents ADD COLUMN mime_type VARCHAR(150)"))
            if "original_filename" not in pkd_columns:
                connection.execute(text("ALTER TABLE project_knowledge_documents ADD COLUMN original_filename VARCHAR(255)"))
            if "content_extracted_text" not in pkd_columns:
                connection.execute(text("ALTER TABLE project_knowledge_documents ADD COLUMN content_extracted_text TEXT"))
            if "linked_topic_ids" not in pkd_columns:
                connection.execute(text("ALTER TABLE project_knowledge_documents ADD COLUMN linked_topic_ids JSON NOT NULL DEFAULT '[]'"))
            if "updated_at" not in pkd_columns:
                connection.execute(text("ALTER TABLE project_knowledge_documents ADD COLUMN updated_at TIMESTAMP"))
                connection.execute(text("UPDATE project_knowledge_documents SET updated_at = created_at WHERE updated_at IS NULL"))
            if "sync_status" not in pkd_columns:
                connection.execute(text("ALTER TABLE project_knowledge_documents ADD COLUMN sync_status VARCHAR(50) NOT NULL DEFAULT 'not_synced'"))
            if "synced_at" not in pkd_columns:
                connection.execute(text("ALTER TABLE project_knowledge_documents ADD COLUMN synced_at TIMESTAMP"))
            if "content_hash" not in pkd_columns:
                connection.execute(text("ALTER TABLE project_knowledge_documents ADD COLUMN content_hash VARCHAR(64)"))
            if "sync_error" not in pkd_columns:
                connection.execute(text("ALTER TABLE project_knowledge_documents ADD COLUMN sync_error TEXT"))
            if "openai_file_id" not in pkd_columns:
                connection.execute(text("ALTER TABLE project_knowledge_documents ADD COLUMN openai_file_id VARCHAR(100)"))
            if "summary" not in pkd_columns:
                connection.execute(text("ALTER TABLE project_knowledge_documents ADD COLUMN summary TEXT"))
            if "tags" not in pkd_columns:
                connection.execute(text("ALTER TABLE project_knowledge_documents ADD COLUMN tags JSON NOT NULL DEFAULT '[]'"))
            if "is_active" not in pkd_columns:
                connection.execute(text("ALTER TABLE project_knowledge_documents ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE"))

        if "project_knowledge_settings" in inspector.get_table_names():
            pks_columns = {column["name"] for column in inspector.get_columns("project_knowledge_settings")}
            if "last_sync_summary_json" not in pks_columns:
                connection.execute(text("ALTER TABLE project_knowledge_settings ADD COLUMN last_sync_summary_json JSON NOT NULL DEFAULT '{}'"))
        if "project_knowledge_sync_items" in inspector.get_table_names():
            pksi_columns = {column["name"] for column in inspector.get_columns("project_knowledge_sync_items")}
            if "is_active" not in pksi_columns:
                connection.execute(text("ALTER TABLE project_knowledge_sync_items ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE"))

        if "projects" in inspector.get_table_names():
            project_columns = {column["name"] for column in inspector.get_columns("projects")}
            if "openai_vector_store_id" not in project_columns:
                connection.execute(text("ALTER TABLE projects ADD COLUMN openai_vector_store_id VARCHAR(100)"))

        if "project_skills" in inspector.get_table_names():
            skill_columns = {column["name"] for column in inspector.get_columns("project_skills")}
            if "updated_at" not in skill_columns:
                connection.execute(text("ALTER TABLE project_skills ADD COLUMN updated_at TIMESTAMP"))
                connection.execute(text("UPDATE project_skills SET updated_at = created_at WHERE updated_at IS NULL"))

        if "project_skill_versions" in inspector.get_table_names():
            version_columns = {column["name"] for column in inspector.get_columns("project_skill_versions")}
            if "version_label" not in version_columns:
                connection.execute(text("ALTER TABLE project_skill_versions ADD COLUMN version_label VARCHAR(50) NOT NULL DEFAULT 'v1'"))
            if "compiled_runtime_text" not in version_columns:
                connection.execute(text("ALTER TABLE project_skill_versions ADD COLUMN compiled_runtime_text TEXT NOT NULL DEFAULT ''"))
            if "source_kind" not in version_columns:
                connection.execute(text(
                    "ALTER TABLE project_skill_versions ADD COLUMN source_kind VARCHAR(80) NOT NULL DEFAULT 'legacy_project_skill_settings'"
                ))
