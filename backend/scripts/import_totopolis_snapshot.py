r"""Build an unreviewed offline SQLite snapshot from a local Totopolis/laws checkout.

This importer is deliberately offline: it never downloads data, starts external
programs, or uses the upstream repository's search models. It accepts only a
locally staged copy pinned by an allowlist and produces a separate
``source_snapshot`` package. That state is intentionally different from
``verified_text``: integrity checks here do not prove legal accuracy,
completeness, currency, or editorial review.

Examples (run from the project root in PowerShell)::

    .\backend\.venv\Scripts\python.exe .\backend\scripts\import_totopolis_snapshot.py `
      --source-root .\.cache\totopolis-laws-main\laws-main

    .\backend\.venv\Scripts\python.exe .\backend\scripts\import_totopolis_snapshot.py `
      --check --output .\.cache\legal-packages\ru-core-snapshot-totopolis-2026-09-25.db

The default scope imports only the explicit core allowlist. ``--scope all`` is
available for a local technical experiment, but it must not be bundled in the
mobile app without separate device-size, source-governance, and legal review.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sqlite3
import sys
from collections.abc import Iterable, Iterator, Sequence
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_ALLOWLIST_PATH = (
    PROJECT_ROOT / "backend" / "data" / "imports" / "totopolis-2026-09-25" / "allowlist.json"
)
DEFAULT_OUTPUT_PATH = (
    PROJECT_ROOT / ".cache" / "legal-packages" / "ru-core-snapshot-totopolis-2026-09-25.db"
)
SCHEMA_VERSION = 2
COMMIT_RE = re.compile(r"^[0-9a-f]{40}$")
SOURCE_SNAPSHOT_STATE = "source_snapshot"
SOURCE_SNAPSHOT_NOTICE = (
    "Текст сохранён офлайн из внешнего снимка. Он не прошёл юридическую проверку "
    "«ПравоОрбиты»; перед правовым использованием сверяйте официальную публикацию "
    "и редакцию на нужную дату."
)


class SnapshotImportError(ValueError):
    """Raised when a staged source or the resulting package is inconsistent."""


@dataclass(frozen=True)
class SnapshotDescriptor:
    snapshot_id: str
    repository: str
    commit: str
    snapshot_date: str
    license_name: str


@dataclass(frozen=True)
class SourceDocument:
    document_id: str
    upstream_slug: str
    document_type: str
    legal_level: str
    category: str
    search_terms: tuple[str, ...]
    catalog_parent_id: str | None = None


@dataclass(frozen=True)
class ImportedFragment:
    ordinal: int
    kind: str
    article_label: str | None
    heading: str
    body: str
    legal_status: str | None
    structure_path: tuple[str, ...]
    source_file: str
    source_sha256: str


@dataclass(frozen=True)
class ImportedDocument:
    source_document: SourceDocument
    title: str
    document_number: str | None
    act_date: str | None
    revision_date: str
    claimed_official_source_url: str | None
    fragments: tuple[ImportedFragment, ...]
    article_count: int
    source_digest: str


@dataclass(frozen=True)
class SnapshotCheckResult:
    documents: int
    articles: int
    fragments: int
    package_sha256: str


def canonical_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha256_json(value: Any) -> str:
    return sha256_bytes(canonical_json(value).encode("utf-8"))


def document_digest(fragment_hashes: Sequence[str]) -> str:
    digest = hashlib.sha256()
    for fragment_hash in fragment_hashes:
        digest.update(bytes.fromhex(fragment_hash))
    return digest.hexdigest()


def absolute_project_path(value: Path) -> Path:
    resolved = value.resolve()
    try:
        resolved.relative_to(PROJECT_ROOT.resolve())
    except ValueError as error:
        raise SnapshotImportError(
            f"Output path must stay inside the project: {resolved}"
        ) from error
    return resolved


def resolve_source_path(root: Path, relative_path: str, context: str) -> Path:
    relative = Path(relative_path)
    if relative.is_absolute():
        raise SnapshotImportError(f"{context}: source path must be relative.")
    resolved = (root / relative).resolve()
    try:
        resolved.relative_to(root.resolve())
    except ValueError as error:
        raise SnapshotImportError(f"{context}: source path escapes the staged root.") from error
    return resolved


def require_object(value: Any, context: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise SnapshotImportError(f"{context} must be a JSON object.")
    return value


def require_list(value: Any, context: str) -> list[Any]:
    if not isinstance(value, list):
        raise SnapshotImportError(f"{context} must be a JSON array.")
    return value


def require_text(value: Any, context: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise SnapshotImportError(f"{context} must be a non-empty string.")
    return value.strip()


def optional_text(value: Any, context: str) -> str | None:
    if value is None or (isinstance(value, str) and not value.strip()):
        return None
    return require_text(value, context)


def load_json(path: Path, context: str) -> tuple[dict[str, Any], str]:
    try:
        raw = path.read_bytes()
    except OSError as error:
        raise SnapshotImportError(f"Cannot read {context}: {path}") from error
    try:
        parsed = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise SnapshotImportError(f"{context} is not valid UTF-8 JSON: {path}") from error
    return require_object(parsed, context), sha256_bytes(raw)


def load_descriptor(allowlist_path: Path) -> tuple[SnapshotDescriptor, tuple[SourceDocument, ...]]:
    allowlist, _ = load_json(allowlist_path, "Allowlist")
    if allowlist.get("schema_version") != 1:
        raise SnapshotImportError("Allowlist has an unsupported schema_version.")
    snapshot = require_object(allowlist.get("snapshot"), "Allowlist snapshot")
    descriptor = SnapshotDescriptor(
        snapshot_id=require_text(snapshot.get("id"), "Allowlist snapshot id"),
        repository=require_text(snapshot.get("repository"), "Allowlist snapshot repository"),
        commit=require_text(snapshot.get("commit"), "Allowlist snapshot commit"),
        snapshot_date=require_text(snapshot.get("snapshot_date"), "Allowlist snapshot date"),
        license_name=require_text(snapshot.get("license"), "Allowlist snapshot license"),
    )
    if not COMMIT_RE.fullmatch(descriptor.commit):
        raise SnapshotImportError(
            "Allowlist snapshot commit must be a 40-character lowercase SHA-1."
        )
    if not descriptor.repository.startswith("https://"):
        raise SnapshotImportError("Allowlist snapshot repository must use HTTPS.")

    source_documents: list[SourceDocument] = []
    seen_ids: set[str] = set()
    seen_slugs: set[str] = set()
    for index, raw_document in enumerate(
        require_list(allowlist.get("documents"), "Allowlist documents")
    ):
        document = require_object(raw_document, f"Allowlist document #{index + 1}")
        document_id = require_text(document.get("id"), f"Allowlist document #{index + 1} id")
        upstream_slug = require_text(
            document.get("upstream_slug"), f"Allowlist document '{document_id}' upstream_slug"
        )
        if document_id in seen_ids or upstream_slug in seen_slugs:
            raise SnapshotImportError("Allowlist document ids and upstream slugs must be unique.")
        terms = require_list(
            document.get("search_terms"), f"Allowlist document '{document_id}' terms"
        )
        source_documents.append(
            SourceDocument(
                document_id=document_id,
                upstream_slug=upstream_slug,
                document_type=require_text(
                    document.get("document_type"), f"Allowlist document '{document_id}' type"
                ),
                legal_level=require_text(
                    document.get("legal_level"), f"Allowlist document '{document_id}' legal level"
                ),
                category=require_text(
                    document.get("category"), f"Allowlist document '{document_id}' category"
                ),
                search_terms=tuple(
                    require_text(term, f"Allowlist document '{document_id}' search term")
                    for term in terms
                ),
                catalog_parent_id=optional_text(
                    document.get("catalog_parent_id"),
                    f"Allowlist document '{document_id}' catalog_parent_id",
                ),
            )
        )
        seen_ids.add(document_id)
        seen_slugs.add(upstream_slug)

    if not source_documents:
        raise SnapshotImportError("Allowlist documents must not be empty.")
    return descriptor, tuple(source_documents)


def iter_articles(nodes: Iterable[Any], context: str) -> Iterator[tuple[str, tuple[str, ...]]]:
    """Yield source article file names in the source structure's declared order."""

    for node_index, raw_node in enumerate(nodes):
        node = require_object(raw_node, f"{context} structure item #{node_index + 1}")
        unit = optional_text(node.get("unit"), f"{context} structure item unit")
        heading = optional_text(node.get("heading"), f"{context} structure item heading")
        children = node.get("children")
        if unit == "статья":
            source_file = require_text(node.get("file"), f"{context} article file")
            yield source_file, tuple(part for part in (heading,) if part)
            continue
        if children is not None:
            yield from iter_articles(
                require_list(children, f"{context} structure children"), context
            )


def flatten_text(value: Any) -> str:
    """Retain text order in the source's nested article content without rendering markup."""

    if isinstance(value, str):
        return value.strip()
    if isinstance(value, list):
        return "\n".join(part for item in value if (part := flatten_text(item)))
    if isinstance(value, dict):
        parts: list[str] = []
        text = value.get("text")
        if isinstance(text, str) and text.strip():
            parts.append(text.strip())
        content = value.get("content")
        if content is not None:
            nested = flatten_text(content)
            if nested:
                parts.append(nested)
        return "\n".join(parts)
    return ""


def source_file_digest(records: Iterable[tuple[str, str]]) -> str:
    """Digest ordered paths and hashes, not filenames alone."""

    digest = hashlib.sha256()
    for relative_path, file_hash in records:
        digest.update(relative_path.encode("utf-8"))
        digest.update(b"\0")
        digest.update(bytes.fromhex(file_hash))
    return digest.hexdigest()


def source_url_for_document(descriptor: SnapshotDescriptor, data_directory: str) -> str:
    clean_directory = data_directory.strip("/")
    return f"{descriptor.repository}/blob/{descriptor.commit}/data/{clean_directory}/index.json"


def source_documents_for_scope(
    scope: str,
    allowlisted_documents: Sequence[SourceDocument],
    index: dict[str, Any],
) -> tuple[SourceDocument, ...]:
    if scope == "core":
        return tuple(allowlisted_documents)

    generated: list[SourceDocument] = []
    for raw_entry in require_list(index.get("codes"), "Source root codes"):
        entry = require_object(raw_entry, "Source root code")
        slug = require_text(entry.get("slug"), "Source root code slug")
        act = require_text(entry.get("act"), f"Source root code '{slug}' act")
        kind = require_text(entry.get("kind"), f"Source root code '{slug}' kind")
        if kind == "codex":
            document_type = "Кодекс"
            legal_level = "code"
            category = "Кодексы"
        elif act.startswith("Федеральный конституционный закон"):
            document_type = "Федеральный конституционный закон"
            legal_level = "federal_constitutional_law"
            category = "Федеральные конституционные законы"
        elif act.startswith("Закон Российской Федерации") or act.startswith("Закон РСФСР"):
            document_type = "Закон"
            legal_level = "law"
            category = "Законы"
        elif act.startswith("Конституция"):
            document_type = "Конституция"
            legal_level = "constitution"
            category = "Основные акты"
        else:
            document_type = "Федеральный закон"
            legal_level = "federal_law"
            category = "Федеральные законы"
        generated.append(
            SourceDocument(
                document_id=f"ru-source-snapshot-{slug}",
                upstream_slug=slug,
                document_type=document_type,
                legal_level=legal_level,
                category=category,
                search_terms=(
                    slug,
                    require_text(entry.get("code"), f"Source root code '{slug}' title"),
                ),
            )
        )
    return tuple(generated)


def import_document(
    source_root: Path,
    descriptor: SnapshotDescriptor,
    entry: dict[str, Any],
    source_document: SourceDocument,
) -> ImportedDocument:
    source_dir = require_text(
        entry.get("dir"), f"Source root '{source_document.upstream_slug}' dir"
    )
    document_index_relative = f"data/{source_dir.strip('/')}/index.json"
    document_index_path = resolve_source_path(
        source_root, document_index_relative, "Document index"
    )
    document_index, document_index_hash = load_json(
        document_index_path, f"Document index '{source_document.upstream_slug}'"
    )
    if (
        require_text(document_index.get("slug"), "Document index slug")
        != source_document.upstream_slug
    ):
        raise SnapshotImportError(
            f"Document index slug does not match allowlist: {source_document.upstream_slug}."
        )
    title = require_text(document_index.get("code"), "Document index title")
    revision_date = require_text(
        document_index.get("redaction_date"), "Document index redaction_date"
    )
    document_number = optional_text(document_index.get("act_number"), "Document index act_number")
    act_date = optional_text(document_index.get("act_date"), "Document index act_date")
    claimed_source_url = optional_text(
        document_index.get("source_url"), "Document index source_url"
    )

    input_records: list[tuple[str, str]] = [(document_index_relative, document_index_hash)]
    fragments: list[ImportedFragment] = []
    ordinal = 1

    preamble_body = flatten_text(document_index.get("preamble", []))
    content_body = flatten_text(document_index.get("content", []))
    boundary_body = "\n".join(part for part in (preamble_body, content_body) if part)
    if boundary_body:
        source_hash = sha256_json(
            {"preamble": document_index.get("preamble"), "content": document_index.get("content")}
        )
        fragments.append(
            ImportedFragment(
                ordinal=ordinal,
                kind="preamble",
                article_label=None,
                heading="Преамбула и вводные положения",
                body=boundary_body,
                legal_status=None,
                structure_path=(),
                source_file=document_index_relative,
                source_sha256=source_hash,
            )
        )
        ordinal += 1

    article_files = tuple(
        iter_articles(
            require_list(document_index.get("structure"), "Document index structure"), title
        )
    )
    if not article_files:
        raise SnapshotImportError(
            f"Document '{source_document.upstream_slug}' does not contain article files."
        )
    seen_article_files: set[str] = set()
    article_count = 0
    for source_file, _ in article_files:
        if source_file in seen_article_files:
            raise SnapshotImportError(
                f"Document '{source_document.upstream_slug}' repeats source file {source_file}."
            )
        seen_article_files.add(source_file)
        article_relative = f"data/{source_dir.strip('/')}/{source_file}"
        article_path = resolve_source_path(source_root, article_relative, "Article")
        article, article_hash = load_json(
            article_path, f"Article '{source_document.upstream_slug}/{source_file}'"
        )
        if (
            require_text(article.get("code_slug"), "Article code_slug")
            != source_document.upstream_slug
        ):
            raise SnapshotImportError(
                f"Article '{article_relative}' does not belong to {source_document.upstream_slug}."
            )
        heading = require_text(article.get("heading"), f"Article '{article_relative}' heading")
        article_body = flatten_text(article.get("content"))
        article_number = require_text(article.get("number"), f"Article '{article_relative}' number")
        article_status = optional_text(
            article.get("status"), f"Article '{article_relative}' status"
        )
        if not article_body:
            if article_status:
                article_body = f"[Текст статьи отсутствует в снимке; статус: {article_status}.]"
            else:
                raise SnapshotImportError(
                    f"Article '{article_relative}' has no text content or status."
                )
        path_values = require_list(article.get("path", []), f"Article '{article_relative}' path")
        structure_path = tuple(
            require_text(value, f"Article '{article_relative}' path item") for value in path_values
        )
        fragments.append(
            ImportedFragment(
                ordinal=ordinal,
                kind="article",
                article_label=f"Статья {article_number}",
                heading=heading,
                body=article_body,
                legal_status=article_status,
                structure_path=structure_path,
                source_file=article_relative,
                source_sha256=article_hash,
            )
        )
        input_records.append((article_relative, article_hash))
        ordinal += 1
        article_count += 1

    expected_articles = entry.get("articles")
    if not isinstance(expected_articles, int) or expected_articles < 1:
        raise SnapshotImportError(
            f"Source root '{source_document.upstream_slug}' has no valid article count."
        )
    if article_count != expected_articles:
        raise SnapshotImportError(
            f"Document '{source_document.upstream_slug}' has {article_count} article files, "
            f"but source index declares {expected_articles}."
        )

    closing_body = flatten_text(document_index.get("closing", []))
    if closing_body:
        source_hash = sha256_json({"closing": document_index.get("closing")})
        fragments.append(
            ImportedFragment(
                ordinal=ordinal,
                kind="appendix",
                article_label=None,
                heading="Заключительные реквизиты",
                body=closing_body,
                legal_status=None,
                structure_path=(),
                source_file=document_index_relative,
                source_sha256=source_hash,
            )
        )

    return ImportedDocument(
        source_document=source_document,
        title=title,
        document_number=document_number,
        act_date=act_date,
        revision_date=revision_date,
        claimed_official_source_url=claimed_source_url,
        fragments=tuple(fragments),
        article_count=article_count,
        source_digest=source_file_digest(input_records),
    )


def create_schema(connection: sqlite3.Connection) -> None:
    connection.executescript(
        """
        PRAGMA foreign_keys = ON;
        PRAGMA journal_mode = DELETE;
        PRAGMA application_id = 1347569223;
        PRAGMA user_version = 2;

        CREATE TABLE catalog_meta (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        CREATE TABLE source_snapshots (
            id TEXT PRIMARY KEY,
            repository TEXT NOT NULL,
            upstream_commit TEXT NOT NULL,
            snapshot_date TEXT NOT NULL,
            license_name TEXT NOT NULL,
            source_index_sha256 TEXT NOT NULL,
            input_tree_sha256 TEXT NOT NULL,
            legal_review_status TEXT NOT NULL CHECK (
                legal_review_status IN ('not_reviewed', 'reviewed')
            ),
            imported_at TEXT NOT NULL
        );

        CREATE TABLE documents (
            id TEXT PRIMARY KEY,
            catalog_parent_id TEXT,
            source_snapshot_id TEXT NOT NULL REFERENCES source_snapshots(id),
            upstream_slug TEXT NOT NULL,
            title TEXT NOT NULL,
            document_type TEXT NOT NULL,
            document_number TEXT,
            source_name TEXT NOT NULL,
            source_url TEXT NOT NULL,
            claimed_official_source_url TEXT,
            published_at TEXT,
            revision_label TEXT NOT NULL,
            effective_from TEXT,
            effective_to TEXT,
            source_checked_at TEXT,
            content_hash TEXT NOT NULL,
            source_digest TEXT NOT NULL,
            content_state TEXT NOT NULL CHECK (content_state = 'source_snapshot'),
            content_notice TEXT NOT NULL,
            is_demo INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0, 1)),
            jurisdiction TEXT NOT NULL,
            legal_level TEXT NOT NULL,
            category TEXT NOT NULL,
            search_terms TEXT NOT NULL,
            text_package_version TEXT NOT NULL,
            article_count INTEGER NOT NULL CHECK (article_count >= 1),
            inserted_at TEXT NOT NULL,
            UNIQUE(source_snapshot_id, upstream_slug)
        );

        CREATE TABLE fragments (
            id INTEGER PRIMARY KEY,
            document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
            ordinal INTEGER NOT NULL,
            fragment_kind TEXT NOT NULL CHECK (
                fragment_kind IN (
                    'preamble', 'section', 'chapter', 'article', 'paragraph', 'appendix'
                )
            ),
            article_label TEXT,
            heading TEXT NOT NULL,
            body TEXT NOT NULL,
            text_status TEXT NOT NULL CHECK (text_status = 'source_snapshot'),
            legal_status TEXT,
            source_fragment_ref TEXT NOT NULL,
            source_file TEXT NOT NULL,
            source_sha256 TEXT NOT NULL,
            structure_path TEXT NOT NULL,
            revision_label TEXT NOT NULL,
            valid_from TEXT,
            valid_to TEXT,
            verified_at TEXT,
            content_hash TEXT NOT NULL,
            UNIQUE(document_id, ordinal)
        );

        CREATE VIRTUAL TABLE fragment_fts USING fts5(
            document_id UNINDEXED,
            heading,
            body,
            tokenize = 'unicode61 remove_diacritics 2'
        );

        CREATE INDEX documents_category_idx ON documents(category, title);
        CREATE INDEX documents_parent_idx ON documents(catalog_parent_id, title);
        CREATE INDEX fragments_document_idx ON fragments(document_id, ordinal);
        CREATE INDEX fragments_article_idx ON fragments(document_id, article_label);

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


def package_output_path(output: Path, allow_mobile_asset: bool) -> Path:
    resolved = absolute_project_path(output)
    mobile_assets = (PROJECT_ROOT / "mobile" / "assets" / "legal").resolve()
    if resolved.is_relative_to(mobile_assets) and not allow_mobile_asset:
        raise SnapshotImportError(
            "Refusing to write an unreviewed source snapshot into the mobile bundle. "
            "Use --allow-mobile-asset only after device-size and legal-review gates."
        )
    return resolved


def build_snapshot(
    source_root: Path,
    allowlist_path: Path,
    output_path: Path,
    scope: str = "core",
    built_at: str | None = None,
) -> SnapshotCheckResult:
    """Build and validate a local source-snapshot package without network access."""

    descriptor, allowlisted_documents = load_descriptor(allowlist_path)
    source_root = source_root.resolve()
    source_index_relative = "data/index.json"
    source_index_path = resolve_source_path(source_root, source_index_relative, "Source root index")
    source_index, source_index_hash = load_json(source_index_path, "Source root index")
    source_documents = source_documents_for_scope(scope, allowlisted_documents, source_index)
    entries_by_slug: dict[str, dict[str, Any]] = {}
    for raw_entry in require_list(source_index.get("codes"), "Source root codes"):
        entry = require_object(raw_entry, "Source root code")
        slug = require_text(entry.get("slug"), "Source root code slug")
        if slug in entries_by_slug:
            raise SnapshotImportError(f"Source root index contains duplicate slug '{slug}'.")
        entries_by_slug[slug] = entry

    imported_documents: list[ImportedDocument] = []
    for source_document in source_documents:
        entry = entries_by_slug.get(source_document.upstream_slug)
        if entry is None:
            raise SnapshotImportError(
                f"Allowlist entry '{source_document.document_id}' refers to missing upstream slug "
                f"'{source_document.upstream_slug}'."
            )
        imported_documents.append(import_document(source_root, descriptor, entry, source_document))

    input_tree_records = [(source_index_relative, source_index_hash)]
    input_tree_records.extend(
        (document.source_document.upstream_slug, document.source_digest)
        for document in imported_documents
    )
    input_tree_digest = source_file_digest(input_tree_records)
    built_timestamp = built_at or datetime.now(UTC).replace(microsecond=0).isoformat()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path = output_path.with_suffix(f"{output_path.suffix}.tmp")
    if temporary_path.exists():
        temporary_path.unlink()

    connection = sqlite3.connect(temporary_path)
    try:
        create_schema(connection)
        source_name = f"Totopolis/laws — офлайн-снимок от {descriptor.snapshot_date}"
        metadata = {
            "package_id": f"ru-{scope}-snapshot-{descriptor.snapshot_date}",
            "package_version": descriptor.snapshot_date,
            "schema_version": str(SCHEMA_VERSION),
            "built_at": built_timestamp,
            "content_scope": SOURCE_SNAPSHOT_STATE,
            "legal_text_included": "true",
            "legal_review_status": "not_reviewed",
            "upstream_repository": descriptor.repository,
            "upstream_commit": descriptor.commit,
            "upstream_snapshot_date": descriptor.snapshot_date,
            "upstream_license": descriptor.license_name,
            "source_index_sha256": source_index_hash,
            "input_tree_sha256": input_tree_digest,
            "notice": SOURCE_SNAPSHOT_NOTICE,
        }
        connection.executemany(
            "INSERT INTO catalog_meta(key, value) VALUES (?, ?)", metadata.items()
        )
        connection.execute(
            """
            INSERT INTO source_snapshots (
                id, repository, upstream_commit, snapshot_date, license_name,
                source_index_sha256, input_tree_sha256, legal_review_status, imported_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'not_reviewed', ?)
            """,
            (
                descriptor.snapshot_id,
                descriptor.repository,
                descriptor.commit,
                descriptor.snapshot_date,
                descriptor.license_name,
                source_index_hash,
                input_tree_digest,
                built_timestamp,
            ),
        )

        for imported in imported_documents:
            fragment_hashes = [
                sha256_json(
                    {
                        "ordinal": fragment.ordinal,
                        "kind": fragment.kind,
                        "article_label": fragment.article_label,
                        "heading": fragment.heading,
                        "body": fragment.body,
                        "legal_status": fragment.legal_status,
                        "structure_path": fragment.structure_path,
                        "source_file": fragment.source_file,
                        "source_sha256": fragment.source_sha256,
                    }
                )
                for fragment in imported.fragments
            ]
            content_hash = document_digest(fragment_hashes)
            source_url = source_url_for_document(
                descriptor,
                require_text(
                    entries_by_slug[imported.source_document.upstream_slug].get("dir"),
                    "Source root document dir",
                ),
            )
            revision_label = (
                f"Редакция, заявленная источником: {imported.revision_date}; "
                f"снимок от {descriptor.snapshot_date}"
            )
            connection.execute(
                """
                INSERT INTO documents (
                    id, catalog_parent_id, source_snapshot_id, upstream_slug,
                    title, document_type, document_number, source_name,
                    source_url, claimed_official_source_url, published_at,
                    revision_label, effective_from, effective_to,
                    source_checked_at, content_hash, source_digest, content_state,
                    content_notice, is_demo, jurisdiction, legal_level, category,
                    search_terms, text_package_version, article_count, inserted_at
                ) VALUES (
                    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL,
                    ?, ?, 'source_snapshot', ?, 0, 'RU', ?, ?, ?, ?, ?, ?
                )
                """,
                (
                    imported.source_document.document_id,
                    imported.source_document.catalog_parent_id,
                    descriptor.snapshot_id,
                    imported.source_document.upstream_slug,
                    imported.title,
                    imported.source_document.document_type,
                    imported.document_number,
                    source_name,
                    source_url,
                    imported.claimed_official_source_url,
                    imported.act_date,
                    revision_label,
                    content_hash,
                    imported.source_digest,
                    SOURCE_SNAPSHOT_NOTICE,
                    imported.source_document.legal_level,
                    imported.source_document.category,
                    " ".join(imported.source_document.search_terms),
                    descriptor.snapshot_id,
                    imported.article_count,
                    built_timestamp,
                ),
            )
            for fragment, fragment_hash in zip(imported.fragments, fragment_hashes, strict=True):
                connection.execute(
                    """
                    INSERT INTO fragments (
                        document_id, ordinal, fragment_kind, article_label,
                        heading, body, text_status, legal_status,
                        source_fragment_ref, source_file, source_sha256,
                        structure_path, revision_label, valid_from, valid_to,
                        verified_at, content_hash
                    ) VALUES (
                        ?, ?, ?, ?, ?, ?, 'source_snapshot', ?, ?, ?, ?, ?,
                        ?, NULL, NULL, NULL, ?
                    )
                    """,
                    (
                        imported.source_document.document_id,
                        fragment.ordinal,
                        fragment.kind,
                        fragment.article_label,
                        fragment.heading,
                        fragment.body,
                        fragment.legal_status,
                        fragment.article_label or fragment.heading,
                        fragment.source_file,
                        fragment.source_sha256,
                        canonical_json(fragment.structure_path),
                        revision_label,
                        fragment_hash,
                    ),
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

    return check_snapshot_package(output_path, expected_documents=len(imported_documents))


def check_snapshot_package(
    output_path: Path,
    expected_documents: int | None = None,
) -> SnapshotCheckResult:
    """Validate an already built unreviewed package without using its source tree."""

    if not output_path.is_file():
        raise SnapshotImportError(f"Snapshot package does not exist: {output_path}")
    connection = sqlite3.connect(f"file:{output_path.resolve()}?mode=ro", uri=True)
    try:
        integrity = connection.execute("PRAGMA integrity_check").fetchone()
        if integrity != ("ok",):
            raise SnapshotImportError(f"SQLite integrity check failed: {integrity}")
        metadata = dict(connection.execute("SELECT key, value FROM catalog_meta"))
        required_metadata = {
            "content_scope": SOURCE_SNAPSHOT_STATE,
            "legal_review_status": "not_reviewed",
            "legal_text_included": "true",
            "schema_version": str(SCHEMA_VERSION),
        }
        for key, expected in required_metadata.items():
            if metadata.get(key) != expected:
                raise SnapshotImportError(f"Snapshot metadata '{key}' must equal '{expected}'.")
        snapshot_rows = connection.execute(
            "SELECT COUNT(*) FROM source_snapshots WHERE legal_review_status = 'not_reviewed'"
        ).fetchone()[0]
        if snapshot_rows != 1:
            raise SnapshotImportError("Snapshot must contain exactly one unreviewed source record.")
        documents = connection.execute("SELECT COUNT(*) FROM documents").fetchone()[0]
        fragments = connection.execute("SELECT COUNT(*) FROM fragments").fetchone()[0]
        articles = connection.execute(
            "SELECT COUNT(*) FROM fragments WHERE fragment_kind = 'article'"
        ).fetchone()[0]
        if documents < 1 or fragments < documents or articles < 1:
            raise SnapshotImportError(
                "Snapshot must contain documents, fragments, and article text."
            )
        if expected_documents is not None and documents != expected_documents:
            raise SnapshotImportError(
                f"Unexpected document count: {documents}, expected {expected_documents}."
            )
        invalid_document_states = connection.execute(
            "SELECT COUNT(*) FROM documents WHERE content_state <> 'source_snapshot'"
        ).fetchone()[0]
        invalid_fragment_states = connection.execute(
            "SELECT COUNT(*) FROM fragments WHERE text_status <> 'source_snapshot'"
        ).fetchone()[0]
        if invalid_document_states or invalid_fragment_states:
            raise SnapshotImportError("A source snapshot must not claim verified text status.")
        mismatched_articles = connection.execute(
            """
            SELECT COUNT(*) FROM documents
            WHERE article_count <> (
                SELECT COUNT(*) FROM fragments
                WHERE fragments.document_id = documents.id AND fragment_kind = 'article'
            )
            """
        ).fetchone()[0]
        if mismatched_articles:
            raise SnapshotImportError(
                "Stored article counts do not match imported article fragments."
            )
        rows = connection.execute(
            "SELECT document_id, ordinal, content_hash FROM fragments ORDER BY document_id, ordinal"
        ).fetchall()
        hashes_by_document: dict[str, list[str]] = {}
        for document_id, _ordinal, content_hash in rows:
            hashes_by_document.setdefault(document_id, []).append(content_hash)
        for document_id, expected_hash in connection.execute(
            "SELECT id, content_hash FROM documents ORDER BY id"
        ):
            if document_digest(hashes_by_document.get(document_id, [])) != expected_hash:
                raise SnapshotImportError(f"Document checksum mismatch: {document_id}")
        fts_rows = connection.execute(
            "SELECT COUNT(*) FROM fragment_fts WHERE fragment_fts MATCH 'статья'"
        ).fetchone()[0]
        if fts_rows < 1:
            raise SnapshotImportError("FTS index did not return an article query result.")
    finally:
        connection.close()
    return SnapshotCheckResult(
        documents=documents,
        articles=articles,
        fragments=fragments,
        package_sha256=sha256_bytes(output_path.read_bytes()),
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Import a locally staged Totopolis/laws source snapshot without network access."
    )
    parser.add_argument("--source-root", type=Path, help="Directory containing data/index.json.")
    parser.add_argument("--allowlist", type=Path, default=DEFAULT_ALLOWLIST_PATH)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT_PATH)
    parser.add_argument("--scope", choices=("core", "all"), default="core")
    parser.add_argument(
        "--check", action="store_true", help="Validate an existing output package only."
    )
    parser.add_argument(
        "--allow-mobile-asset",
        action="store_true",
        help="Allow output below mobile/assets/legal after separate release gates.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        output_path = package_output_path(args.output, args.allow_mobile_asset)
        if args.check:
            result = check_snapshot_package(output_path)
        else:
            if args.source_root is None:
                raise SnapshotImportError("--source-root is required unless --check is used.")
            result = build_snapshot(
                args.source_root,
                absolute_project_path(args.allowlist),
                output_path,
                args.scope,
            )
    except (OSError, SnapshotImportError, sqlite3.Error) as error:
        print(f"Source snapshot import error: {error}", file=sys.stderr)
        return 1
    print(
        f"OK: {output_path.name} — documents={result.documents}, articles={result.articles}, "
        f"fragments={result.fragments}, sha256={result.package_sha256}"
    )
    print("Status: unreviewed source snapshot; it is not a verified current legal edition.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
