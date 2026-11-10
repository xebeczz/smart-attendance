# Smart Attendance — AWS Architecture

## Flow (text diagram)

```
Student (browser)
    |
    |  React SPA (Vite, port 5173 in dev)
    v
FastAPI backend (port 8000, /api)
    |  JWT auth, attendance CRUD, what-if maths, report exports
    |
    +-- file upload (.csv/.xlsx) ----> S3 bucket  (attendance-uploads)
    |                                       |
    |                                       | S3 ObjectCreated event
    |                                       v
    |                                  Lambda: process_upload.py
    |                                  (validate rows, per-subject %)
    |                                       |
    |                                       v
    |                                  DynamoDB: AttendanceRecords
    |                                  (Students, Predictions tables)
    |
    +-- /api/ml/predict ----------------> SageMaker-trained model
                                           (train_sagemaker.py:
                                            Logistic Regression,
                                            Random Forest, Decision Tree;
                                            best model saved to S3)
    |
    +-- dashboard reads ----------------> DynamoDB (via FastAPI)
```

## What runs locally vs on AWS

| Part | Local (this repo) | AWS (manual setup) |
|---|---|---|
| React frontend | `npm run dev` (Vite, :5173) | S3 static hosting + CloudFront (optional) |
| FastAPI backend | `uvicorn backend.app.main:app` (:8000) | EC2 / ECS / API Gateway + Lambda (optional) |
| SQLite / local DB | Yes, default for the demo | — |
| File upload processing | In-process in FastAPI | S3 trigger -> Lambda `process_upload.py` |
| ML training | `python ml/train.py` (scikit-learn) | SageMaker training job (`aws/sagemaker/train_sagemaker.py`) |
| Data store | SQLite file | DynamoDB (Students, AttendanceRecords, Predictions) |
| Auth | JWT in FastAPI | Same JWT; Cognito optional later |

The local demo is fully functional without any AWS account. The AWS
pieces above are the production path and are set up manually — nothing
in this repo deploys to AWS on its own.

## Manual setup checklist (AWS)

Replace the placeholders before use:
- `<BUCKET>` — your S3 bucket name (e.g. `smart-attendance-uploads`)
- `<ACCOUNT>` — your 12-digit AWS account ID
- Region used in the examples: `ap-south-1` (Mumbai). Change it if you use another region.

1. **S3** — Create bucket `<BUCKET>`. Enable versioning (optional).
   Uploads go to the `uploads/` prefix.
2. **DynamoDB** — Create the 3 tables from `dynamodb-schema.json`:
   `Students` (PK `student_id`), `AttendanceRecords` (PK `student_id`, SK `subject_name`),
   `Predictions` (PK `student_id`, SK `predicted_at`). Billing mode: on-demand.
3. **IAM** — Create a role for Lambda with `iam-policy.json` attached
   (after replacing `<BUCKET>` and `<ACCOUNT>`). Create a second role/user
   for SageMaker with the same policy's SageMaker section.
4. **Lambda** — Create function `smart-attendance-process-upload`
   (Python 3.12, handler `process_upload.lambda_handler`), attach the IAM
   role, set env vars `S3_BUCKET=<BUCKET>` and `DYNAMODB_TABLE=AttendanceRecords`,
   add an S3 trigger on `<BUCKET>` for ObjectCreated on `uploads/*`.
   Add `openpyxl` as a Lambda layer if you upload .xlsx files.
5. **SageMaker** — Run a training job with `aws/sagemaker/train_sagemaker.py`
   (script mode, scikit-learn container), training data at
   `s3://<BUCKET>/data/attendance_dataset.csv` (upload `ml/attendance_dataset.csv`
   or generate it with `python ml/generate_dataset.py` first).
6. **Wire the backend** — Point the FastAPI upload endpoint at the S3
   bucket and the prediction endpoint at the SageMaker model endpoint
   (or keep the local model — the local demo works without this step).
7. **Test end-to-end** — Upload `data/sample_attendance.csv` in the UI,
   confirm a row appears in DynamoDB `AttendanceRecords`, then open
   the Dashboard and confirm the same numbers show up.
