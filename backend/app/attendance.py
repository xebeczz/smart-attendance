"""Pure attendance calculations — no I/O, fully unit-testable.

Risk bands (per the API contract):
    >= 75%            -> SAFE
    65% .. 74.99%     -> WARNING
    < 65%             -> HIGH RISK
    no classes at all -> NO DATA
"""

import math

REQUIRED_PERCENTAGE = 75


def percentage(attended: int, total: int) -> float:
    """Attendance % rounded to 2dp; 0.0 when nothing was conducted."""
    if total <= 0:
        return 0.0
    return round(attended / total * 100, 2)


def risk_status(pct: float, has_data: bool) -> str:
    if not has_data:
        return "NO DATA"
    if pct >= 75:
        return "SAFE"
    if pct >= 65:
        return "WARNING"
    return "HIGH RISK"


def build_summary(subject_rows: list[dict]) -> dict:
    """Build the /summary payload from a user's subject rows.

    Each row: {id, subject_name, total_classes, attended}.
    """
    subjects = []
    total_conducted = 0
    total_attended = 0
    for row in subject_rows:
        total = row["total_classes"]
        attended = row["attended"]
        pct = percentage(attended, total)
        subjects.append({
            "id": row["id"],
            "subject_name": row["subject_name"],
            "total_classes": total,
            "attended": attended,
            "absent": total - attended,
            "percentage": pct,
            "status": risk_status(pct, total > 0),
        })
        total_conducted += total
        total_attended += attended

    total_absent = total_conducted - total_attended
    overall = percentage(total_attended, total_conducted)
    return {
        "total_subjects": len(subjects),
        "overall_percentage": overall,
        "total_conducted": total_conducted,
        "total_attended": total_attended,
        "total_absent": total_absent,
        "required_percentage": REQUIRED_PERCENTAGE,
        "risk_status": risk_status(overall, total_conducted > 0),
        "subjects": subjects,
    }


def classes_to_attend(attended: int, total: int, target: float) -> int:
    """Consecutive classes to attend to reach ``target`` % (0 if already there).

    Solve (attended + x) / (total + x) >= target / 100 for the smallest
    integer x >= 0. With no classes yet, one attended class gives 100%,
    so the answer is 1 for any target > 0.
    """
    if total <= 0:
        return 1 if target > 0 else 0
    if percentage(attended, total) >= target:
        return 0
    # x >= (target*total - 100*attended) / (100 - target)
    needed = (target * total - 100 * attended) / (100 - target)
    return max(0, math.ceil(needed))


def classes_can_miss(attended: int, total: int, target: float) -> int:
    """Consecutive classes that can be missed while staying >= ``target`` %.

    Solve attended / (total + y) >= target / 100 for the largest integer
    y >= 0. Zero when already below target (or with no data).
    """
    if total <= 0 or percentage(attended, total) < target:
        return 0
    # y <= (100*attended - target*total) / target
    return max(0, math.floor((100 * attended - target * total) / target))


def what_if(attended: int, total: int, target: float = 75) -> dict:
    """Full what-if payload, including scenarios for 75/80/85/90."""
    scenarios = [
        {
            "target": t,
            "classes_to_attend": classes_to_attend(attended, total, t),
            "classes_can_miss": classes_can_miss(attended, total, t),
        }
        for t in (75, 80, 85, 90)
    ]
    return {
        "overall_percentage": percentage(attended, total),
        "total_conducted": total,
        "total_attended": attended,
        "target": target,
        "classes_to_attend": classes_to_attend(attended, total, target),
        "classes_can_miss": classes_can_miss(attended, total, target),
        "scenarios": scenarios,
    }
