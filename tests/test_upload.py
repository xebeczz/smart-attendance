"""Upload endpoint tests: CSV, XLSX, bad extension, bad rows, duplicates."""

import io

import openpyxl


def _upload(client, headers, filename, content):
    return client.post("/api/attendance/upload", headers=headers,
                       files={"file": (filename, content)})


def test_valid_csv_upload(client, make_user):
    headers, _ = make_user()
    csv = ("subject,total_classes,attended\n"
           "Maths,60,45\nPhysics,55,40\n")
    r = _upload(client, headers, "attendance.csv", csv.encode())
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["saved"] == 2
    assert body["updated"] == 0
    assert body["skipped"] == 0
    assert body["errors"] == []
    assert len(body["preview"]) == 2
    summary = client.get("/api/attendance/summary",
                         headers=headers).json()
    assert summary["total_subjects"] == 2
    assert summary["total_conducted"] == 115
    assert summary["total_attended"] == 85


def test_valid_xlsx_upload(client, make_user):
    headers, _ = make_user()
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(["Subject", "Total_Classes", "Attended"])
    ws.append(["Chemistry", 50, 40])
    ws.append(["Biology", 40, 30])
    buf = io.BytesIO()
    wb.save(buf)
    r = _upload(client, headers, "attendance.xlsx", buf.getvalue())
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["saved"] == 2
    assert body["skipped"] == 0
    subjects = client.get("/api/attendance/subjects",
                          headers=headers).json()["subjects"]
    assert {s["subject_name"] for s in subjects} == {"Chemistry", "Biology"}


def test_column_variants_accepted(client, make_user):
    # subject_name / total / classes_attended variants, mixed case.
    headers, _ = make_user()
    csv = ("Subject_Name,Total,Classes_Attended\n"
           "English,40,32\n")
    r = _upload(client, headers, "a.csv", csv.encode())
    assert r.status_code == 200, r.text
    assert r.json()["saved"] == 1


def test_invalid_extension_rejected(client, make_user):
    headers, _ = make_user()
    r = _upload(client, headers, "attendance.txt",
                b"subject,total_classes,attended\nMaths,10,9\n")
    assert r.status_code == 400
    r = _upload(client, headers, "attendance.pdf", b"%PDF-fake")
    assert r.status_code == 400


def test_invalid_rows_skipped_with_errors(client, make_user):
    headers, _ = make_user()
    csv = ("subject,total_classes,attended\n"
           "Good,50,40\n"          # valid
           "BadTotal,0,0\n"        # total <= 0
           "TooMany,10,11\n"       # attended > total
           ",20,15\n"              # missing subject
           "Negative,10,-1\n")     # attended < 0
    r = _upload(client, headers, "a.csv", csv.encode())
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["saved"] == 1
    assert body["skipped"] == 4
    assert len(body["errors"]) == 4
    assert all("Row" in e for e in body["errors"])
    subjects = client.get("/api/attendance/subjects",
                          headers=headers).json()["subjects"]
    assert [s["subject_name"] for s in subjects] == ["Good"]


def test_duplicate_subject_updates(client, make_user):
    headers, _ = make_user()
    # First upload saves; second upload of the same subject updates it.
    csv1 = "subject,total_classes,attended\nMaths,60,45\n"
    r = _upload(client, headers, "a.csv", csv1.encode())
    assert r.json()["saved"] == 1
    csv2 = "subject,total_classes,attended\nMaths,60,50\nEnglish,40,30\n"
    r = _upload(client, headers, "b.csv", csv2.encode())
    body = r.json()
    assert body["saved"] == 1, body      # English is new
    assert body["updated"] == 1, body    # Maths already stored -> updated
    subjects = {s["subject_name"]: s for s in
                client.get("/api/attendance/subjects",
                           headers=headers).json()["subjects"]}
    assert subjects["Maths"]["attended"] == 50
    assert subjects["Maths"]["total_classes"] == 60

    # Duplicate within one file: second row updates the first.
    csv3 = ("subject,total_classes,attended\n"
            "Physics,50,40\nPhysics,50,45\n")
    r = _upload(client, headers, "c.csv", csv3.encode())
    body = r.json()
    assert body["saved"] == 1, body
    assert body["updated"] == 1, body
    subjects = {s["subject_name"]: s for s in
                client.get("/api/attendance/subjects",
                           headers=headers).json()["subjects"]}
    assert subjects["Physics"]["attended"] == 45


def test_missing_columns_rejected(client, make_user):
    headers, _ = make_user()
    r = _upload(client, headers, "a.csv",
                b"subject,total_classes\nMaths,10\n")
    assert r.status_code == 400
