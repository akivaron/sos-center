import time


# Module: public incident-media access control and headers
def test_public_incident_media_requires_attachment(api_client, base_url, auth_headers):
    upload = _upload_photo(api_client, base_url, auth_headers)
    response = api_client.get(f"{base_url}/api/incident-media/{upload['file_id']}")
    assert response.status_code == 404
    assert response.json().get("detail") == "Incident media not found"


def test_public_incident_media_rejects_nonexistent_file(api_client, base_url):
    response = api_client.get(f"{base_url}/api/incident-media/file_not_real_for_pytest")
    assert response.status_code == 404
    assert response.json().get("detail") == "Incident media not found"


def test_public_incident_media_serves_attached_file_without_auth(api_client, base_url, auth_headers):
    upload = _upload_photo(api_client, base_url, auth_headers)
    incident = _create_incident_with_photo(api_client, base_url, auth_headers, upload["file_id"])

    public_media = api_client.get(f"{base_url}/api/incident-media/{upload['file_id']}")
    assert public_media.status_code == 200
    assert public_media.headers.get("content-type", "").startswith("image/")
    assert public_media.headers.get("cache-control") == "public, max-age=300"
    assert len(public_media.content) > 0

    incidents = api_client.get(
        f"{base_url}/api/incidents",
        params={"longitude": incident["longitude"], "latitude": incident["latitude"], "radius_meters": 50000},
    )
    assert incidents.status_code == 200
    matched = next((item for item in incidents.json() if item.get("id") == incident["id"]), None)
    assert matched is not None
    assert matched.get("photo_url") == f"/api/incident-media/{upload['file_id']}"
    assert "storage_path" not in matched
    assert "_id" not in matched


# Module: incidents response field hygiene for attached media
def test_list_incidents_photo_url_is_relative(api_client, base_url, auth_headers):
    upload = _upload_photo(api_client, base_url, auth_headers)
    incident = _create_incident_with_photo(api_client, base_url, auth_headers, upload["file_id"])

    response = api_client.get(
        f"{base_url}/api/incidents",
        params={"longitude": incident["longitude"], "latitude": incident["latitude"], "radius_meters": 50000},
    )
    assert response.status_code == 200
    matched = next((item for item in response.json() if item.get("id") == incident["id"]), None)
    assert matched is not None
    assert isinstance(matched.get("photo_url"), str) and matched["photo_url"].startswith("/api/incident-media/")
    assert "http" not in matched["photo_url"]
    assert "storage_path" not in matched
    assert "_id" not in matched


def _upload_photo(api_client, base_url, auth_headers):
    files = {"file": ("incident.png", _tiny_png_bytes(), "image/png")}
    response = api_client.post(
        f"{base_url}/api/uploads/incident-photo", files=files, headers=auth_headers
    )
    assert response.status_code == 201
    return response.json()


def _create_incident_with_photo(api_client, base_url, auth_headers, file_id: str):
    payload = {
        "incident_type": "crash",
        "severity": "critical",
        "description": f"TEST_public_media_{int(time.time())}",
        "casualty_count": 4,
        "assistance_needed": "TEST_need fire truck and ambulance",
        "photo_file_id": file_id,
        "longitude": 106.8456,
        "latitude": -6.2088,
    }
    response = api_client.post(f"{base_url}/api/incidents", json=payload, headers=auth_headers)
    assert response.status_code == 201
    return response.json()


def _tiny_png_bytes() -> bytes:
    return (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
        b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\x0bIDATx\x9cc\x00\x01\x00"
        b"\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
    )