import json
import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timedelta

from werkzeug.security import generate_password_hash

from .config import DATABASE_PATH


DEMO_PASSWORD = "demo123"
DEMO_MIN_ACHIEVEMENTS = 5


def _ago(days: int) -> str:
    return (datetime.utcnow() - timedelta(days=days)).strftime("%Y-%m-%d %H:%M:%S")

DEMO_USERS = (
    (
        "Alice Chen",
        "demo_alice",
        {"categories": ["Backend", "Infrastructure"], "notes": "Interested in APIs, Go, and networking."},
        None,
    ),
    (
        "Bob Martinez",
        "demo_bob",
        {"categories": ["Frontend", "Dev Tools"], "notes": "React, TypeScript, and DX tooling."},
        None,
    ),
    (
        "Carol Nguyen",
        "demo_carol",
        {"categories": ["AI / ML"], "notes": "Vectors, embeddings, and ML infra."},
        None,
    ),
    (
        "David Okonkwo",
        "demo_david",
        {"categories": ["Infrastructure", "Security"], "notes": "Kubernetes, TLS, and auth flows."},
        None,
    ),
    (
        "Eve Johansson",
        "demo_eve",
        {"categories": ["Dev Tools", "Backend"], "notes": "Rust search engines and CLI tooling."},
        None,
    ),
)


def _project_id_by_url(connection, url):
    row = connection.execute(
        "SELECT id FROM projects WHERE url = ?", (url,)
    ).fetchone()
    return row["id"] if row else None


def _seed_demo_users(connection):
    """Insert or refresh demo accounts and sample achievements (idempotent).

    UPSERT on ``username`` so password ``demo123`` and preferences stay valid
    even if rows existed with a stale hash.
    """
    pwd_hash = generate_password_hash(DEMO_PASSWORD, method="pbkdf2:sha256")

    for name, username, prefs, github_id in DEMO_USERS:
        connection.execute(
            """
            INSERT INTO users (name, username, password_hash, github_id, preferences)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(username) DO UPDATE SET
                name = excluded.name,
                password_hash = excluded.password_hash,
                preferences = excluded.preferences
            """,
            (
                name,
                username,
                pwd_hash,
                github_id,
                json.dumps(prefs),
            ),
        )

    user_id_by_name = {
        r["username"]: r["id"]
        for r in connection.execute(
            "SELECT id, username FROM users WHERE username LIKE 'demo_%'"
        ).fetchall()
    }
    if not user_id_by_name:
        return

    pid = lambda url: _project_id_by_url(connection, url)

    samples = [
        (
            "demo_alice",
            pid("https://github.com/caddyserver/caddy/"),
            "TLS reload edge case",
            "https://github.com/caddyserver/caddy/pull/6000",
            "https://github.com/caddyserver/caddy/issues/5900",
            "Reload fails under systemd notify",
            5900,
        ),
        (
            "demo_alice",
            pid("https://github.com/micronaut-projects/micronaut-core/"),
            "Micronaut HTTP client metrics",
            "https://github.com/micronaut-projects/micronaut-core/pull/9900",
            None,
            None,
            None,
        ),
        (
            "demo_bob",
            pid("https://github.com/hoppscotch/hoppscotch/"),
            "Hoppscotch collection export UI",
            "https://github.com/hoppscotch/hoppscotch/pull/4200",
            "https://github.com/hoppscotch/hoppscotch/issues/4100",
            "Export modal accessibility",
            4100,
        ),
        (
            "demo_bob",
            pid("https://github.com/strapi/strapi/"),
            "Strapi admin plugin typings",
            "https://github.com/strapi/strapi/pull/19000",
            None,
            None,
            None,
        ),
        (
            "demo_carol",
            pid("https://github.com/milvus-io/milvus/"),
            "Milvus index benchmark notes",
            "https://github.com/milvus-io/milvus/pull/28000",
            "https://github.com/milvus-io/milvus/issues/27500",
            "IVF_FLAT recall regression",
            27500,
        ),
        (
            "demo_carol",
            pid("https://github.com/apache/superset/"),
            "Superset chart plugin skeleton",
            "https://github.com/apache/superset/pull/26000",
            None,
            None,
            None,
        ),
        (
            "demo_david",
            pid("https://github.com/treeverse/lakeFS/"),
            "lakeFS merge conflict docs",
            "https://github.com/treeverse/lakeFS/pull/7200",
            None,
            None,
            None,
        ),
        (
            "demo_david",
            pid("https://github.com/directus/directus/"),
            "Directus OAuth scope docs",
            "https://github.com/directus/directus/pull/21000",
            "https://github.com/directus/directus/issues/20500",
            "Document OIDC scopes",
            20500,
        ),
        (
            "demo_eve",
            pid("https://github.com/meilisearch/meilisearch/"),
            "Meilisearch typo tolerance test",
            "https://github.com/meilisearch/meilisearch/pull/4500",
            None,
            None,
            None,
        ),
        (
            "demo_eve",
            pid("https://github.com/novuhq/novu/"),
            "Novu workflow trigger example",
            "https://github.com/novuhq/novu/pull/5100",
            "https://github.com/novuhq/novu/issues/5000",
            "Add idempotent trigger API sample",
            5000,
        ),
    ]

    need_achievements: set[str] = set()
    for username in user_id_by_name:
        uid = user_id_by_name[username]
        n = connection.execute(
            "SELECT COUNT(*) AS c FROM achievements WHERE user_id = ?",
            (uid,),
        ).fetchone()["c"]
        if n == 0:
            need_achievements.add(username)

    for username, project_id, name, url, issue_url, issue_title, issue_number in samples:
        if username not in need_achievements:
            continue
        if not project_id:
            continue
        uid = user_id_by_name.get(username)
        if not uid:
            continue
        connection.execute(
            """
            INSERT INTO achievements (
                user_id, project_id, name, description, url,
                issue_url, issue_title, issue_number
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                uid,
                project_id,
                name,
                None,
                url,
                issue_url,
                issue_title,
                issue_number,
            ),
        )

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    github_id INTEGER UNIQUE,
    preferences TEXT,
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
    issue_url TEXT,
    issue_title TEXT,
    issue_number INTEGER,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
);
"""


MIGRATIONS = (
    "ALTER TABLE achievements ADD COLUMN project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL",
    "ALTER TABLE achievements ADD COLUMN url TEXT",
    "ALTER TABLE achievements ADD COLUMN issue_url TEXT",
    "ALTER TABLE achievements ADD COLUMN issue_title TEXT",
    "ALTER TABLE achievements ADD COLUMN issue_number INTEGER",
    "ALTER TABLE users ADD COLUMN preferences TEXT",
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
    (
        "https://github.com/milvus-io/milvus/",
        "Open source vector database built for embedding similarity search and AI applications. Go/Python/C++ project with hundreds of open issues across clients, storage, indexing, and docs.",
    ),
    (
        "https://github.com/strapi/strapi/",
        "Open source headless CMS for building customizable content APIs. JavaScript/TypeScript project with a large issue queue across admin UI, plugins, REST/GraphQL APIs, and documentation.",
    ),
    (
        "https://github.com/meilisearch/meilisearch/",
        "Fast open source search engine focused on relevance and developer experience. Rust project with active issues around search behavior, API ergonomics, integrations, and docs.",
    ),
    (
        "https://github.com/novuhq/novu/",
        "Open source notification infrastructure for product teams. TypeScript project with active issues across workflow orchestration, providers, dashboard UX, and SDKs.",
    ),
    (
        "https://github.com/apache/superset/",
        "Apache Superset is a modern data exploration and visualization platform. Python/TypeScript project with hundreds of open issues across charts, dashboards, SQL Lab, and integrations.",
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
        INSERT INTO projects (url, description)
        VALUES (?, ?)
        ON CONFLICT(url) DO UPDATE SET
            description = excluded.description
        """,
        DEFAULT_PROJECTS,
    )


def init_db():
    with transaction() as connection:
        connection.executescript(SCHEMA)
        _ensure_github_id_column(connection)
        column_cache = {}
        for migration in MIGRATIONS:
            tokens = migration.split()
            table_name = tokens[tokens.index("TABLE") + 1]
            column_name = migration.split(" ADD COLUMN ", 1)[1].split(" ", 1)[0]
            if table_name not in column_cache:
                column_cache[table_name] = {
                    row["name"]
                    for row in connection.execute(f"PRAGMA table_info({table_name})")
                }
            if column_name not in column_cache[table_name]:
                connection.execute(migration)
                column_cache[table_name].add(column_name)
        _seed_default_projects(connection)
        if os.getenv("OPENSAUCE_SEED_DEMO", "").lower() in ("1", "true", "yes"):
            _seed_demo_users(connection)


def row_to_dict(row):
    return dict(row) if row is not None else None
