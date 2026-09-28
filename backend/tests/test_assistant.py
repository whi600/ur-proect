from fastapi.testclient import TestClient


def test_assistant_is_unambiguously_demo_not_real_ai(client: TestClient) -> None:
    response = client.post("/api/v1/assistant/ask", json={"question": "Как проверить редакцию?"})

    assert response.status_code == 200
    body = response.json()
    assert body["mode"] == "demo"
    assert "Демонстрационный" in body["answer"]
    assert "не юридическая консультация" in body["disclaimer"]


def test_assistant_does_not_cite_unverified_source_metadata(client: TestClient) -> None:
    response = client.post("/api/v1/assistant/ask", json={"question": "Конституция"})

    assert response.status_code == 200
    body = response.json()
    assert body["sources"] == []
