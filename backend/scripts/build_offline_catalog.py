"""Build the bundled, metadata-only SQLite catalogue used by the mobile app.

Usage from the repository root:
    python backend/scripts/build_offline_catalog.py
    python backend/scripts/build_offline_catalog.py --check

The seed intentionally contains document requisites and search aliases only.  It
does not contain legal text and must not be presented as a verified edition of a
law.  A later, reviewed ingestion process may add verified text fragments to the
same versioned schema.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sqlite3
import sys
from pathlib import Path
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_SEED_PATH = PROJECT_ROOT / "mobile" / "assets" / "legal" / "ru-core-catalog-v1.json"
DEFAULT_OUTPUT_PATH = PROJECT_ROOT / "mobile" / "assets" / "legal" / "ru-core-catalog-v1.db"
SCHEMA_VERSION = 1
METADATA_ONLY_NOTICE = (
    "В офлайн-пакете сохранены только реквизиты и поисковые метки. "
    "Полный текст, его редакция и юридическая актуальность здесь не подтверждены."
)


def canonical_json(value: Any) -> str:
    """Return stable JSON for hashes and reproducible package metadata."""

    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def sha256(value: Any) -> str:
    return hashlib.sha256(canonical_json(value).encode("utf-8")).hexdigest()


def project_path(value: Path) -> Path:
    """Reject accidental output outside this repository."""

    resolved = value.resolve()
    try:
        resolved.relative_to(PROJECT_ROOT.resolve())
    except ValueError as error:
        raise ValueError(f"Path must be inside the project: {resolved}") from error
    return resolved


def load_seed(seed_path: Path) -> dict[str, Any]:
    with seed_path.open("r", encoding="utf-8") as seed_file:
        seed = json.load(seed_file)

    if not isinstance(seed, dict):
        raise ValueError("Seed must be a JSON object.")
    if seed.get("content_scope") != "metadata_only":
        raise ValueError("Only metadata_only seeds are accepted by this builder.")
    if not isinstance(seed.get("documents"), list) or not seed["documents"]:
        raise ValueError("Seed must contain a non-empty documents list.")

    ids: set[str] = set()
    required = {
        "id",
        "title",
        "document_type",
        "source_name",
        "revision_label",
        "content_state",
        "jurisdiction",
        "legal_level",
        "category",
    }
    forbidden = {"content", "full_text", "body", "text", "articles"}
    for document in seed["documents"]:
        if not isinstance(document, dict):
            raise ValueError("Every document must be a JSON object.")
        missing = required.difference(document)
        if missing:
            raise ValueError(f"Document is missing required fields: {sorted(missing)}")
        if document["id"] in ids:
            raise ValueError(f"Duplicate document id: {document['id']}")
        if document.get("content_state") != "offline_metadata":
            raise ValueError(
                f"{document['id']}: the starter package may contain only offline_metadata."
            )
        unexpected_text = forbidden.intersection(document)
        if unexpected_text:
            raise ValueError(
                f"{document['id']}: legal text fields are not allowed in the metadata seed: "
                f"{sorted(unexpected_text)}"
            )
        ids.add(document["id"])

    return seed


def create_schema(connection: sqlite3.Connection) -> None:
    connection.executescript(
        """
        PRAGMA foreign_keys = ON;
        PRAGMA journal_mode = DELETE;
        PRAGMA application_id = 1347569222;
        PRAGMA user_version = 1;

        CREATE TABLE catalog_meta (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        CREATE TABLE documents (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            document_type TEXT NOT NULL,
            document_number TEXT,
            source_name TEXT NOT NULL,
            source_url TEXT,
            published_at TEXT,
            revision_label TEXT NOT NULL,
            effective_from TEXT,
            effective_to TEXT,
            source_checked_at TEXT,
            content_hash TEXT NOT NULL,
            content_state TEXT NOT NULL CHECK (
                content_state IN ('offline_metadata', 'source_metadata', 'planned', 'verified_text')
            ),
            content_notice TEXT NOT NULL,
            is_demo INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0, 1)),
            jurisdiction TEXT,
            legal_level TEXT,
            category TEXT NOT NULL,
            search_terms TEXT NOT NULL DEFAULT '',
            text_package_version TEXT,
            inserted_at TEXT NOT NULL
        );

        CREATE TABLE fragments (
            id INTEGER PRIMARY KEY,
            document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
            ordinal INTEGER NOT NULL,
            fragment_kind TEXT NOT NULL CHECK (
                fragment_kind IN (
                    'metadata', 'preamble', 'section', 'chapter', 'article', 'paragraph'
                )
            ),
            article_label TEXT,
            heading TEXT NOT NULL,
            body TEXT NOT NULL,
            text_status TEXT NOT NULL CHECK (text_status IN ('metadata_only', 'verified_text')),
            source_fragment_ref TEXT,
            revision_label TEXT,
            valid_from TEXT,
            valid_to TEXT,
            verified_at TEXT,
            content_hash TEXT NOT NULL,
            UNIQUE(document_id, ordinal)
        );

        -- A contentful FTS table is deliberately used so the first package can
        -- index only metadata fragments. Later imports can add checked text
        -- fragments with the same row-id relationship.
        CREATE VIRTUAL TABLE fragment_fts USING fts5(
            document_id UNINDEXED,
            heading,
            body,
            tokenize = 'unicode61 remove_diacritics 2'
        );

        CREATE INDEX documents_category_idx ON documents(category, title);
        CREATE INDEX documents_type_idx ON documents(document_type, title);
        CREATE INDEX fragments_document_idx ON fragments(document_id, ordinal);

        CREATE TRIGGER fragments_after_insert
        AFTER INSERT ON fragments BEGIN
            INSERT INTO fragment_fts(rowid, document_id, heading, body)
            VALUES (NEW.id, NEW.document_id, NEW.heading, NEW.body);
        END;

        CREATE TRIGGER fragments_after_delete
        AFTER DELETE ON fragments BEGIN
            INSERT INTO fragment_fts(fragment_fts, rowid, document_id, heading, body)
            VALUES ('delete', OLD.id, OLD.document_id, OLD.heading, OLD.body);
        END;

        CREATE TRIGGER fragments_after_update
        AFTER UPDATE OF document_id, heading, body ON fragments BEGIN
            INSERT INTO fragment_fts(fragment_fts, rowid, document_id, heading, body)
            VALUES ('delete', OLD.id, OLD.document_id, OLD.heading, OLD.body);
            INSERT INTO fragment_fts(rowid, document_id, heading, body)
            VALUES (NEW.id, NEW.document_id, NEW.heading, NEW.body);
        END;
        """
    )


def metadata_fragment(document: dict[str, Any]) -> tuple[str, str]:
    """Make an explicitly non-legal-text FTS fragment from document requisites."""

    fields = [
        "Офлайн-каталог реквизитов.",
        f"Вид: {document['document_type']}.",
        f"Категория: {document['category']}.",
    ]
    if document.get("document_number"):
        fields.append(f"Номер: {document['document_number']}.")
    if document.get("published_at"):
        fields.append(f"Дата исходного акта: {document['published_at']}.")
    if document.get("search_terms"):
        fields.append(f"Поисковые метки: {document['search_terms']}.")
    fields.append(METADATA_ONLY_NOTICE)
    return document["title"], " ".join(fields)


def build_package(seed_path: Path, output_path: Path) -> None:
    seed = load_seed(seed_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path = output_path.with_suffix(f"{output_path.suffix}.tmp")
    if temporary_path.exists():
        temporary_path.unlink()

    connection = sqlite3.connect(temporary_path)
    try:
        create_schema(connection)
        manifest_hash = sha256(seed)
        package_metadata = {
            "package_id": seed.get("package_id", "ru-core-catalog"),
            "package_version": seed.get("package_version", "v1"),
            "schema_version": SCHEMA_VERSION,
            "built_at": seed["built_at"],
            "content_scope": "metadata_only",
            "legal_text_included": False,
            "source_manifest_hash": manifest_hash,
            "notice": METADATA_ONLY_NOTICE,
        }
        connection.executemany(
            "INSERT INTO catalog_meta(key, value) VALUES (?, ?)",
            [
                (key, str(value).lower() if isinstance(value, bool) else str(value))
                for key, value in package_metadata.items()
            ],
        )

        for document in seed["documents"]:
            document_hash = sha256(document)
            connection.execute(
                """
                INSERT INTO documents (
                    id, title, document_type, document_number, source_name, source_url,
                    published_at, revision_label, effective_from, effective_to,
                    source_checked_at, content_hash, content_state, content_notice,
                    is_demo, jurisdiction, legal_level, category, search_terms,
                    text_package_version, inserted_at
                ) VALUES (
                    :id, :title, :document_type, :document_number, :source_name, :source_url,
                    :published_at, :revision_label, :effective_from, :effective_to,
                    :source_checked_at, :content_hash, :content_state, :content_notice,
                    0, :jurisdiction, :legal_level, :category, :search_terms,
                    NULL, :inserted_at
                )
                """,
                {
                    **document,
                    "content_hash": document_hash,
                    "content_notice": document.get("content_notice", METADATA_ONLY_NOTICE),
                    "document_number": document.get("document_number"),
                    "source_url": document.get("source_url"),
                    "published_at": document.get("published_at"),
                    "effective_from": document.get("effective_from"),
                    "effective_to": document.get("effective_to"),
                    "source_checked_at": document.get("source_checked_at"),
                    "search_terms": document.get("search_terms", ""),
                    "inserted_at": seed["built_at"],
                },
            )
            heading, body = metadata_fragment(document)
            fragment = {
                "document_id": document["id"],
                "heading": heading,
                "body": body,
                "content_hash": sha256({"heading": heading, "body": body}),
                "revision_label": document["revision_label"],
            }
            connection.execute(
                """
                INSERT INTO fragments (
                    document_id, ordinal, fragment_kind, article_label, heading, body,
                    text_status, source_fragment_ref, revision_label, valid_from,
                    valid_to, verified_at, content_hash
                ) VALUES (
                    :document_id, 1, 'metadata', NULL, :heading, :body,
                    'metadata_only', NULL, :revision_label, NULL, NULL, NULL, :content_hash
                )
                """,
                fragment,
            )

        connection.commit()
        connection.execute("VACUUM")
        connection.close()
        os.replace(temporary_path, output_path)
    except Exception:
        connection.close()
        if temporary_path.exists():
            temporary_path.unlink()
        raise


def check_package(output_path: Path, expected_document_count: int | None = None) -> tuple[int, int]:
    """Validate schema, metadata-only status, and a real FTS query."""

    connection = sqlite3.connect(f"file:{output_path}?mode=ro", uri=True)
    try:
        tables = {
            row[0]
            for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type IN ('table', 'view')"
            )
        }
        missing = {"catalog_meta", "documents", "fragments", "fragment_fts"}.difference(tables)
        if missing:
            raise ValueError(f"Package schema is incomplete: missing {sorted(missing)}")

        metadata = dict(connection.execute("SELECT key, value FROM catalog_meta"))
        if metadata.get("schema_version") != str(SCHEMA_VERSION):
            raise ValueError("Unexpected schema version.")
        if metadata.get("content_scope") != "metadata_only":
            raise ValueError("This package is not marked metadata_only.")
        if metadata.get("legal_text_included") != "false":
            raise ValueError("Starter package must not claim that legal text is included.")

        document_count = connection.execute("SELECT COUNT(*) FROM documents").fetchone()[0]
        fragment_count = connection.execute("SELECT COUNT(*) FROM fragments").fetchone()[0]
        unapproved_states = connection.execute(
            "SELECT COUNT(*) FROM documents WHERE content_state <> 'offline_metadata'"
        ).fetchone()[0]
        if unapproved_states:
            raise ValueError("Starter package contains a non-metadata document state.")
        if fragment_count != document_count:
            raise ValueError("Every starter document must have exactly one metadata fragment.")
        if expected_document_count is not None and document_count != expected_document_count:
            raise ValueError(
                f"Unexpected document count: {document_count}, expected {expected_document_count}."
            )

        search_rows = connection.execute(
            "SELECT document_id FROM fragment_fts WHERE fragment_fts MATCH ?",
            ("Конституция",),
        ).fetchall()
        if not search_rows:
            raise ValueError("FTS verification query did not find the Constitution card.")
        return document_count, fragment_count
    finally:
        connection.close()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build the metadata-only offline legal catalogue.")
    parser.add_argument("--seed", type=Path, default=DEFAULT_SEED_PATH)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT_PATH)
    parser.add_argument(
        "--check",
        action="store_true",
        help="Validate an existing package instead of rebuilding it.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        seed_path = project_path(args.seed)
        output_path = project_path(args.output)
        if args.check:
            expected_documents = len(load_seed(seed_path)["documents"])
            documents, fragments = check_package(output_path, expected_documents)
            print(f"OK: {output_path.name} — documents={documents}, metadata_fragments={fragments}")
        else:
            build_package(seed_path, output_path)
            documents, fragments = check_package(
                output_path, len(load_seed(seed_path)["documents"])
            )
            print(f"Built: {output_path} — documents={documents}, metadata_fragments={fragments}")
        return 0
    except (OSError, ValueError, json.JSONDecodeError, sqlite3.Error) as error:
        print(f"Offline catalogue error: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
