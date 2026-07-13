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
