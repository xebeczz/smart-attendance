"""Smart Attendance — S3 upload processor (AWS Lambda).

Triggered by an S3 ObjectCreated event on the attendance-uploads bucket.
Reads the uploaded CSV/XLSX, validates rows, computes per-subject
attendance %, and writes one item per subject into DynamoDB.

Environment variables (set on the Lambda function):
  S3_BUCKET       - name of the uploads bucket
  DYNAMODB_TABLE  - name of the AttendanceRecords table

Local note: boto3 is imported INSIDE the handler, so importing this
module locally (tests, linting) does not require boto3 to be installed.
"""

import csv
import io
import json
import os


def _parse_rows(content: bytes, key: str):
    """Parse a CSV or XLSX file into a list of dicts.

    Expected columns: subject_name, total_classes, attended
    (student_id is optional and carried through when present).
    """
    if key.lower().endswith(('.xlsx', '.xls')):
        import openpyxl  # only needed for Excel uploads

        wb = openpyxl.load_workbook(io.BytesIO(content), read_only=True, data_only=True)
        ws = wb.active
        rows = list(ws.iter_rows(values_only=True))
        if not rows:
            return []
        headers = [str(h).strip().lower() if h is not None else '' for h in rows[0]]
        out = []
        for r in rows[1:]:
            out.append({headers[i]: r[i] for i in range(min(len(headers), len(r)))})
        return out

    text = content.decode('utf-8-sig')
    reader = csv.DictReader(io.StringIO(text))
    return [
        {k.strip().lower(): v for k, v in row.items() if k is not None}
        for row in reader
    ]


def _validate(row):
    """Return (clean_row, error). clean_row is None when invalid."""
    subject = str(row.get('subject_name') or '').strip()
    if not subject:
        return None, 'missing subject_name'
    try:
        total = int(row.get('total_classes'))
        attended = int(row.get('attended'))
    except (TypeError, ValueError):
        return None, f'{subject}: total_classes/attended must be whole numbers'
    if total < 0 or attended < 0:
        return None, f'{subject}: negative numbers are not allowed'
    if attended > total:
        return None, f'{subject}: attended ({attended}) exceeds total ({total})'
    clean = {
        'subject_name': subject,
        'total_classes': total,
        'attended': attended,
        'absent': total - attended,
        'percentage': round((attended / total * 100) if total else 0.0, 2),
    }
    student_id = str(row.get('student_id') or '').strip()
    if student_id:
        clean['student_id'] = student_id
    return clean, None


def lambda_handler(event, context):
    import boto3  # imported here so local import does not require boto3

    bucket = os.environ.get('S3_BUCKET')
    table_name = os.environ.get('DYNAMODB_TABLE')
    s3 = boto3.client('s3')
    dynamodb = boto3.resource('dynamodb')
    table = dynamodb.Table(table_name)

    saved = updated = skipped = 0
    errors = []

    for record in event.get('Records', []):
        key = record['s3']['object']['key']
        obj = s3.get_object(Bucket=bucket, Key=key)
        content = obj['Body'].read()

        for row in _parse_rows(content, key):
            clean, err = _validate(row)
            if err:
                skipped += 1
                errors.append(err)
                continue
            # One item per (student_id, subject_name); re-upload overwrites.
            item = {
                'student_id': clean.pop('student_id', 'unknown'),
                'subject_name': clean['subject_name'],
                **clean,
            }
            table.put_item(Item=item)
            saved += 1

    return {
        'statusCode': 200,
        'body': json.dumps({
            'saved': saved,
            'updated': updated,
            'skipped': skipped,
            'errors': errors,
        }),
    }
