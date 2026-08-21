import uuid


def _unique_email() -> str:
    return f"e2e_{uuid.uuid4().hex[:10]}@resq.test"


def test_register_creates_session(api_client, base_url):
    email = _unique_email()
    password = "Sup3rSecret!"
    response = api_client.post(
        f"{base_url}/api/auth/register",
        json={"email": email, "password": password, "name": "E2E User"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["session_token"]
    assert data["user"]["email"] == email


def test_login_with_password(api_client, base_url):
    email = _unique_email()
    password = "Sup3rSecret!"
    api_client.post(
        f"{base_url}/api/auth/register",
        json={"email": email, "password": password},
    )
    response = api_client.post(
        f"{base_url}/api/auth/login",
        json={"email": email, "password": password},
    )
    assert response.status_code == 200
    assert response.json()["session_token"]


def test_login_wrong_password_rejected(api_client, base_url):
    email = _unique_email()
    api_client.post(
        f"{base_url}/api/auth/register",
        json={"email": email, "password": "Sup3rSecret!"},
    )
    response = api_client.post(
        f"{base_url}/api/auth/login",
        json={"email": email, "password": "wrong-password"},
    )
    assert response.status_code == 401


def test_register_duplicate_email_conflict(api_client, base_url):
    email = _unique_email()
    payload = {"email": email, "password": "Sup3rSecret!"}
    first = api_client.post(f"{base_url}/api/auth/register", json=payload)
    assert first.status_code == 200
    second = api_client.post(f"{base_url}/api/auth/register", json=payload)
    assert second.status_code == 409
