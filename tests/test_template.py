"""GET /api/attendance/template — downloadable sample CSV."""


def test_template_download(client, make_user):
    headers, _user = make_user()
    r = client.get("/api/attendance/template", headers=headers)
    assert r.status_code == 200, r.text
    assert r.headers["content-type"].startswith("text/csv")
    lines = r.text.strip().splitlines()
    assert lines[0] == "subject,total_classes,attended"
    assert len(lines) == 9  # header + 8 sample subjects
    assert lines[1].startswith("Mathematics,60,45")


def test_template_needs_login(client):
    r = client.get("/api/attendance/template")
    assert r.status_code == 401


def test_register_year_must_be_a_number(client):
    r = client.post("/api/auth/register", json={
        "full_name": "Test Year",
        "student_id": "SID-YEAR-1",
        "email": "year-bad@example.com",
        "department": "AI & DS",
        "year": "3rd Year",
        "section": "A",
        "password": "password123",
    })
    assert r.status_code == 422
