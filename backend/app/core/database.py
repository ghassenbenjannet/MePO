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
