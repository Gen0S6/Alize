import logging
import os
from typing import Optional

import boto3

log = logging.getLogger(__name__)
from botocore.client import Config
from fastapi import HTTPException, status

# S3 configuration via environment variables
AWS_S3_BUCKET = os.getenv("AWS_S3_BUCKET", "").strip()
AWS_S3_REGION = os.getenv("AWS_S3_REGION", "").strip()
AWS_S3_ENDPOINT = os.getenv("AWS_S3_ENDPOINT", "").strip()  # optional custom endpoint
AWS_S3_BASE_URL = os.getenv("AWS_S3_BASE_URL", "").strip()  # optional public URL override
AWS_S3_FORCE_PATH_STYLE = os.getenv("AWS_S3_FORCE_PATH_STYLE", "false").lower() == "true"
AWS_S3_PRESIGN_TTL = int(os.getenv("AWS_S3_PRESIGN_TTL", "3600"))  # seconds; 0 to disable


def _require_config():
    if not AWS_S3_BUCKET:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="S3 non configuré. Ajoutez AWS_S3_BUCKET (et credentials) dans l'environnement.",
        )


def _client():
    _require_config()
    addressing_style = "path" if AWS_S3_FORCE_PATH_STYLE else "auto"
    return boto3.client(
        "s3",
        region_name=AWS_S3_REGION or None,
        endpoint_url=AWS_S3_ENDPOINT or None,
        config=Config(s3={"addressing_style": addressing_style}),
    )


def build_file_url(key: str) -> str:
    """Retourne une URL publique pour le fichier."""
    _require_config()
    if AWS_S3_BASE_URL:
        return f"{AWS_S3_BASE_URL.rstrip('/')}/{key}"
    if AWS_S3_ENDPOINT:
        # Safer en mode path-style
        base = AWS_S3_ENDPOINT.rstrip("/")
        return f"{base}/{AWS_S3_BUCKET}/{key}"
    if AWS_S3_REGION:
        return f"https://{AWS_S3_BUCKET}.s3.{AWS_S3_REGION}.amazonaws.com/{key}"
    # Region non fournie, fallback global
    return f"https://{AWS_S3_BUCKET}.s3.amazonaws.com/{key}"


def presigned_url(key: str) -> str:
    """Retourne une URL signée (lecture) si activé."""
    if AWS_S3_PRESIGN_TTL <= 0:
        return build_file_url(key)
    client = _client()
    return client.generate_presigned_url(
        ClientMethod="get_object",
        Params={"Bucket": AWS_S3_BUCKET, "Key": key},
        ExpiresIn=AWS_S3_PRESIGN_TTL,
    )


def upload_bytes(key: str, data: bytes, content_type: Optional[str] = None):
    client = _client()
    extra = {}
    if content_type:
        extra["ContentType"] = content_type
    # Bucket sans ACL publiques : on n'envoie pas d'ACL, la policy/permissions gèrent l'accès
    client.put_object(Bucket=AWS_S3_BUCKET, Key=key, Body=data, **extra)


def delete_object(key: str):
    client = _client()
    try:
        client.delete_object(Bucket=AWS_S3_BUCKET, Key=key)
    except Exception as exc:
        # Best effort, on n'empêche pas la suite mais on log
        log.warning("Failed to delete S3 object %s: %s", key, exc)


def get_object_stream(key: str):
    """Retourne l'objet S3 (stream) ou None si absent."""
    client = _client()
    try:
        return client.get_object(Bucket=AWS_S3_BUCKET, Key=key)
    except Exception as exc:
        log.warning("Failed to get S3 object %s: %s", key, exc)
        return None
