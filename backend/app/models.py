"""Plain data shapes for the Smart Attendance backend.

The storage layer (database.py) works with plain dicts built from SQLite
rows; these dataclasses document the shapes the API returns.
"""

from dataclasses import dataclass


@dataclass
class User:
    id: int
    full_name: str
    student_id: str
    email: str
    department: str
    year: int
    section: str


@dataclass
class Subject:
    id: int
    user_id: int
    subject_name: str
    total_classes: int
    attended: int

    @property
    def absent(self) -> int:
        return self.total_classes - self.attended

    @property
    def percentage(self) -> float:
        if self.total_classes <= 0:
            return 0.0
        return round(self.attended / self.total_classes * 100, 2)


def public_user(row: dict) -> dict:
    """Strip the password hash — never send it to a client."""
    return {
        "id": row["id"],
        "full_name": row["full_name"],
        "student_id": row["student_id"],
        "email": row["email"],
        "department": row["department"],
        "year": row["year"],
        "section": row["section"],
    }


def subject_view(row: dict) -> dict:
    """One subject with the derived absent / percentage / status fields."""
    total = row["total_classes"]
    attended = row["attended"]
    absent = total - attended
    percentage = round(attended / total * 100, 2) if total > 0 else 0.0
    if percentage >= 75:
        status = "SAFE"
    elif percentage >= 65:
        status = "WARNING"
    else:
        status = "HIGH RISK"
    return {
        "id": row["id"],
        "subject_name": row["subject_name"],
        "total_classes": total,
        "attended": attended,
        "absent": absent,
        "percentage": percentage,
        "status": status,
    }
