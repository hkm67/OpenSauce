import sqlite3
from contextlib import contextmanager

from .config import DATABASE_PATH


SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    github_id INTEGER UNIQUE,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS activities (
    user_id INTEGER NOT NULL,
    opensource_id INTEGER NOT NULL,
    timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    url TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (opensource_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS achievements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    project_id INTEGER,
    name TEXT NOT NULL,
    description TEXT,
    url TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
);
"""


MIGRATIONS = (
    "ALTER TABLE achievements ADD COLUMN project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL",
    "ALTER TABLE achievements ADD COLUMN url TEXT",
)

DEFAULT_PROJECTS = (
    (
        "https://github.com/hkm67/telegram-ai-bot/",
        "Telegram group bot that captures chat context and answers with an Ollama-first LLM agent, Gemini fallback, tool use, and Docker deployment. Has an open issue ready for agent work.",
    ),
    (
        "https://github.com/hoppscotch/hoppscotch/",
        "Open source API development platform for building, testing, and sharing HTTP, GraphQL, and realtime requests. Active TypeScript/Vue project with hundreds of open issues and good first issue candidates.",
    ),
    (
        "https://github.com/treeverse/lakeFS/",
        "Git-like data version control platform for object storage and data lake workflows. Go and Python ecosystem project with a steady backlog of open issues across SDKs, docs, and integrations.",
    ),
    (
        "https://github.com/directus/directus/",
        "Open source data platform and headless CMS that turns SQL databases into APIs and admin apps. JavaScript/TypeScript project with many open issues across frontend, API, extensions, and docs.",
    ),
    (
        "https://github.com/caddyserver/caddy/",
        "Extensible Go web server with automatic HTTPS. Mature infrastructure project with many open issues suitable for focused bug fixes, docs, tests, and module improvements.",
    ),
    (
        "https://github.com/micronaut-projects/micronaut-core/",
        "JVM framework for building modular microservices and serverless apps. Java project with hundreds of open issues, including curated good first issues and framework enhancements.",
    ),
)


def get_connection():
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


@contextmanager
def transaction():
    connection = get_connection()
    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def _ensure_github_id_column(connection):
    cols = {row[1] for row in connection.execute("PRAGMA table_info(users)")}
    if "github_id" not in cols:
        connection.execute("ALTER TABLE users ADD COLUMN github_id INTEGER")
    connection.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_github_id ON users(github_id)"
    )


def _seed_default_projects(connection):
    connection.executemany(
        """
        INSERT OR IGNORE INTO projects (url, description)
        VALUES (?, ?)
        """,
        DEFAULT_PROJECTS,
    )


def init_db():
    with transaction() as connection:
        connection.executescript(SCHEMA)
        _ensure_github_id_column(connection)
        existing_columns = {
            row["name"] for row in connection.execute("PRAGMA table_info(achievements)")
        }
        for migration in MIGRATIONS:
            column_name = migration.split(" ADD COLUMN ", 1)[1].split(" ", 1)[0]
            if column_name not in existing_columns:
                connection.execute(migration)
        _seed_default_projects(connection)


def row_to_dict(row):
    return dict(row) if row is not None else None
