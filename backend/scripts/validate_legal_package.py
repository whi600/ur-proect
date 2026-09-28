"""Validate a locally prepared package of reviewed legal-text fragments.

This tool deliberately does not fetch, scrape, or copy any legal text.  It is
the gate before a future ingestion step: a package must already have been
assembled from an approved source and reviewed by a person who can confirm the
edition.

Example manifest shape (files are relative to the manifest directory)::

    {
      "schema_version": 1,
      "package_id": "ru-core-texts",
      "package_version": "2026.09.26",
      "built_at": "2026-09-26T12:00:00Z",
      "content_scope": "verified_text",
      "documents": [
        {
          "id": "ru-example",
          "title": "Example only",
          "source_name": "Approved source",
          "source_url": "https://example.invalid/document/1",
          "source_checked_at": "2026-09-26",
          "revision_label": "Edition as of 2026-09-26",
          "revision_date": "2026-09-26",
          "text_sha256": "<sha256 of ordered fragment checksums>",
          "fragments": [
            {
              "ordinal": 1,
              "kind": "article",
              "source_fragment_ref": "Article 1",
              "heading": "Article 1",
              "path": "texts/ru-example/0001.txt",
              "sha256": "<sha256 of the raw UTF-8 file bytes>",
              "revision_date": "2026-09-26"
            }
          ]
        }
      ]
    }

The document-level ``text_sha256`` is SHA-256 of the concatenated binary
fragment SHA-256 values, ordered by ``ordinal``.  This avoids silently changing
fragment order while still keeping each fragment independently checkable.

Structural validation and checksums do not prove that a legal edition is
current, complete, authorised for use, or legally correct.  Those conclusions
require source governance and legal review outside this script.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
import tempfile
from datetime import date, datetime
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

SCHEMA_VERSION = 1
SHA256_RE = re.compile(r"^[0-9a-f]{64}$")
ALLOWED_FRAGMENT_KINDS = {
    "preamble",
    "section",
    "chapter",
    "article",
    "paragraph",
    "appendix",
}


class PackageValidationError(ValueError):
    """Raised when a candidate legal-text package is incomplete or inconsistent."""


def ensure_object(value: Any, context: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise PackageValidationError(f"{context} must be a JSON object.")
    return value


def require_text(record: dict[str, Any], key: str, context: str) -> str:
    value = record.get(key)
    if not isinstance(value, str) or not value.strip():
        raise PackageValidationError(f"{context}: '{key}' must be a non-empty string.")
    return value.strip()


def require_sha256(value: Any, context: str) -> str:
    if not isinstance(value, str) or not SHA256_RE.fullmatch(value):
        raise PackageValidationError(f"{context}: expected a lowercase SHA-256 hexadecimal digest.")
    return value


def require_date(value: Any, context: str) -> str:
    if not isinstance(value, str):
        raise PackageValidationError(f"{context}: expected date in YYYY-MM-DD format.")
    try:
        date.fromisoformat(value)
    except ValueError as error:
        raise PackageValidationError(f"{context}: expected date in YYYY-MM-DD format.") from error
    return value


def require_timestamp(value: Any, context: str) -> str:
    if not isinstance(value, str) or not value:
        raise PackageValidationError(f"{context}: expected an ISO-8601 timestamp.")
    normalized = value[:-1] + "+00:00" if value.endswith("Z") else value
    if "T" not in normalized:
        raise PackageValidationError(f"{context}: expected an ISO-8601 timestamp.")
    try:
        datetime.fromisoformat(normalized)
    except ValueError as error:
        raise PackageValidationError(f"{context}: expected an ISO-8601 timestamp.") from error
    return value


def require_https_url(value: Any, context: str) -> str:
    if not isinstance(value, str):
        raise PackageValidationError(f"{context}: source_url must be an HTTPS URL.")
    parsed = urlparse(value)
    if parsed.scheme != "https" or not parsed.netloc:
        raise PackageValidationError(f"{context}: source_url must be an HTTPS URL.")
    return value


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def document_checksum(fragment_checksums: list[str]) -> str:
    """Return the stable checksum of ordered fragment checksum bytes."""

    digest = hashlib.sha256()
    for checksum in fragment_checksums:
        digest.update(bytes.fromhex(checksum))
    return digest.hexdigest()


def resolve_fragment_path(package_root: Path, relative_path: str, context: str) -> Path:
    candidate = Path(relative_path)
    if candidate.is_absolute():
        raise PackageValidationError(f"{context}: fragment path must be relative.")
    resolved = (package_root / candidate).resolve()
    try:
        resolved.relative_to(package_root.resolve())
    except ValueError as error:
        raise PackageValidationError(
            f"{context}: fragment path escapes the package directory."
        ) from error
    return resolved


def load_manifest(manifest_path: Path) -> dict[str, Any]:
    try:
        with manifest_path.open("r", encoding="utf-8") as manifest_file:
            value = json.load(manifest_file)
    except OSError as error:
        raise PackageValidationError(f"Cannot read manifest: {error}") from error
    except json.JSONDecodeError as error:
        raise PackageValidationError(f"Manifest is not valid JSON: {error}") from error
    return ensure_object(value, "Manifest")


def validate_fragment(
    fragment: Any,
    package_root: Path,
    document_id: str,
    seen_paths: set[Path],
) -> tuple[int, str]:
    context = f"Document '{document_id}', fragment"
    record = ensure_object(fragment, context)

    ordinal = record.get("ordinal")
    if not isinstance(ordinal, int) or isinstance(ordinal, bool) or ordinal < 1:
        raise PackageValidationError(f"{context}: 'ordinal' must be a positive integer.")
    kind = require_text(record, "kind", context)
    if kind not in ALLOWED_FRAGMENT_KINDS:
        allowed = ", ".join(sorted(ALLOWED_FRAGMENT_KINDS))
        raise PackageValidationError(f"{context}: 'kind' must be one of: {allowed}.")
    require_text(record, "source_fragment_ref", context)
    require_text(record, "heading", context)
    path_value = require_text(record, "path", context)
    expected_checksum = require_sha256(record.get("sha256"), context)
    require_date(record.get("revision_date"), context)

    fragment_path = resolve_fragment_path(package_root, path_value, context)
    if fragment_path in seen_paths:
        raise PackageValidationError(f"{context}: a text file may be used by only one fragment.")
    seen_paths.add(fragment_path)
    if not fragment_path.is_file():
        raise PackageValidationError(f"{context}: text file does not exist: {path_value}")

    try:
        raw_text = fragment_path.read_bytes()
        decoded_text = raw_text.decode("utf-8")
    except UnicodeDecodeError as error:
        raise PackageValidationError(
            f"{context}: text file must be UTF-8 encoded: {path_value}"
        ) from error
    except OSError as error:
        raise PackageValidationError(f"{context}: cannot read text file: {path_value}") from error
    if not decoded_text.strip():
        raise PackageValidationError(f"{context}: text file must not be empty: {path_value}")
    actual_checksum = sha256_bytes(raw_text)
    if actual_checksum != expected_checksum:
        raise PackageValidationError(
            f"{context}: SHA-256 mismatch for {path_value}; "
            f"expected {expected_checksum}, got {actual_checksum}."
        )
    return ordinal, actual_checksum


def validate_document(document: Any, package_root: Path, seen_paths: set[Path]) -> int:
    record = ensure_object(document, "Document")
    document_id = require_text(record, "id", "Document")
    context = f"Document '{document_id}'"
    for key in ("title", "source_name", "revision_label"):
        require_text(record, key, context)
    require_https_url(record.get("source_url"), context)
    require_date(record.get("source_checked_at"), context)
    revision_date = require_date(record.get("revision_date"), context)
    expected_text_checksum = require_sha256(record.get("text_sha256"), context)

    fragments = record.get("fragments")
    if not isinstance(fragments, list) or not fragments:
        raise PackageValidationError(f"{context}: 'fragments' must be a non-empty list.")

    checksums_by_ordinal: dict[int, str] = {}
    for fragment in fragments:
        ordinal, checksum = validate_fragment(fragment, package_root, document_id, seen_paths)
        if ordinal in checksums_by_ordinal:
            raise PackageValidationError(f"{context}: duplicate fragment ordinal {ordinal}.")
        checksums_by_ordinal[ordinal] = checksum

    ordered_ordinals = sorted(checksums_by_ordinal)
    if ordered_ordinals != list(range(1, len(ordered_ordinals) + 1)):
        raise PackageValidationError(
            f"{context}: fragment ordinals must be consecutive, starting at 1."
        )
    actual_text_checksum = document_checksum(
        [checksums_by_ordinal[index] for index in ordered_ordinals]
    )
    if actual_text_checksum != expected_text_checksum:
        raise PackageValidationError(
            f"{context}: text_sha256 does not match ordered fragment checksums; "
            f"expected {expected_text_checksum}, got {actual_text_checksum}."
        )

    for fragment in fragments:
        fragment_record = ensure_object(fragment, context)
        if fragment_record["revision_date"] != revision_date:
            raise PackageValidationError(
                f"{context}: every fragment revision_date must equal the document revision_date."
            )
    return len(fragments)


def validate_package(manifest_path: Path) -> tuple[int, int, str]:
    """Validate a package and return document count, fragment count, and package digest."""

    manifest = load_manifest(manifest_path)
    context = "Manifest"
    schema_version = manifest.get("schema_version")
    if schema_version != SCHEMA_VERSION:
        raise PackageValidationError(f"{context}: unsupported schema_version {schema_version!r}.")
    require_text(manifest, "package_id", context)
    require_text(manifest, "package_version", context)
    require_timestamp(manifest.get("built_at"), context)
    if manifest.get("content_scope") != "verified_text":
        raise PackageValidationError(f"{context}: content_scope must be 'verified_text'.")

    documents = manifest.get("documents")
    if not isinstance(documents, list) or not documents:
        raise PackageValidationError(f"{context}: 'documents' must be a non-empty list.")

    package_root = manifest_path.resolve().parent
    seen_document_ids: set[str] = set()
    seen_paths: set[Path] = set()
    fragment_count = 0
    for document in documents:
        record = ensure_object(document, "Document")
        document_id = require_text(record, "id", "Document")
        if document_id in seen_document_ids:
            raise PackageValidationError(f"Manifest: duplicate document id '{document_id}'.")
        seen_document_ids.add(document_id)
        fragment_count += validate_document(record, package_root, seen_paths)

    # This deterministic summary digest can be stored with a release record.
    # It does not replace the per-file checksum checks above.
    package_digest_input = json.dumps(
        manifest, ensure_ascii=False, sort_keys=True, separators=(",", ":")
    )
    package_digest = sha256_bytes(package_digest_input.encode("utf-8"))
    return len(documents), fragment_count, package_digest


def run_self_test() -> None:
    """Exercise a valid fixture and checksum failure without storing any legal text."""

    with tempfile.TemporaryDirectory(prefix="legal-package-check-") as directory:
        root = Path(directory)
        text_path = root / "texts" / "example.txt"
        text_path.parent.mkdir()
        text_bytes = b"Demonstration fragment, not legal text.\n"
        text_path.write_bytes(text_bytes)
        fragment_checksum = sha256_bytes(text_bytes)
        manifest = {
            "schema_version": SCHEMA_VERSION,
            "package_id": "self-test",
            "package_version": "1",
            "built_at": "2026-09-26T00:00:00Z",
            "content_scope": "verified_text",
            "documents": [
                {
                    "id": "example",
                    "title": "Demonstration only",
                    "source_name": "Example source",
                    "source_url": "https://example.invalid/document/1",
                    "source_checked_at": "2026-09-26",
                    "revision_label": "Example edition",
                    "revision_date": "2026-09-26",
                    "text_sha256": document_checksum([fragment_checksum]),
                    "fragments": [
                        {
                            "ordinal": 1,
                            "kind": "article",
                            "source_fragment_ref": "Example 1",
                            "heading": "Example",
                            "path": "texts/example.txt",
                            "sha256": fragment_checksum,
                            "revision_date": "2026-09-26",
                        }
                    ],
                }
            ],
        }
        manifest_path = root / "manifest.json"
        manifest_path.write_text(json.dumps(manifest, ensure_ascii=False), encoding="utf-8")
        validate_package(manifest_path)

        manifest["documents"][0]["fragments"][0]["sha256"] = "0" * 64
        manifest_path.write_text(json.dumps(manifest, ensure_ascii=False), encoding="utf-8")
        try:
            validate_package(manifest_path)
        except PackageValidationError:
            return
        raise AssertionError("Self-test did not detect a checksum mismatch.")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Validate a locally assembled, reviewed legal-text package without downloads."
    )
    parser.add_argument(
        "manifest",
        nargs="?",
        type=Path,
        help="Path to the package manifest JSON file.",
    )
    parser.add_argument(
        "--self-test",
        action="store_true",
        help="Run an isolated structural and checksum test using synthetic text.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.self_test:
        run_self_test()
        print("OK: self-test passed (synthetic text only).")
        return 0
    if args.manifest is None:
        print("Provide a manifest path or use --self-test.", file=sys.stderr)
        return 2
    try:
        documents, fragments, package_digest = validate_package(args.manifest)
    except PackageValidationError as error:
        print(f"Invalid legal-text package: {error}", file=sys.stderr)
        return 1
    print(
        f"OK: {args.manifest} — documents={documents}, fragments={fragments}, "
        f"manifest_sha256={package_digest}"
    )
    print("Note: this checks package integrity only; a legal review must confirm the edition.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
