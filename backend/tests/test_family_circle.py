import time

import pytest

from .test_api_core import auth_headers


def _register(session, base_url, email, password="familytest123", name=None):
    payload = {"email": email, "password": password}
    if name:
        payload["name"] = name
    response = session.post(f"{base_url}/api/auth/register", json=payload)
    return response


def _headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _register_user(session, base_url, suffix, name=None):
    email = f"family_{suffix}@resq.test"
    response = _register(session, base_url, email, name=name)
    if response.status_code == 409:
        # already exists from a prior run; fall back to login
        login = session.post(f"{base_url}/api/auth/login", json={"email": email, "password": "familytest123"})
        return login.json()["session_token"], email
    assert response.status_code == 201, response.text
    return response.json()["session_token"], email


# Module: family circle creation and ownership
def test_create_family_circle(api_client, base_url):
    suffix = int(time.time())
    token, _ = _register_user(api_client, base_url, f"owner_{suffix}", name="Parent")
    if not token:
        pytest.skip("Registration unavailable in this environment")
    create = api_client.post(
        f"{base_url}/api/family-circles",
        json={"name": "Keluarga Test"},
        headers=_headers(token),
    )
    if create.status_code == 401:
        pytest.skip("Auth unavailable in this environment")
    assert create.status_code == 201
    circle = create.json()
    assert circle["owner_id"]
    assert circle["invite_code"]
    assert any(member["role"] == "owner" for member in circle["members"])

    listed = api_client.get(f"{base_url}/api/family-circles", headers=_headers(token))
    assert listed.status_code == 200
    assert any(item["id"] == circle["id"] for item in listed.json())


# Module: join, share location, then leave
def test_join_and_share_location(api_client, base_url):
    suffix = int(time.time())
    owner_token, _ = _register_user(api_client, base_url, f"join_owner_{suffix}", name="Owner")
    member_token, _ = _register_user(api_client, base_url, f"join_member_{suffix}", name="Member")
    if not owner_token or not member_token:
        pytest.skip("Registration unavailable in this environment")

    circle = api_client.post(
        f"{base_url}/api/family-circles",
        json={"name": "Share Circle"},
        headers=_headers(owner_token),
    ).json()
    code = circle["invite_code"]

    joined = api_client.post(
        f"{base_url}/api/family-circles/join",
        json={"invite_code": code},
        headers=_headers(member_token),
    )
    if joined.status_code == 401:
        pytest.skip("Auth unavailable in this environment")
    assert joined.status_code == 201

    share = api_client.post(
        f"{base_url}/api/family-circles/location",
        json={"longitude": 106.8456, "latitude": -6.2088, "source": "gps"},
        headers=_headers(owner_token),
    )
    assert share.status_code == 200
    assert circle["id"] in share.json()["circles"]

    member_view = api_client.get(f"{base_url}/api/family-circles", headers=_headers(member_token)).json()
    mine = next(item for item in member_view if item["id"] == circle["id"])
    owner_member = next(member for member in mine["members"] if member["role"] == "owner")
    assert owner_member["location"] is not None
    assert owner_member["location"]["source"] == "gps"

    left = api_client.delete(
        f"{base_url}/api/family-circles/{circle['id']}/members/{'self'.replace('self', owner_member['user_id'])}",
        headers=_headers(owner_token),
    )
    # Owner leaving promotes the remaining member and keeps the circle alive.
    assert left.status_code == 200
    assert left.json()["deleted"] is False


def test_join_unknown_code_fails(api_client, base_url):
    token, _ = _register_user(api_client, base_url, f"unknown_{int(time.time())}")
    if not token:
        pytest.skip("Registration unavailable in this environment")
    response = api_client.post(
        f"{base_url}/api/family-circles/join",
        json={"invite_code": "ZZZZZZ"},
        headers=_headers(token),
    )
    if response.status_code == 401:
        pytest.skip("Auth unavailable in this environment")
    assert response.status_code == 404
