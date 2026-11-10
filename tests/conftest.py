"""Shared test setup.

- Puts the project root (and backend/) on sys.path so tests can
  ``import backend.app.*``.
- Points SMART_ATTENDANCE_DB at a temp file *before* importing the app,
  so tests never touch the real backend/smart_attendance.db.
- Provides a TestClient and a helper that registers a fresh user.
"""

import os
import sys
import uuid
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))
sys.path.insert(0, str(PROJECT_ROOT / "backend"))

os.environ["SMART_ATTENDANCE_DB"] = str(
    Path(__file__).resolve().parent / ".test-tmp.db")
# Tests must not depend on any trained model.
os.environ.setdefault("JWT_SECRET", "test-secret")

from backend.app.main import app  # noqa: E402


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:
        yield c


def _unique(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}"


@pytest.fixture()
def make_user(client):
    """Factory: register a fresh user, return (headers, user_dict)."""
    def _make():
        tag = _unique("u")
        payload = {
            "full_name": f"Test {tag}",
            "student_id": f"SID-{tag}",
            "email": f"{tag}@example.com",
            "department": "AI & DS",
            "year": 3,
            "section": "A",
            "password": "password123",
        }
        r = client.post("/api/auth/register", json=payload)
        assert r.status_code == 201, r.text
        body = r.json()
        return ({"Authorization": f"Bearer {body['access_token']}"},
                body["user"])
    return _make


@pytest.fixture(autouse=True)
def _clean_db_file():
    """Remove the temp DB between test modules is overkill; the file is
    recreated per session and users are unique per test, so isolation
    comes from fresh users. This fixture just guarantees the DB exists."""
    from backend.app import database
    database.init_db()
    yield
