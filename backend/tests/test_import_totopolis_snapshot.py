from __future__ import annotations

import importlib.util
import json
import sqlite3
import sys
from pathlib import Path
from types import ModuleType

import pytest

SCRIPT_PATH = Path(__file__).resolve().parents[1] / "scripts" / "import_totopolis_snapshot.py"


def load_importer() -> ModuleType:
    spec = importlib.util.spec_from_file_location("totopolis_snapshot_importer", SCRIPT_PATH)
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False), encoding="utf-8")


def make_source_fixture(tmp_path: Path) -> tuple[Path, Path]:
    source_root = tmp_path / "source"
    write_json(
        source_root / "data" / "index.json",
        {
            "codes": [
                {
                    "slug": "sample-law",
                    "kind": "fz",
                    "code": "Демонстрационный закон",
                    "act": "Федеральный закон от 01.01.2026 № 123-ФЗ",
                    "articles": 1,
                    "redaction_date": "2026-09-01",
                    "dir": "fz/sample-law/",
                }
            ]
        },
    )
    write_json(
        source_root / "data" / "fz" / "sample-law" / "index.json",
        {
            "slug": "sample-law",
            "code": "Демонстрационный закон",
            "act_number": "123-ФЗ",
            "act_date": "2026-01-01",
            "redaction_date": "2026-09-01",
            "source_url": "http://actual.pravo.gov.ru/example",
            "preamble": ["РОССИЙСКАЯ ФЕДЕРАЦИЯ"],
            "content": [],
            "closing": ["Президент Российской Федерации"],
            "structure": [
                {
                    "unit": "раздел",
                    "heading": "Раздел I. ОСНОВЫ",
                    "children": [
                        {
                            "unit": "статья",
                            "number": "1",
                            "title": "Основы",
                            "file": "st-001.json",
                        }
                    ],
                }
            ],
        },
    )
    write_json(
        source_root / "data" / "fz" / "sample-law" / "st-001.json",
        {
            "code_slug": "sample-law",
            "number": "1",
            "heading": "Статья 1. Основы",
            "status": "действует",
            "path": ["Раздел I. ОСНОВЫ"],
            "content": [
                {"text": "1. Гражданин имеет демонстрационное право."},
                {"content": [{"text": "2. Порядок определяется законом."}]},
            ],
        },
    )
    allowlist_path = tmp_path / "allowlist.json"
    write_json(
        allowlist_path,
        {
            "schema_version": 1,
            "snapshot": {
                "id": "sample-snapshot",
                "repository": "https://github.com/example/sample",
                "commit": "a" * 40,
                "snapshot_date": "2026-09-25",
                "license": "BSD-2-Clause",
            },
            "documents": [
                {
                    "id": "sample-law",
                    "upstream_slug": "sample-law",
                    "document_type": "Федеральный закон",
                    "legal_level": "federal_law",
                    "category": "Федеральные законы",
                    "search_terms": ["демонстрация", "гражданин"],
                }
            ],
        },
    )
    return source_root, allowlist_path


def test_builds_unreviewed_source_snapshot_with_article_fts(tmp_path: Path) -> None:
    importer = load_importer()
    source_root, allowlist_path = make_source_fixture(tmp_path)
    output_path = tmp_path / "snapshot.db"

    result = importer.build_snapshot(
        source_root,
        allowlist_path,
        output_path,
        built_at="2026-09-26T00:00:00+00:00",
    )

    assert result.documents == 1
    assert result.articles == 1
    assert result.fragments == 3
    assert len(result.package_sha256) == 64
    connection = sqlite3.connect(output_path)
    try:
        document = connection.execute(
            "SELECT content_state, source_checked_at, source_url, claimed_official_source_url "
            "FROM documents"
        ).fetchone()
        assert document == (
            "source_snapshot",
            None,
            "https://github.com/example/sample/blob/" + "a" * 40 + "/data/fz/sample-law/index.json",
            "http://actual.pravo.gov.ru/example",
        )
        body = connection.execute(
            "SELECT body FROM fragments WHERE fragment_kind = 'article'"
        ).fetchone()[0]
        assert "Гражданин имеет демонстрационное право" in body
        assert "Порядок определяется законом" in body
        hits = connection.execute(
            "SELECT document_id FROM fragment_fts WHERE fragment_fts MATCH 'гражданин'"
        ).fetchall()
        assert hits == [("sample-law",)]
    finally:
        connection.close()


def test_rejects_an_article_count_that_disagrees_with_the_source_tree(tmp_path: Path) -> None:
    importer = load_importer()
    source_root, allowlist_path = make_source_fixture(tmp_path)
    source_index_path = source_root / "data" / "index.json"
    source_index = json.loads(source_index_path.read_text(encoding="utf-8"))
    source_index["codes"][0]["articles"] = 2
    write_json(source_index_path, source_index)

    with pytest.raises(importer.SnapshotImportError, match="declares 2"):
        importer.build_snapshot(source_root, allowlist_path, tmp_path / "snapshot.db")


def test_refuses_to_place_an_unreviewed_snapshot_in_the_mobile_bundle() -> None:
    importer = load_importer()
    mobile_output = importer.PROJECT_ROOT / "mobile" / "assets" / "legal" / "candidate.db"

    with pytest.raises(importer.SnapshotImportError, match="Refusing to write"):
        importer.package_output_path(mobile_output, allow_mobile_asset=False)
