import time

import pytest


QA_TOKEN = "resq_qa_2026_e2e_7f3a91c4"


def auth_headers() -> dict[str, str]:
    """Auth headers for protected API feature checks."""
    return {"Authorization": f"Bearer {QA_TOKEN}"}


# Module: service readiness and public incidents listing
def test_root_ready(api_client, base_url):
    response = api_client.get(f"{base_url}/api/")
    assert response.status_code == 200
    data = response.json()
    assert data == {"service": "ResQ Map", "status": "ready"}


def test_public_incidents_list(api_client, base_url):
    response = api_client.get(f"{base_url}/api/incidents")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


# Module: auth guard and authenticated profile endpoint
def test_auth_me_requires_token(api_client, base_url):
    response = api_client.get(f"{base_url}/api/auth/me")
    assert response.status_code == 401
    assert response.json().get("detail") in {"Authentication required", "Invalid session", "Session expired"}


def test_auth_me_with_qa_token(api_client, base_url):
    response = api_client.get(f"{base_url}/api/auth/me", headers=auth_headers())
    if response.status_code == 401:
        pytest.skip("QA token is not active in this environment")
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "qa-resq@emergent.test"
    assert data["user_id"] == "user_resq_qa"


# Module: incident creation and persistence visibility
def test_create_incident_requires_auth(api_client, base_url):
    payload = {
        "incident_type": "fire",
        "severity": "high",
        "description": "TEST_unauthorized_incident",
        "longitude": 106.8456,
        "latitude": -6.2088,
    }
    response = api_client.post(f"{base_url}/api/incidents", json=payload)
    assert response.status_code == 401


def test_create_incident_and_verify_in_list(api_client, base_url):
    suffix = int(time.time())
    payload = {
        "incident_type": "flood",
        "severity": "high",
        "description": f"TEST_pytest_incident_{suffix}",
        "longitude": 106.8456,
        "latitude": -6.2088,
    }
    create_response = api_client.post(f"{base_url}/api/incidents", json=payload, headers=auth_headers())
    if create_response.status_code == 401:
        pytest.skip("QA token is not active in this environment")
    assert create_response.status_code == 201
    created = create_response.json()
    assert created["description"] == payload["description"]

    list_response = api_client.get(
        f"{base_url}/api/incidents",
        params={"longitude": payload["longitude"], "latitude": payload["latitude"], "radius_meters": 50000},
    )
    assert list_response.status_code == 200
    items = list_response.json()
    assert any(item.get("id") == created["id"] for item in items)


# Module: SOS idempotency and nearby alert radius endpoint
def test_sos_idempotency_client_event_id(api_client, base_url):
    event_id = f"test_sos_{int(time.time())}"
    payload = {
        "client_event_id": event_id,
        "longitude": 106.8456,
        "latitude": -6.2088,
        "message": "TEST_SOS_PYTEST",
        "network_state": "weak",
    }
    first = api_client.post(f"{base_url}/api/sos", json=payload, headers=auth_headers())
    if first.status_code == 401:
        pytest.skip("QA token is not active in this environment")
    assert first.status_code == 201
    first_data = first.json()

    second = api_client.post(f"{base_url}/api/sos", json=payload, headers=auth_headers())
    assert second.status_code == 201
    second_data = second.json()
    assert second_data["id"] == first_data["id"]


def test_nearby_alerts_radius(api_client, base_url):
    response = api_client.get(
        f"{base_url}/api/alerts/nearby",
        params={"longitude": 106.8456, "latitude": -6.2088, "radius_meters": 10000},
    )
    assert response.status_code == 200
    data = response.json()
    assert "incidents" in data and "sos_signals" in data
