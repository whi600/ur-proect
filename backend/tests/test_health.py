from fastapi.testclient import TestClient


def test_health_reports_demo_mode(client: TestClient) -> None:
    response = client.get("/api/v1/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "data_mode": "demo",
        "database": "not_used",
        "version": "0.1.0",
    }
