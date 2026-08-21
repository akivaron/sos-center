import uuid


def _unique_email() -> str:
    return f"e2e_{uuid.uuid4().hex[:10]}@resq.test"


def _register(api_client, base_url, password="Sup3rSecret!"):
    email = _unique_email()
    response = api_client.post(
        f"{base_url}/api/auth/register",
        json={"email": email, "password": password, "name": "E2E User"},
    )
    assert response.status_code == 200
    return email, password, response.json()["session_token"]


def test_change_password_flow(api_client, base_url):
    email, password, token = _register(api_client, base_url)
    headers = {"Authorization": f"Bearer {token}"}

    bad = api_client.post(
        f"{base_url}/api/auth/change-password",
        json={"current_password": "wrong", "new_password": "NewSup3rSecret!"},
        headers=headers,
    )
    assert bad.status_code == 401

    ok = api_client.post(
        f"{base_url}/api/auth/change-password",
        json={"current_password": password, "new_password": "NewSup3rSecret!"},
        headers=headers,
    )
    assert ok.status_code == 200

    relogin = api_client.post(
        f"{base_url}/api/auth/login",
        json={"email": email, "password": "NewSup3rSecret!"},
    )
    assert relogin.status_code == 200


def test_set_pin_and_privacy(api_client, base_url):
    _, _, token = _register(api_client, base_url)
    headers = {"Authorization": f"Bearer {token}"}

    pin = api_client.post(f"{base_url}/api/auth/pin", json={"pin": "1234"}, headers=headers)
    assert pin.status_code == 200
    assert pin.json()["pin_set"] is True

    bad_pin = api_client.post(f"{base_url}/api/auth/pin", json={"pin": "12"}, headers=headers)
    assert bad_pin.status_code == 422

    privacy = api_client.get(f"{base_url}/api/auth/privacy", headers=headers)
    assert privacy.status_code == 200
    assert privacy.json()["hide_gps"] is False

    updated = api_client.patch(
        f"{base_url}/api/auth/privacy",
        json={"hide_gps": True, "hide_mesh": True},
        headers=headers,
    )
    assert updated.status_code == 200
    body = updated.json()
    assert body["hide_gps"] is True and body["hide_mesh"] is True


def test_delete_account_requires_password(api_client, base_url):
    email, password, token = _register(api_client, base_url)
    headers = {"Authorization": f"Bearer {token}"}

    wrong = api_client.request(
        "DELETE", f"{base_url}/api/auth/account",
        json={"password": "nope"}, headers=headers,
    )
    assert wrong.status_code == 401

    deleted = api_client.request(
        "DELETE", f"{base_url}/api/auth/account",
        json={"password": password}, headers=headers,
    )
    assert deleted.status_code == 200

    relogin = api_client.post(
        f"{base_url}/api/auth/login",
        json={"email": email, "password": password},
    )
    assert relogin.status_code == 401
