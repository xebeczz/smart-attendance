"""File storage: local disk in local mode, S3 stub for the AWS path.

LocalStorage saves uploaded files under
``backend/uploads/<user_id>/`` so one student's files are never visible
to another. S3Storage is only a stub: it raises unless ``AWS_S3_BUCKET``
is set, and ``boto3`` is imported lazily (and only then) so the backend
runs fine without it installed.
"""

import os
from pathlib import Path

UPLOADS_DIR = Path(__file__).resolve().parent.parent / "uploads"


class LocalStorage:
    """Save bytes to backend/uploads/<user_id>/<filename>."""

    def __init__(self, base_dir: Path | None = None):
        self.base_dir = Path(base_dir) if base_dir else UPLOADS_DIR

    def save(self, user_id: int, filename: str, content: bytes) -> Path:
        # Strip any directory components the client may have sent.
        safe_name = Path(filename).name
        dest_dir = self.base_dir / str(user_id)
        dest_dir.mkdir(parents=True, exist_ok=True)
        dest = dest_dir / safe_name
        dest.write_bytes(content)
        return dest

    def user_dir(self, user_id: int) -> Path:
        return self.base_dir / str(user_id)


class S3Storage:
    """Stub for the AWS deployment path.

    Raises RuntimeError unless AWS_S3_BUCKET is set. boto3 is imported
    lazily inside the methods so this module never requires it at import
    time.
    """

    def __init__(self, bucket: str | None = None,
                 region: str | None = None):
        self.bucket = bucket or os.environ.get("AWS_S3_BUCKET") or ""
        self.region = region or os.environ.get("AWS_REGION", "ap-south-1")
        if not self.bucket:
            raise RuntimeError("S3 not configured")

    def _client(self):
        import boto3  # lazy: only needed when S3 is actually configured

        return boto3.client("s3", region_name=self.region)

    def save(self, user_id: int, filename: str, content: bytes) -> str:
        key = f"uploads/{user_id}/{Path(filename).name}"
        self._client().put_object(Bucket=self.bucket, Key=key, Body=content)
        return f"s3://{self.bucket}/{key}"


def get_storage():
    """Local mode by default; S3 only when a bucket is configured."""
    if os.environ.get("AWS_S3_BUCKET"):
        return S3Storage()
    return LocalStorage()
