"""Smart Attendance — FastAPI backend (local mode, SQLite + JWT).

Run:  uvicorn backend.app.main:app --reload --port 8000
      (from the project root, with the venv active)

Every data query filters by the user_id taken from the verified JWT —
never by any user_id from the request body or query string. Accessing
another student's subject returns 404, never their data.
"""

import csv
import io
import math
import os
from datetime import date

from contextlib import asynccontextmanager

import pandas as pd
from pathlib import Path

from fastapi import (Depends, FastAPI, File, HTTPException, Query, UploadFile,
                     status)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet

from . import attendance as calc
from . import database
from . import ml_predict
from .auth import (create_access_token, get_current_user, hash_password,
                   verify_password)
from .models import public_user, subject_view
from .schemas import (AuthResponse, ForgotPasswordRequest, LoginRequest,
                      RegisterRequest, SubjectInput, SubjectUpdate,
                      UpdateProfileRequest, UserResponse)
from .storage import LocalStorage

MAX_UPLOAD_BYTES = 5 * 1024 * 1024  # 5 MB
ALLOWED_EXTENSIONS = {".csv", ".xlsx"}

# Column names accepted in uploads (case-insensitive, spaces stripped).
SUBJECT_COLS = {"subject", "subject_name"}
TOTAL_COLS = {"total_classes", "total", "classes_total"}
ATTENDED_COLS = {"attended", "classes_attended", "attended_classes"}


@asynccontextmanager
async def _lifespan(_app):
    database.init_db()
    yield

app = FastAPI(title="Smart Attendance API", version="1.0.0",
              lifespan=_lifespan)

# Extra origins (comma-separated) for a deployed frontend on another host,
# e.g. ALLOWED_ORIGINS=https://smart-attendance.onrender.com
_EXTRA_ORIGINS = [o.strip() for o in
                  os.environ.get("ALLOWED_ORIGINS", "").split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"] + _EXTRA_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ------------------------------------------------------------------ misc ---
# Serve the built React frontend (frontend/dist) from the same host when it
# exists, so one deployed service gives both the app and the API on /api.
# Local dev still uses `npm run dev` on :5173 with the Vite /api proxy.
DIST_DIR = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"

if (DIST_DIR / "assets").is_dir():
    app.mount("/assets", StaticFiles(directory=DIST_DIR / "assets"),
              name="assets")


@app.get("/")
def root():
    index = DIST_DIR / "index.html"
    if index.is_file():
        return FileResponse(index)
    return {
        "message": "Smart Attendance API",
        "docs": "/docs",
    }


@app.get("/api/health")
def health():
    return {"status": "ok"}


# ------------------------------------------------------------------ auth ---

@app.post("/api/auth/register", status_code=status.HTTP_201_CREATED,
          response_model=AuthResponse)
def register(payload: RegisterRequest):
    if database.get_user_by_email(payload.email):
        raise HTTPException(status_code=400,
                            detail="Email already registered")
    if database.get_user_by_student_id(payload.student_id):
        raise HTTPException(status_code=400,
                            detail="Student ID already registered")
    row = database.create_user(
        payload.full_name, payload.student_id, payload.email,
        payload.department, payload.year, payload.section,
        hash_password(payload.password))
    user = public_user(row)
    return AuthResponse(access_token=create_access_token(user["id"]),
                        user=UserResponse(**user))


@app.post("/api/auth/login", response_model=AuthResponse)
def login(payload: LoginRequest):
    row = database.get_user_by_email(payload.email)
    if row is None or not verify_password(payload.password,
                                          row["password_hash"]):
        raise HTTPException(status_code=401,
                            detail="Invalid email or password")
    user = public_user(row)
    return AuthResponse(access_token=create_access_token(user["id"]),
                        user=UserResponse(**user))


@app.post("/api/auth/forgot-password")
def forgot_password(payload: ForgotPasswordRequest):
    # Always the same generic message — never reveal whether the email
    # exists. (No email is actually sent in local mode.)
    return {"message": "If an account exists for this email, a password "
                       "reset link has been sent."}


@app.get("/api/auth/me", response_model=UserResponse)
def me(user: dict = Depends(get_current_user)):
    return UserResponse(**user)


@app.put("/api/auth/me", response_model=UserResponse)
def update_me(payload: UpdateProfileRequest,
              user: dict = Depends(get_current_user)):
    row = database.update_user(user["id"], payload.full_name,
                               payload.department, payload.year,
                               payload.section)
    return UserResponse(**public_user(row))


# ------------------------------------------------------------- attendance ---

def _summary_for(user_id: int) -> dict:
    return calc.build_summary(database.get_subjects(user_id))


@app.get("/api/attendance/summary")
def attendance_summary(user: dict = Depends(get_current_user)):
    return _summary_for(user["id"])


@app.get("/api/attendance/subjects")
def list_subjects(user: dict = Depends(get_current_user)):
    rows = database.get_subjects(user["id"])
    return {"subjects": [subject_view(r) for r in rows]}


@app.post("/api/attendance/manual", status_code=201)
def manual_entry(payload: SubjectInput,
                 user: dict = Depends(get_current_user)):
    # Upsert by subject_name for this user only.
    subject, _created = database.upsert_subject(
        user["id"], payload.subject_name, payload.total_classes,
        payload.attended)
    return subject_view(subject)


# The same 8 subjects as data/sample_attendance.csv — one tap fills an
# empty account so the dashboard, charts and prediction can be tried
# without finding a file first. Safe to tap twice: subjects that already
# exist for this student are updated in place, not duplicated.
SAMPLE_SUBJECTS = [
    ("Mathematics", 60, 45),
    ("Physics", 55, 40),
    ("Programming in Python", 60, 46),
    ("Data Structures", 58, 42),
    ("DBMS", 52, 39),
    ("Operating Systems", 50, 36),
    ("English", 40, 32),
    ("Machine Learning", 55, 40),
]


@app.post("/api/attendance/sample", status_code=201)
def load_sample_data(user: dict = Depends(get_current_user)):
    saved = updated = 0
    for name, total, attended in SAMPLE_SUBJECTS:
        _subject, created = database.upsert_subject(
            user["id"], name, total, attended)
        if created:
            saved += 1
        else:
            updated += 1
    return {"saved": saved, "updated": updated,
            "message": f"Sample data loaded: {saved} new, "
                       f"{updated} already present."}


@app.put("/api/attendance/subjects/{subject_id}")
def update_subject(subject_id: int, payload: SubjectUpdate,
                   user: dict = Depends(get_current_user)):
    updated = database.update_subject(subject_id, user["id"],
                                      payload.total_classes,
                                      payload.attended)
    if updated is None:
        raise HTTPException(status_code=404, detail="Subject not found")
    return subject_view(updated)


@app.delete("/api/attendance/subjects/{subject_id}")
def delete_subject(subject_id: int, user: dict = Depends(get_current_user)):
    if not database.delete_subject(subject_id, user["id"]):
        raise HTTPException(status_code=404, detail="Subject not found")
    return {"message": "Subject deleted"}


# ----------------------------------------------------------------- upload ---

def _normalise_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Lower-case / strip column names and rename accepted variants."""
    rename = {}
    for col in df.columns:
        key = str(col).strip().lower().replace(" ", "_")
        if key in SUBJECT_COLS:
            rename[col] = "subject_name"
        elif key in TOTAL_COLS:
            rename[col] = "total_classes"
        elif key in ATTENDED_COLS:
            rename[col] = "attended"
    return df.rename(columns=rename)


def _parse_upload(content: bytes, filename: str) -> pd.DataFrame:
    ext = os.path.splitext(filename)[1].lower()
    buf = io.BytesIO(content)
    if ext == ".csv":
        return pd.read_csv(buf)
    return pd.read_excel(buf, engine="openpyxl")


TEMPLATE_PATH = Path(__file__).resolve().parent.parent.parent / "data" / "sample_attendance.csv"


@app.get("/api/attendance/template")
def download_template(user: dict = Depends(get_current_user)):
    """The sample CSV (same 8 subjects as the Load sample data button),
    so a student can see the exact file format before uploading."""
    if not TEMPLATE_PATH.is_file():
        raise HTTPException(status_code=404,
                            detail="Sample file not available")
    return FileResponse(TEMPLATE_PATH, media_type="text/csv",
                        filename="sample_attendance.csv")


@app.post("/api/attendance/upload")
async def upload_attendance(file: UploadFile = File(...),
                            user: dict = Depends(get_current_user)):
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail="Only .csv and .xlsx files are accepted")
    content = await file.read()
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413,
                            detail="File too large (max 5MB)")

    # Keep a private per-user copy of the raw upload.
    LocalStorage().save(user["id"], file.filename, content)

    try:
        df = _parse_upload(content, file.filename)
    except Exception as exc:
        raise HTTPException(status_code=400,
                            detail=f"Could not parse file: {exc}")
    df = _normalise_columns(df)
    missing = {"subject_name", "total_classes", "attended"} - set(df.columns)
    if missing:
        raise HTTPException(
            status_code=400,
            detail="Missing required columns: subject, total_classes, "
                   "attended (got: " + ", ".join(str(c) for c in df.columns)
                   + ")")

    saved = updated = skipped = 0
    errors: list[str] = []
    preview: list[dict] = []
    seen_in_file: set[str] = set()

    for i, row in df.iterrows():
        # Row numbers shown to the user count from 2 (header is row 1).
        row_no = int(i) + 2 if isinstance(i, (int, float)) and not math.isnan(i) \
            else len(preview) + skipped + 2
        try:
            name = row["subject_name"]
            if pd.isna(name) or str(name).strip() == "":
                raise ValueError("missing subject name")
            name = str(name).strip()
            total = int(row["total_classes"])
            attended = int(row["attended"])
            if total <= 0:
                raise ValueError("total_classes must be greater than 0")
            if attended < 0 or attended > total:
                raise ValueError("attended must be between 0 and "
                                 "total_classes")
        except (ValueError, TypeError) as exc:
            skipped += 1
            errors.append(f"Row {row_no}: {exc}")
            continue

        _subject, created = database.upsert_subject(
            user["id"], name, total, attended)
        if created and name not in seen_in_file:
            saved += 1
        else:
            # Already stored for this user, or repeated within this file.
            updated += 1
        seen_in_file.add(name)
        preview.append({"subject_name": name, "total_classes": total,
                        "attended": attended})

    return {"saved": saved, "updated": updated, "skipped": skipped,
            "errors": errors, "preview": preview}


# ----------------------------------------------------------------- what-if ---

@app.get("/api/attendance/what-if")
def what_if(target: float = Query(75, gt=0, lt=100),
            user: dict = Depends(get_current_user)):
    summary = _summary_for(user["id"])
    return calc.what_if(summary["total_attended"],
                        summary["total_conducted"], target)


# --------------------------------------------------------------------- ml ---

@app.get("/api/ml/predict")
def predict(user: dict = Depends(get_current_user)):
    summary = _summary_for(user["id"])
    return ml_predict.predict(summary)


@app.get("/api/ml/compare")
def compare(user: dict = Depends(get_current_user)):
    return ml_predict.compare_models()


# ---------------------------------------------------------------- reports ---

@app.get("/api/reports/export/csv")
def export_csv(user: dict = Depends(get_current_user)):
    summary = _summary_for(user["id"])
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["Subject", "Total Classes", "Attended", "Absent",
                     "Percentage (%)"])
    for s in summary["subjects"]:
        writer.writerow([s["subject_name"], s["total_classes"],
                         s["attended"], s["absent"], s["percentage"]])
    writer.writerow([])
    writer.writerow(["Overall Percentage (%)", summary["overall_percentage"]])
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition":
                 'attachment; filename="attendance-report.csv"'})


@app.get("/api/reports/export/pdf")
def export_pdf(user: dict = Depends(get_current_user)):
    summary = _summary_for(user["id"])
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4,
                            title="Smart Attendance Report")
    styles = getSampleStyleSheet()
    story = [
        Paragraph("Smart Attendance Report", styles["Title"]),
        Spacer(1, 0.5 * cm),
        Paragraph(f"Student: {user['full_name']} ({user['student_id']})",
                  styles["Normal"]),
        Paragraph(f"Department: {user['department']} &nbsp; Year: "
                  f"{user['year']} &nbsp; Section: {user['section']}",
                  styles["Normal"]),
        Paragraph(f"Date: {date.today().isoformat()}", styles["Normal"]),
        Paragraph(f"Overall Attendance: "
                  f"{summary['overall_percentage']}% "
                  f"({summary['total_attended']}/"
                  f"{summary['total_conducted']} classes) — "
                  f"{summary['risk_status']}", styles["Normal"]),
        Spacer(1, 0.5 * cm),
    ]
    data = [["Subject", "Total", "Attended", "Absent", "%"]]
    for s in summary["subjects"]:
        data.append([s["subject_name"], s["total_classes"], s["attended"],
                     s["absent"], s["percentage"]])
    table = Table(data, colWidths=[7 * cm, 2 * cm, 2.5 * cm, 2 * cm, 2 * cm])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1f6feb")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1),
         [colors.white, colors.HexColor("#f2f6ff")]),
    ]))
    story.append(table)
    doc.build(story)
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition":
                 'attachment; filename="attendance-report.pdf"'})



# ------------------------------------------------- SPA fallback (last) ---
# React Router pages (/dashboard, /upload, ...) are served index.html so a
# refresh or direct link works. API/docs paths are registered above and
# match first, so they are never swallowed here.
@app.get("/{full_path:path}")
def spa_fallback(full_path: str):
    if full_path.startswith("api/") or full_path in (
            "docs", "openapi.json", "redoc"):
        raise HTTPException(status_code=404, detail="Not found")
    candidate = DIST_DIR / full_path
    if candidate.is_file():
        return FileResponse(candidate)
    index = DIST_DIR / "index.html"
    if index.is_file():
        return FileResponse(index)
    raise HTTPException(status_code=404, detail="Not found")
