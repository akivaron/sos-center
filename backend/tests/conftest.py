import os

import pytest
import requests
from dotenv import load_dotenv


load_dotenv("/app/frontend/.env")


def _read_qa_token() -> str | None:
    """Read QA bearer token from memory credentials file."""
    credentials_path = "/app/memory/test_credentials.md"
    try:
        with open(credentials_path, "r", encoding="utf-8") as handle:
            for line in handle:
                if line.strip().startswith("- Bearer token:"):
                    token = line.split("`")
                    if len(token) >= 2:
                        return token[1].strip()
    except FileNotFoundError:
        return None
    return None


@pytest.fixture(scope="session")
def base_url() -> str:
    """Shared base URL fixture sourced from environment only."""
    value = os.environ.get("EXPO_BACKEND_URL") or os.environ.get("EXPO_PUBLIC_BACKEND_URL")
    if not value:
        pytest.skip("Missing EXPO_BACKEND_URL/EXPO_PUBLIC_BACKEND_URL in environment")
    return value.rstrip("/")


@pytest.fixture()
def api_client() -> requests.Session:
    """Shared HTTP session for API tests."""
    session = requests.Session()
    session.headers.update({"Accept": "application/json"})
    return session


@pytest.fixture(scope="session")
def qa_token() -> str:
    """QA token fixture for protected endpoint tests."""
    token = _read_qa_token()
    if not token:
        pytest.skip("Missing QA bearer token in /app/memory/test_credentials.md")
    return token


@pytest.fixture(scope="session")
def auth_headers(qa_token: str) -> dict[str, str]:
    """Authorization header for protected endpoint tests."""
    return {"Authorization": f"Bearer {qa_token}"}
