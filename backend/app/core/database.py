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
