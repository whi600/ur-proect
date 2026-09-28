from __future__ import annotations

import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.dependencies import get_services
from app.container import AppServices
from app.schemas.documents import (
    DocumentDetail,
    DocumentFragment,
    DocumentFragmentPage,
    DocumentSummary,
)

router = APIRouter(prefix="/local-snapshot")

MAX_LIMIT = 100
DEFAULT_FRAGMENT_LIMIT = 24


def _safe_limit(value: int, default: int) -> int:
    return max(1, min(value if value > 0 else default, MAX_LIMIT))


def _tokens(value: str) -> tuple[str, ...]:
    return tuple(token for token in value.casefold().replace("ё", "е").split() if token)[:8]


@contextmanager
def _connect(path: Path) -> Iterator[sqlite3.Connection]:
    if not path.is_file():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Локальный полнотекстовой пакет не найден.",
        )

    try:
        connection = sqlite3.connect(f"{path.resolve().as_uri()}?mode=ro", uri=True)
    except sqlite3.Error as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Не удалось открыть локальный полнотекстовой пакет.",
        ) from exc

    connection.row_factory = sqlite3.Row
    try:
        yield connection
    finally:
        connection.close()


def _summary(row: sqlite3.Row) -> DocumentSummary:
    return DocumentSummary(
        id=row["id"],
        title=row["title"],
        document_type=row["document_type"],
        source_name=row["source_name"],
        source_url=row["source_url"],
        document_number=row["document_number"],
        published_at=row["published_at"],
        revision_label=row["revision_label"],
        effective_from=row["effective_from"],
        effective_to=row["effective_to"],
        is_demo=bool(row["is_demo"]),
        jurisdiction=row["jurisdiction"],
        legal_level=row["legal_level"],
        content_state="source_snapshot",
        source_checked_at=row["source_checked_at"],
    )


def _fragment(row: sqlite3.Row) -> DocumentFragment:
    return DocumentFragment(
        id=row["id"],
        ordinal=row["ordinal"],
        kind=row["fragment_kind"],
        label=row["article_label"],
        heading=row["heading"],
        body=row["body"],
        legal_status=row["legal_status"],
        revision_label=row["revision_label"],
        valid_from=row["valid_from"],
        valid_to=row["valid_to"],
    )


def _snapshot_notice(article_count: int) -> str:
    return (
        "Текст доступен на этом компьютере как снимок стороннего открытого источника.\n\n"
        f"В снимке заявлено статей: {article_count}.\n\n"
        "Статус: текст не прошёл юридическую проверку в «ПравоОрбите»; перед "
        "использованием сверяйте официальную публикацию и редакцию на нужную дату."
    )


def _matching_rows(connection: sqlite3.Connection, query: str | None, limit: int) -> list[sqlite3.Row]:
    rows = connection.execute(
        "SELECT * FROM documents ORDER BY category, title COLLATE NOCASE LIMIT ?", (MAX_LIMIT,)
    ).fetchall()
    if not query or not (tokens := _tokens(query)):
        return rows[:limit]

    def matches_metadata(row: sqlite3.Row) -> bool:
        haystack = " ".join(
            str(value or "")
            for value in (
                row["title"],
                row["document_type"],
                row["document_number"],
                row["category"],
                row["search_terms"],
            )
        ).casefold().replace("ё", "е")
        return all(token in haystack for token in tokens)

    matched: dict[str, sqlite3.Row] = {row["id"]: row for row in rows if matches_metadata(row)}
    fts_query = " AND ".join(f'"{token.replace(chr(34), chr(34) * 2)}"*' for token in tokens)
    try:
        text_rows = connection.execute(
            """
            SELECT DISTINCT documents.*
            FROM fragment_fts
            JOIN fragments ON fragments.id = fragment_fts.rowid
            JOIN documents ON documents.id = fragments.document_id
            WHERE fragment_fts MATCH ?
            ORDER BY documents.title COLLATE NOCASE
            LIMIT ?
            """,
            (fts_query, limit),
        ).fetchall()
    except sqlite3.Error:
        text_rows = []
    for row in text_rows:
        matched.setdefault(row["id"], row)
    return list(matched.values())[:limit]


@router.get("/documents", response_model=list[DocumentSummary])
def list_snapshot_documents(
    q: str | None = Query(default=None, max_length=200),
    limit: int = Query(default=50, ge=1, le=MAX_LIMIT),
    services: AppServices = Depends(get_services),
) -> list[DocumentSummary]:
    """Read locally bundled source-snapshot cards; no network request is made."""

    with _connect(services.settings.source_snapshot_path) as connection:
        rows = _matching_rows(connection, q, _safe_limit(limit, 50))
    return [_summary(row) for row in rows]


def _document_or_404(connection: sqlite3.Connection, document_id: str) -> sqlite3.Row:
    row = connection.execute("SELECT * FROM documents WHERE id = ?", (document_id,)).fetchone()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Документ не найден.")
    return row


def _fragment_page(
    connection: sqlite3.Connection,
    document_id: str,
    offset: int,
    limit: int,
) -> DocumentFragmentPage:
    total = connection.execute(
        "SELECT COUNT(*) AS total FROM fragments WHERE document_id = ?", (document_id,)
    ).fetchone()["total"]
    rows = connection.execute(
        "SELECT * FROM fragments WHERE document_id = ? ORDER BY ordinal LIMIT ? OFFSET ?",
        (document_id, _safe_limit(limit, DEFAULT_FRAGMENT_LIMIT), max(offset, 0)),
    ).fetchall()
    return DocumentFragmentPage(fragments=[_fragment(row) for row in rows], total=total)


@router.get("/documents/{document_id}", response_model=DocumentDetail)
def get_snapshot_document(
    document_id: str,
    limit: int = Query(default=DEFAULT_FRAGMENT_LIMIT, ge=1, le=MAX_LIMIT),
    services: AppServices = Depends(get_services),
) -> DocumentDetail:
    with _connect(services.settings.source_snapshot_path) as connection:
        row = _document_or_404(connection, document_id)
        page = _fragment_page(connection, document_id, offset=0, limit=limit)

    return DocumentDetail(
        **_summary(row).model_dump(),
        content=_snapshot_notice(row["article_count"]),
        fragments=page.fragments,
        fragments_total=page.total,
    )


@router.get("/documents/{document_id}/fragments", response_model=DocumentFragmentPage)
def get_snapshot_fragment_page(
    document_id: str,
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=DEFAULT_FRAGMENT_LIMIT, ge=1, le=MAX_LIMIT),
    services: AppServices = Depends(get_services),
) -> DocumentFragmentPage:
    with _connect(services.settings.source_snapshot_path) as connection:
        _document_or_404(connection, document_id)
        return _fragment_page(connection, document_id, offset=offset, limit=limit)
