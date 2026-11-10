"""SQLite storage layer (local mode — no AWS needed).

The database file is chosen by the ``SMART_ATTENDANCE_DB`` environment
variable when set (tests use a temp file); otherwise it defaults to
``backend/smart_attendance.db`` next to this package.

Every query filters by ``user_id`` — callers must pass the id taken from
the verified JWT, never a value supplied by the client.
"""

import os
import sqlite3
from pathlib import Path

# Default location: backend/smart_attendance.db
_DEFAULT_DB = Path(__file__).resolve().parent.parent / "smart_attendance.db"


def get_db_path() -> Path:
    """Return the SQLite file path (env override wins, read on every call)."""
    override = os.environ.get("SMART_ATTENDANCE_DB")
    return Path(override) if override else _DEFAULT_DB


def get_connection() -> sqlite3.Connection:
    """Open a connection and make sure the tables exist."""
    conn = sqlite3.connect(str(get_db_path()))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    init_db(conn)
    return conn


def init_db(conn: sqlite3.Connection | None = None) -> None:
    """Create the users / subjects tables if they do not exist yet."""
    own = conn is None
    if own:
        conn = sqlite3.connect(str(get_db_path()))
    try:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                full_name TEXT NOT NULL,
                student_id TEXT NOT NULL UNIQUE,
                email TEXT NOT NULL UNIQUE,
                department TEXT NOT NULL DEFAULT '',
                year INTEGER NOT NULL DEFAULT 1,
                section TEXT NOT NULL DEFAULT '',
                password_hash TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS subjects (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                subject_name TEXT NOT NULL,
                total_classes INTEGER NOT NULL CHECK (total_classes > 0),
                attended INTEGER NOT NULL CHECK (attended >= 0),
                UNIQUE (user_id, subject_name)
            );
            """
        )
        conn.commit()
    finally:
        if own:
            conn.close()


# ---------------------------------------------------------------- users ---

def create_user(full_name, student_id, email, department, year, section,
                password_hash) -> dict:
    conn = get_connection()
    try:
        cur = conn.execute(
            "INSERT INTO users (full_name, student_id, email, department,"
            " year, section, password_hash) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (full_name, student_id, email, department, year, section,
             password_hash),
        )
        conn.commit()
        return get_user_by_id(cur.lastrowid)
    finally:
        conn.close()


def get_user_by_id(user_id: int) -> dict | None:
    conn = get_connection()
    try:
        row = conn.execute(
            "SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def get_user_by_email(email: str) -> dict | None:
    conn = get_connection()
    try:
        row = conn.execute(
            "SELECT * FROM users WHERE email = ?", (email,)).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def get_user_by_student_id(student_id: str) -> dict | None:
    conn = get_connection()
    try:
        row = conn.execute(
            "SELECT * FROM users WHERE student_id = ?",
            (student_id,)).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def update_user(user_id: int, full_name, department, year, section) -> dict:
    conn = get_connection()
    try:
        conn.execute(
            "UPDATE users SET full_name = ?, department = ?, year = ?,"
            " section = ? WHERE id = ?",
            (full_name, department, year, section, user_id),
        )
        conn.commit()
        return get_user_by_id(user_id)
    finally:
        conn.close()


# ------------------------------------------------------------- subjects ---

def _row_to_subject(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "user_id": row["user_id"],
        "subject_name": row["subject_name"],
        "total_classes": row["total_classes"],
        "attended": row["attended"],
    }


def upsert_subject(user_id: int, subject_name: str, total_classes: int,
                   attended: int) -> tuple[dict, bool]:
    """Insert or update a subject for a user.

    Returns (subject, created) — ``created`` is False when the subject
    already existed for this user and was updated instead.
    """
    subject_name = subject_name.strip()
    conn = get_connection()
    try:
        existing = conn.execute(
            "SELECT * FROM subjects WHERE user_id = ? AND subject_name = ?",
            (user_id, subject_name)).fetchone()
        if existing:
            conn.execute(
                "UPDATE subjects SET total_classes = ?, attended = ?"
                " WHERE id = ?",
                (total_classes, attended, existing["id"]))
            conn.commit()
            return _row_to_subject(conn.execute(
                "SELECT * FROM subjects WHERE id = ?",
                (existing["id"],)).fetchone()), False
        cur = conn.execute(
            "INSERT INTO subjects (user_id, subject_name, total_classes,"
            " attended) VALUES (?, ?, ?, ?)",
            (user_id, subject_name, total_classes, attended))
        conn.commit()
        return _row_to_subject(conn.execute(
            "SELECT * FROM subjects WHERE id = ?",
            (cur.lastrowid,)).fetchone()), True
    finally:
        conn.close()


def get_subjects(user_id: int) -> list[dict]:
    conn = get_connection()
    try:
        rows = conn.execute(
            "SELECT * FROM subjects WHERE user_id = ? ORDER BY subject_name",
            (user_id,)).fetchall()
        return [_row_to_subject(r) for r in rows]
    finally:
        conn.close()


def get_subject_by_id(subject_id: int, user_id: int) -> dict | None:
    """Fetch a subject only if it belongs to this user (else None -> 404)."""
    conn = get_connection()
    try:
        row = conn.execute(
            "SELECT * FROM subjects WHERE id = ? AND user_id = ?",
            (subject_id, user_id)).fetchone()
        return _row_to_subject(row) if row else None
    finally:
        conn.close()


def update_subject(subject_id: int, user_id: int, total_classes: int,
                   attended: int) -> dict | None:
    conn = get_connection()
    try:
        row = conn.execute(
            "SELECT * FROM subjects WHERE id = ? AND user_id = ?",
            (subject_id, user_id)).fetchone()
        if not row:
            return None
        conn.execute(
            "UPDATE subjects SET total_classes = ?, attended = ?"
            " WHERE id = ?",
            (total_classes, attended, subject_id))
        conn.commit()
        return _row_to_subject(conn.execute(
            "SELECT * FROM subjects WHERE id = ?", (subject_id,)).fetchone())
    finally:
        conn.close()


def delete_subject(subject_id: int, user_id: int) -> bool:
    conn = get_connection()
    try:
        cur = conn.execute(
            "DELETE FROM subjects WHERE id = ? AND user_id = ?",
            (subject_id, user_id))
        conn.commit()
        return cur.rowcount > 0
    finally:
        conn.close()
