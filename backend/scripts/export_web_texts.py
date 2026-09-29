"""Export the pinned local SQLite snapshot as lazy-loaded PWA text pages.

This is a mechanical export, not a legal review. The source database is local
and ignored by Git; only the bounded JSON pages and manifest are published.
"""

from __future__ import annotations

import argparse
import json
import sqlite3
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "mobile/assets/legal/ru-core-snapshot-2026-09-25.db"
MANIFEST = ROOT / "mobile/src/data/ru-web-texts-manifest.json"
PAGE_SIZE = 24
VERSION = "totopolis-2026-09-25-v1"
PAGES = ROOT / "mobile/public/legal-texts" / VERSION


def encode(value: object) -> bytes:
    return (json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n").encode("utf-8")


def summary(row: sqlite3.Row) -> dict[str, object]:
    keys = (
        "id", "title", "document_type", "source_name", "source_url",
        "document_number", "published_at", "revision_label", "effective_from",
        "effective_to", "jurisdiction", "legal_level", "content_state",
        "source_checked_at",
    )
    result = {key: row[key] for key in keys}
    result["is_demo"] = bool(row["is_demo"])
    return result


def fragment(row: sqlite3.Row) -> dict[str, object]:
    return {
        "id": row["id"],
        "ordinal": row["ordinal"],
        "kind": row["fragment_kind"],
        "label": row["article_label"],
        "heading": row["heading"],
        "body": row["body"],
        "legal_status": row["legal_status"],
        "revision_label": row["revision_label"],
        "valid_from": row["valid_from"],
        "valid_to": row["valid_to"],
    }


def write_or_check(path: Path, data: bytes, check: bool) -> None:
    if check:
        if not path.is_file() or path.read_bytes() != data:
            raise SystemExit(f"Missing or stale export: {path}")
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)


def export(check: bool) -> None:
    if not SOURCE.is_file():
        raise SystemExit(f"Local source snapshot not found: {SOURCE}")
    with sqlite3.connect(f"file:{SOURCE.as_posix()}?mode=ro", uri=True) as db:
        db.row_factory = sqlite3.Row
        documents = db.execute("SELECT * FROM documents ORDER BY category, title").fetchall()
        if len(documents) != 37:
            raise SystemExit(f"Expected 37 source documents, found {len(documents)}")
        manifest_documents: list[dict[str, object]] = []
        expected_pages: set[Path] = set()
        total_fragments = 0
        for document in documents:
            if document["content_state"] != "source_snapshot":
                raise SystemExit(f"Unexpected text status: {document['id']}")
            doc_id = document["id"]
            if not isinstance(doc_id, str) or not doc_id.startswith("ru-") or not all(
                character.isalnum() or character in "-_" for character in doc_id
            ):
                raise SystemExit(f"Unsafe document ID: {doc_id}")
            rows = db.execute(
                "SELECT * FROM fragments WHERE document_id = ? ORDER BY ordinal", (doc_id,)
            ).fetchall()
            total_fragments += len(rows)
            card = summary(document)
            card["fragments_total"] = len(rows)
            card["page_count"] = (len(rows) + PAGE_SIZE - 1) // PAGE_SIZE
            manifest_documents.append(card)
            for page_number in range(card["page_count"]):
                page = rows[page_number * PAGE_SIZE : (page_number + 1) * PAGE_SIZE]
                path = PAGES / doc_id / f"{page_number}.json"
                expected_pages.add(path)
                write_or_check(
                    path,
                    encode({"version": VERSION, "document_id": doc_id,
                            "offset": page_number * PAGE_SIZE, "total": len(rows),
                            "fragments": [fragment(row) for row in page]}),
                    check,
                )
        manifest = {"version": VERSION, "page_size": PAGE_SIZE,
                    "documents": manifest_documents}
        write_or_check(MANIFEST, encode(manifest), check)
        existing_pages = set(PAGES.glob("*/*.json"))
        stale = existing_pages - expected_pages
        if stale:
            raise SystemExit(f"Stale pages must be removed manually: {len(stale)}")
        print(f"{'Checked' if check else 'Exported'} {len(documents)} documents, "
              f"{total_fragments} fragments, {len(expected_pages)} lazy pages")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="Verify without writing")
    export(parser.parse_args().check)
