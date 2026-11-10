# Smart Attendance — Deploy on Windows

Exact copy-paste PowerShell commands. Run them in order, in a PowerShell
window (not CMD). All paths are relative to the project folder
`smart-attendance`.

> ⚠️ Import-path note: the backend command below uses
> `uvicorn backend.app.main:app`, which matches the agreed layout
> `backend/app/main.py` with an `app` object. At the time this file was
> written the backend files were not yet on disk (another agent owns
> `backend/`), so **confirm `backend\app\main.py` exists before running
> step 4** — if the backend agent used a different layout, use the
> import path that matches the real file (e.g. if the file is
> `backend\main.py`, run `uvicorn backend.main:app` from the project root).

## Prerequisites

- **Python 3.10 or newer** — check with `python --version`. Download from https://www.python.org/downloads/ (tick "Add Python to PATH" during install).
- **Node.js 18 or newer** — check with `node --version`. Download from https://nodejs.org/ (LTS).
- A folder for the project, e.g. `C:\Users\Hakeem\smart-attendance` — adjust the `cd` in step 1 to where you actually put it.

## 0. Fix the execution policy (only if PowerShell blocks the venv activate script)

If you see an error like "running scripts is disabled on this system", run:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

Type `Y` and press Enter when it asks. Then continue below.

## 1. Go to the project folder

```powershell
cd C:\Users\Hakeem\smart-attendance
```

## 2. Create and activate the virtual environment

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
```

Your prompt should now start with `(.venv)`. If it does not, the
activation failed — re-run step 0, then this step again.

## 3. Install Python dependencies and build the ML model

```powershell
pip install -r backend\requirements.txt
pip install -r ml\requirements.txt
python ml\generate_dataset.py
python ml\train.py
```

`train.py` writes the real measured metrics to `ml\evaluation.json`.
Open that file to see the actual model accuracy — no number is claimed
anywhere else.

## 4. Run the tests

```powershell
python -m pytest tests\ -v
```

All tests should pass. If any fail, fix them before starting the servers.

## 5. Start the backend (keep this window open)

From the project root, with `(.venv)` active:

```powershell
uvicorn backend.app.main:app --reload --port 8000
```

Check it works: open http://localhost:8000/api/health in a browser —
you should see `{"status": "ok"}` (or similar JSON).

## 6. Start the frontend (new PowerShell window)

Open a **second** PowerShell window and run:

```powershell
cd C:\Users\Hakeem\smart-attendance\frontend
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

## 7. Seed demo data and test login

1. On http://localhost:5173, click **Create an account** and register:
   - Full name: `Demo Student`
   - Student ID: `DEMO001`
   - Email: `demo@student.com`
   - Department: `AI & Data Science`
   - Year: `3rd Year`
   - Section: `A`
   - Password: `Demo@1234`
2. You are redirected to the Dashboard (empty at first — that is normal).
3. Go to **Upload Attendance**, choose the file `data\sample_attendance.csv`
   from the project folder, and click **Upload**.
4. Go back to the **Dashboard** — you should now see subjects, percentages
   and the risk badge. Try the **What-If Planner** (target 75%) and the
   **AI Prediction** page.
5. Log out from the sidebar, then log back in with `demo@student.com` /
   `Demo@1234` to confirm login works.

## Troubleshooting

- **Port 8000 already in use** (backend won't start):
  ```powershell
  netstat -ano | findstr :8000
  ```
  Note the PID in the last column, then stop it:
  ```powershell
  taskkill /PID <PID> /F
  ```
  Replace `<PID>` with the actual number from the previous command.
  Then re-run step 5.
- **Port 5173 already in use** (frontend won't start): stop the other
  Vite process the same way (`netstat -ano | findstr :5173`, then
  `taskkill /PID <PID> /F`), or run `npm run dev -- --port 5174` and
  open http://localhost:5174 instead.
- **`npm` is not recognized**: Node.js is not installed or not on PATH —
  reinstall Node.js LTS and open a fresh PowerShell window.
- **`.venv\Scripts\Activate.ps1` cannot be loaded**: see step 0
  (execution policy).
- **Frontend shows "Session expired" / 401**: the backend is not running
  or the token expired — restart the backend (step 5) and log in again.
- **Upload fails with a 500 error**: check the backend terminal window —
  the error message there says which row/column was rejected.
