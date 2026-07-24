import uuid

import httpx
import pytest
from fastapi.testclient import TestClient

from db.client import get_db
from main import app


@pytest.fixture(scope="session")
def client():
    db = get_db()
    try:
        db.client.admin.command("ping")
    except Exception as exc:
        pytest.skip(f"MongoDB Atlas not reachable, skipping integration tests: {exc}")

    with TestClient(app) as test_client:
        yield test_client


LOCAL_STORE_BASE = "http://localhost:8090"


@pytest.fixture(scope="module")
def require_leafy_local_store():
    """Skip a module wholesale when the on-device store isn't running."""
    try:
        httpx.get(f"{LOCAL_STORE_BASE}/local/v1/health", timeout=2.0).raise_for_status()
    except httpx.HTTPError as exc:
        pytest.skip(f"leafy-local-store not reachable at {LOCAL_STORE_BASE}: {exc}")


def unique(prefix):
    """A collision-proof identifier, so reruns never trip over leftover rows."""
    return f"{prefix}-{uuid.uuid4()}"
