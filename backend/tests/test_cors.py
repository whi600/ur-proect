from fastapi.testclient import TestClient


def test_web_preview_preflight_is_limited_to_localhost(client: TestClient) -> None:
    response = client.options(
        "/api/v1/assistant/ask",
        headers={
            "Origin": "http://localhost:8081",
            "Access-Control-Request-Method": "POST",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:8081"
