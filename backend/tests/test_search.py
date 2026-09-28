from fastapi.testclient import TestClient


def test_search_finds_the_expected_demo_card(client: TestClient) -> None:
    response = client.get("/api/v1/search", params={"q": "редакции"})

    assert response.status_code == 200
    body = response.json()
    assert body["query"] == "редакции"
    assert any(item["id"] == "demo-version-timeline" for item in body["results"])


def test_search_finds_all_core_code_cards_and_common_abbreviation(client: TestClient) -> None:
    codes_response = client.get("/api/v1/search", params={"q": "кодекс"})
    codes_plural_response = client.get("/api/v1/search", params={"q": "кодексы"})
    abbreviation_response = client.get("/api/v1/search", params={"q": "коап"})

    assert codes_response.status_code == 200
    code_results = codes_response.json()["results"]
    assert len([item for item in code_results if item["legal_level"] == "code"]) == 20
    assert all(item["content_state"] == "offline_metadata" for item in code_results)

    assert codes_plural_response.status_code == 200
    plural_results = codes_plural_response.json()["results"]
    assert len([item for item in plural_results if item["legal_level"] == "code"]) == 20

    assert abbreviation_response.status_code == 200
    assert [item["id"] for item in abbreviation_response.json()["results"]] == [
        "ru-administrative-offences-code"
    ]


def test_search_finds_primary_law_by_its_local_requisites(client: TestClient) -> None:
    response = client.get("/api/v1/search", params={"q": "152-ФЗ"})

    assert response.status_code == 200
    results = response.json()["results"]
    assert [item["id"] for item in results] == ["ru-federal-law-152-fz"]
    assert results[0]["content_state"] == "offline_metadata"
