"""Auth + per-user isolation tests.

Two users must never see each other's data: user B reading, updating or
deleting user A's subject gets 404, and B's summary contains none of
A's subjects.
"""


def test_register_and_login(client, make_user):
    headers, user = make_user()
    assert user["email"].endswith("@example.com")
    # Login with the same credentials works.
    r = client.post("/api/auth/login", json={
        "email": user["email"], "password": "password123"})
    assert r.status_code == 200, r.text
    assert r.json()["token_type"] == "bearer"
    assert r.json()["user"]["id"] == user["id"]


def test_register_duplicate_email_and_student_id(client, make_user):
    headers, user = make_user()
    # Same email, different student id -> 400.
    r = client.post("/api/auth/register", json={
        "full_name": "Copy", "student_id": "SID-OTHER-1",
        "email": user["email"], "department": "AI & DS", "year": 3,
        "section": "A", "password": "password123"})
    assert r.status_code == 400
    # Same student id, different email -> 400.
    r = client.post("/api/auth/register", json={
        "full_name": "Copy", "student_id": user["student_id"],
        "email": "other-unique@example.com", "department": "AI & DS",
        "year": 3, "section": "A", "password": "password123"})
    assert r.status_code == 400


def test_login_wrong_password_is_401(client, make_user):
    _, user = make_user()
    r = client.post("/api/auth/login", json={
        "email": user["email"], "password": "wrong-password"})
    assert r.status_code == 401


def test_forgot_password_is_generic(client, make_user):
    # Existing email and non-existing email get the same response.
    _, user = make_user()
    r1 = client.post("/api/auth/forgot-password",
                     json={"email": user["email"]})
    r2 = client.post("/api/auth/forgot-password",
                     json={"email": "nobody-here@example.com"})
    assert r1.status_code == 200 and r2.status_code == 200
    assert r1.json() == r2.json()
    assert "message" in r1.json()


def test_me_get_and_put(client, make_user):
    headers, user = make_user()
    r = client.get("/api/auth/me", headers=headers)
    assert r.status_code == 200
    assert r.json()["full_name"] == user["full_name"]
    r = client.put("/api/auth/me", headers=headers, json={
        "full_name": "Renamed Student", "department": "CSE",
        "year": 2, "section": "B"})
    assert r.status_code == 200, r.text
    assert r.json()["full_name"] == "Renamed Student"
    assert r.json()["department"] == "CSE"


def test_no_token_is_401(client):
    assert client.get("/api/auth/me").status_code == 401
    assert client.get("/api/attendance/summary").status_code == 401


def test_cross_user_subject_access_is_404(client, make_user):
    headers_a, _ = make_user()
    headers_b, _ = make_user()

    # A creates a subject.
    r = client.post("/api/attendance/manual", headers=headers_a, json={
        "subject_name": "Maths", "total_classes": 60, "attended": 45})
    assert r.status_code == 201, r.text
    subject_id = r.json()["id"]

    # B cannot read it via PUT/DELETE (all must be 404, never A's data).
    assert client.put(f"/api/attendance/subjects/{subject_id}",
                      headers=headers_b,
                      json={"total_classes": 60, "attended": 50}
                      ).status_code == 404
    assert client.delete(f"/api/attendance/subjects/{subject_id}",
                         headers=headers_b).status_code == 404
    # The subject is still intact for A.
    r = client.get("/api/attendance/subjects", headers=headers_a)
    assert any(s["id"] == subject_id for s in r.json()["subjects"])


def test_cross_user_summary_isolation(client, make_user):
    headers_a, _ = make_user()
    headers_b, _ = make_user()
    client.post("/api/attendance/manual", headers=headers_a, json={
        "subject_name": "Secret Subject", "total_classes": 10,
        "attended": 9})
    summary_b = client.get("/api/attendance/summary",
                           headers=headers_b).json()
    assert summary_b["total_subjects"] == 0
    assert summary_b["overall_percentage"] == 0
    assert summary_b["risk_status"] == "NO DATA"
    assert all(s["subject_name"] != "Secret Subject"
               for s in summary_b["subjects"])
    subjects_b = client.get("/api/attendance/subjects",
                            headers=headers_b).json()["subjects"]
    assert subjects_b == []


def test_manual_validation_422(client, make_user):
    headers, _ = make_user()
    # attended > total
    r = client.post("/api/attendance/manual", headers=headers, json={
        "subject_name": "Maths", "total_classes": 10, "attended": 11})
    assert r.status_code == 422
    # total <= 0
    r = client.post("/api/attendance/manual", headers=headers, json={
        "subject_name": "Maths", "total_classes": 0, "attended": 0})
    assert r.status_code == 422
    # negative attended
    r = client.post("/api/attendance/manual", headers=headers, json={
        "subject_name": "Maths", "total_classes": 10, "attended": -1})
    assert r.status_code == 422


def test_own_update_and_delete(client, make_user):
    headers, _ = make_user()
    r = client.post("/api/attendance/manual", headers=headers, json={
        "subject_name": "Maths", "total_classes": 60, "attended": 45})
    sid = r.json()["id"]
    r = client.put(f"/api/attendance/subjects/{sid}", headers=headers,
                   json={"total_classes": 60, "attended": 50})
    assert r.status_code == 200, r.text
    assert r.json()["attended"] == 50
    assert r.json()["percentage"] == 83.33
    r = client.delete(f"/api/attendance/subjects/{sid}", headers=headers)
    assert r.status_code == 200
    assert client.get("/api/attendance/subjects",
                      headers=headers).json()["subjects"] == []
    # Deleting again is 404.
    assert client.delete(f"/api/attendance/subjects/{sid}",
                         headers=headers).status_code == 404
