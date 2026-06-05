import ssl
from collections.abc import AsyncGenerator
from urllib.parse import urlparse

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from settings import settings


class Base(DeclarativeBase):
    pass


def _connect_args(database_url: str) -> dict:
    """Remote Postgres hosts may require SSL; localhost does not."""
    if not database_url:
        return {}
    host = urlparse(database_url.replace("+asyncpg", "")).hostname or ""
    if host in ("localhost", "127.0.0.1"):
        return {}
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    return {"ssl": ctx}


_engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    connect_args=_connect_args(settings.DATABASE_URL),
)
_session_factory = async_sessionmaker(_engine, expire_on_commit=False)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with _session_factory() as session:
        yield session


async def create_all_tables() -> None:
    """Create all tables on startup. Use Alembic for production migrations."""
    import auth.models  # noqa: F401
    import chat.models  # noqa: F401
    import integrations.models  # noqa: F401
    import rag.models  # noqa: F401

    pgvector_ok = False
    pgvector_error: Exception | None = None
    async with _engine.begin() as conn:
        try:
            await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
            pgvector_ok = True
        except Exception as exc:
            pgvector_error = exc
            if settings.REQUIRE_PGVECTOR:
                raise RuntimeError(
                    "pgvector extension is required but could not be enabled on this database. "
                    "Use Railway's Postgres + pgvector template, or local Postgres with pgvector. "
                    "Set REQUIRE_PGVECTOR=false only to boot without RAG tables. "
                    f"Original error: {exc}"
                ) from exc
            print(
                "WARNING: pgvector extension unavailable — skipping document_chunks table. "
                f"RAG ingestion will not work until pgvector is installed. ({exc})"
            )

    tables = [t for t in Base.metadata.sorted_tables if pgvector_ok or t.name != "document_chunks"]
    async with _engine.begin() as conn:
        await conn.run_sync(lambda sync_conn: Base.metadata.create_all(sync_conn, tables=tables))

    if pgvector_ok:
        print("pgvector enabled — document_chunks table ready for RAG.")
    elif pgvector_error is not None:
        print("Started without pgvector (REQUIRE_PGVECTOR=false). RAG tables were skipped.")
