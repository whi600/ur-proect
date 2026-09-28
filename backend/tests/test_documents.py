from fastapi.testclient import TestClient


def test_list_exposes_offline_catalogue_metadata_before_demo_documents(client: TestClient) -> None:
    response = client.get("/api/v1/documents")

    assert response.status_code == 200
    documents = response.json()
    assert len(documents) >= 35
    constitution = next(
        document for document in documents if document["id"] == "ru-constitution-source"
    )
    assert constitution["is_demo"] is False
    assert constitution["content_state"] == "offline_metadata"
    assert constitution["source_url"] is None
    codes = [document for document in documents if document["legal_level"] == "code"]
    assert len(codes) == 20
    assert all(document["content_state"] == "offline_metadata" for document in codes)
    assert any(document["content_state"] == "demo" for document in documents)


def test_document_detail_and_missing_document(client: TestClient) -> None:
    detail = client.get("/api/v1/documents/demo-source-checklist")
    missing = client.get("/api/v1/documents/no-such-document")

    assert detail.status_code == 200
    assert "ДЕМОНСТРАЦИОННЫЙ МАТЕРИАЛ" in detail.json()["content"]
    assert missing.status_code == 404


def test_offline_metadata_card_does_not_claim_full_legal_text(client: TestClient) -> None:
    response = client.get("/api/v1/documents/ru-constitution-source")

    assert response.status_code == 200
    body = response.json()
    assert body["content_state"] == "offline_metadata"
    assert body["source_url"] is None
    assert "Полный текст документа" in body["content"]
