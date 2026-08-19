import os

import pytest
import requests
from dotenv import load_dotenv


load_dotenv("/app/frontend/.env")


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
    session.headers.update({"Content-Type": "application/json"})
    return session
