# Smart Attendance — Backend

FastAPI + SQLite (local mode, no AWS) with JWT auth. Passwords are hashed
with `hashlib.pbkdf2_hmac` (salt + hash stored); tokens are PyJWT.

## Run

```bash
cd ~/workspace/aws-mini-projects/smart-attendance
python3 -m venv .venv
.venv/bin/pip install -r backend/requirements.txt
cp backend/.env.example backend/.env   # then set a real JWT_SECRET
.venv/bin/uvicorn backend.app.main:app --reload --port 8000
```

API docs: http://localhost:8000/docs — frontend runs on
http://localhost:5173 (allowed by CORS).

## Layout

- `app/main.py` — FastAPI app and all routes
- `app/auth.py` — PBKDF2 hashing, JWT issue/verify, `get_current_user`
- `app/database.py` — SQLite access; `SMART_ATTENDANCE_DB` env override
- `app/models.py` — data shapes + public (hash-free) views
- `app/schemas.py` — Pydantic request/response validation
- `app/attendance.py` — pure % / risk / what-if calculations
- `app/ml_predict.py` — trained-model predict, rule-based fallback
- `app/storage.py` — `LocalStorage` (per-user upload dirs) + S3 stub

## Tests

```bash
.venv/bin/python -m pytest tests/ -v   # from the project root
```

## Notes

- The SQLite file lives at `backend/smart_attendance.db` by default.
- Uploads are stored under `backend/uploads/<user_id>/`.
- If `ml/evaluation.json` + `ml/models/best_model.pkl` are absent,
  `/api/ml/predict` returns a rule-based risk and says so
  (`model_used: "rule-based"`).
