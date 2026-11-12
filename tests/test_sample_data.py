"""POST /api/attendance/sample — one-tap demo data for an empty account."""


def test_sample_loads_eight_subjects(client, make_user):
    headers, _user = make_user()
    r = client.post("/api/attendance/sample", headers=headers)
    assert r.status_code == 201, r.text
    assert r.json()["saved"] == 8
    assert r.json()["updated"] == 0

    s = client.get("/api/attendance/summary", headers=headers).json()
    assert s["total_subjects"] == 8
    assert s["overall_percentage"] == 74.42
    assert s["total_conducted"] == 430
    assert s["total_attended"] == 320


def test_sample_is_idempotent(client, make_user):
    headers, _user = make_user()
    client.post("/api/attendance/sample", headers=headers)
    r = client.post("/api/attendance/sample", headers=headers)
    assert r.status_code == 201, r.text
    assert r.json()["saved"] == 0
    assert r.json()["updated"] == 8
    s = client.get("/api/attendance/summary", headers=headers).json()
    assert s["total_subjects"] == 8


def test_sample_needs_login(client):
    r = client.post("/api/attendance/sample")
    assert r.status_code == 401
