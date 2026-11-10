"""Unit tests for the pure attendance calculations + what-if endpoint."""

import pytest

from backend.app.attendance import (build_summary, classes_can_miss,
                                    classes_to_attend, percentage,
                                    risk_status, what_if)


# ------------------------------------------------------------ percentage ---

def test_percentage_basic():
    assert percentage(45, 60) == 75.0
    assert percentage(1, 3) == 33.33
    assert percentage(0, 10) == 0.0
    assert percentage(10, 10) == 100.0


def test_percentage_zero_classes():
    # No classes conducted -> 0, never a division error.
    assert percentage(0, 0) == 0.0
    assert percentage(5, 0) == 0.0


def test_risk_bands():
    assert risk_status(90.0, True) == "SAFE"
    assert risk_status(75.0, True) == "SAFE"       # boundary: 75 is SAFE
    assert risk_status(74.99, True) == "WARNING"
    assert risk_status(65.0, True) == "WARNING"    # boundary: 65 is WARNING
    assert risk_status(64.99, True) == "HIGH RISK"
    assert risk_status(0.0, True) == "HIGH RISK"
    assert risk_status(0.0, False) == "NO DATA"    # no data at all


def test_build_summary_empty():
    s = build_summary([])
    assert s["total_subjects"] == 0
    assert s["overall_percentage"] == 0
    assert s["total_conducted"] == 0
    assert s["total_attended"] == 0
    assert s["total_absent"] == 0
    assert s["required_percentage"] == 75
    assert s["risk_status"] == "NO DATA"
    assert s["subjects"] == []


def test_build_summary_totals():
    rows = [
        {"id": 1, "subject_name": "Maths", "total_classes": 60, "attended": 45},
        {"id": 2, "subject_name": "Physics", "total_classes": 40, "attended": 20},
    ]
    s = build_summary(rows)
    assert s["total_subjects"] == 2
    assert s["total_conducted"] == 100
    assert s["total_attended"] == 65
    assert s["total_absent"] == 35
    assert s["overall_percentage"] == 65.0
    assert s["risk_status"] == "WARNING"
    assert s["subjects"][0]["percentage"] == 75.0
    assert s["subjects"][0]["status"] == "SAFE"
    assert s["subjects"][1]["percentage"] == 50.0
    assert s["subjects"][1]["status"] == "HIGH RISK"


# --------------------------------------------------------------- what-if ---

def test_what_if_already_above_target():
    # 80/100 = 80% >= 75 -> nothing to attend, can miss 6 (80/106 = 75.47%).
    assert classes_to_attend(80, 100, 75) == 0
    assert classes_can_miss(80, 100, 75) == 6


def test_what_if_below_target():
    # 60/100 = 60%: need x with (60+x)/(100+x) >= 0.75 -> x >= 60.
    assert classes_to_attend(60, 100, 75) == 60
    assert classes_can_miss(60, 100, 75) == 0


def test_what_if_exactly_75():
    # Exactly at target: 0 to attend, 0 can miss (one miss drops below).
    assert classes_to_attend(75, 100, 75) == 0
    assert classes_can_miss(75, 100, 75) == 0


def test_what_if_no_data():
    # No classes yet: one attended class gives 100%, so 1 to attend.
    assert classes_to_attend(0, 0, 75) == 1
    assert classes_can_miss(0, 0, 75) == 0


def test_what_if_can_miss_exact():
    # 90/100 = 90%: can miss 20 (90/120 = 75%), not 21.
    assert classes_can_miss(90, 100, 75) == 20
    # Higher target shrinks the allowance.
    assert classes_can_miss(90, 100, 90) == 0
    assert classes_can_miss(90, 100, 80) == 12  # 90/112 = 80.35%


def test_what_if_payload_scenarios():
    w = what_if(70, 100, 75)
    assert w["overall_percentage"] == 70.0
    assert w["target"] == 75
    assert w["classes_to_attend"] == 20  # (70+x)/(100+x) >= .75 -> x>=20
    assert w["classes_can_miss"] == 0
    assert [s["target"] for s in w["scenarios"]] == [75, 80, 85, 90]
    assert w["scenarios"][0]["classes_to_attend"] == 20
    assert w["scenarios"][3]["classes_to_attend"] == 200  # to reach 90%


# ------------------------------------------------------- endpoint checks ---

def test_what_if_endpoint(client, make_user):
    headers, _ = make_user()
    client.post("/api/attendance/manual", json={
        "subject_name": "Maths", "total_classes": 100, "attended": 60},
        headers=headers)
    r = client.get("/api/attendance/what-if?target=75", headers=headers)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["overall_percentage"] == 60.0
    assert body["classes_to_attend"] == 60
    assert body["classes_can_miss"] == 0
    assert len(body["scenarios"]) == 4


def test_what_if_endpoint_invalid_target(client, make_user):
    headers, _ = make_user()
    r = client.get("/api/attendance/what-if?target=150", headers=headers)
    assert r.status_code == 422
