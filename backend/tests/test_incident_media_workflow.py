import time

import pytest


# Module: multipart upload validation and metadata response
def test_upload_incident_photo_requires_auth(api_client, base_url):
    files = {"file": ("incident.png", _tiny_png_bytes(), "image/png")}
    response = api_client.post(f"{base_url}/api/uploads/incident-photo", files=files)
    assert response.status_code == 401


def test_upload_incident_photo_rejects_unsupported_format(api_client, base_url, auth_headers):
    files = {"file": ("incident.txt", b"TEST_TEXT", "text/plain")}
    response = api_client.post(
        f"{base_url}/api/uploads/incident-photo", files=files, headers=auth_headers
    )
    if response.status_code == 401:
        pytest.skip("QA token is not active in this environment")
    assert response.status_code == 415
    assert "Unsupported image format" in response.json().get("detail", "")


def test_upload_incident_photo_rejects_oversized_file(api_client, base_url, auth_headers):
    oversized = b"\x89PNG\r\n\x1a\n" + (b"0" * (5 * 1024 * 1024 + 2))
    files = {"file": ("oversized.png", oversized, "image/png")}
    response = api_client.post(
        f"{base_url}/api/uploads/incident-photo", files=files, headers=auth_headers
    )
    if response.status_code == 401:
        pytest.skip("QA token is not active in this environment")
    assert response.status_code == 413
    assert "Image exceeds 5 MB" in response.json().get("detail", "")


def test_upload_incident_photo_success_returns_file_metadata(api_client, base_url, auth_headers):
    files = {"file": ("incident.png", _tiny_png_bytes(), "image/png")}
    response = api_client.post(
        f"{base_url}/api/uploads/incident-photo", files=files, headers=auth_headers
    )
    if response.status_code == 401:
        pytest.skip("QA token is not active in this environment")
    assert response.status_code == 201
    data = response.json()
    assert data["file_id"].startswith("file_")
    assert data["file_url"].startswith("/api/files/")
    assert data["content_type"] == "image/png"
    assert isinstance(data["size"], int) and data["size"] > 0


# Module: protected file access and ownership/access guards
def test_download_file_requires_auth(api_client, base_url, auth_headers):
    upload = _upload_photo(api_client, base_url, auth_headers)
    response = api_client.get(f"{base_url}{upload['file_url']}")
    assert response.status_code == 401


def test_download_file_success_for_owner(api_client, base_url, auth_headers):
    upload = _upload_photo(api_client, base_url, auth_headers)
    response = api_client.get(f"{base_url}{upload['file_url']}", headers=auth_headers)
    assert response.status_code == 200
    assert response.headers.get("content-type", "").startswith("image/")
    assert len(response.content) > 0


def test_download_file_not_found_for_unknown_id(api_client, base_url, auth_headers):
    response = api_client.get(f"{base_url}/api/files/file_nonexistent_for_test", headers=auth_headers)
    if response.status_code == 401:
        pytest.skip("QA token is not active in this environment")
    assert response.status_code == 404


# Module: incident creation persists casualty/help/photo linkage fields
def test_create_incident_persists_media_and_fields(api_client, base_url, auth_headers):
    upload = _upload_photo(api_client, base_url, auth_headers)
    payload = {
        "incident_type": "other",
        "severity": "critical",
        "description": f"TEST_incident_media_{int(time.time())}",
        "casualty_count": 2,
        "assistance_needed": "TEST_need ambulance and water",
        "photo_file_id": upload["file_id"],
        "longitude": 106.8456,
        "latitude": -6.2088,
    }
    create_response = api_client.post(
        f"{base_url}/api/incidents", json=payload, headers=auth_headers
    )
    if create_response.status_code == 401:
        pytest.skip("QA token is not active in this environment")
    assert create_response.status_code == 201
    created = create_response.json()
    assert created["casualty_count"] == 2
    assert created["assistance_needed"] == payload["assistance_needed"]
    assert created["photo_file_id"] == upload["file_id"]

    list_response = api_client.get(
        f"{base_url}/api/incidents",
        params={"longitude": payload["longitude"], "latitude": payload["latitude"], "radius_meters": 50000},
    )
    assert list_response.status_code == 200
    items = list_response.json()
    matched = next((item for item in items if item.get("id") == created["id"]), None)
    assert matched is not None
    assert matched["casualty_count"] == 2
    assert matched["assistance_needed"] == payload["assistance_needed"]
    assert matched["photo_file_id"] == upload["file_id"]


def _upload_photo(api_client, base_url, auth_headers):
    files = {"file": ("incident.png", _tiny_png_bytes(), "image/png")}
    response = api_client.post(
        f"{base_url}/api/uploads/incident-photo", files=files, headers=auth_headers
    )
    if response.status_code == 401:
        pytest.skip("QA token is not active in this environment")
    assert response.status_code == 201
    return response.json()


def _tiny_png_bytes() -> bytes:
    # 1x1 transparent PNG
    return (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
        b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\x0bIDATx\x9cc\x00\x01\x00"
        b"\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
    )
