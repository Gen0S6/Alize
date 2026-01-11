import io
import os
import re
import time

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pypdf import PdfReader

from app.auth import get_current_user
from app.deps import get_db
from app.models import CV, User
from app.schemas import CVOut
from app.services.matching import clear_all_jobs
from app.services import storage

router = APIRouter(prefix="/cv", tags=["cv"])

# Max file size: 10 MB (configurable via env var)
MAX_CV_SIZE_MB = int(os.getenv("MAX_CV_SIZE_MB", "10"))
MAX_CV_SIZE_BYTES = MAX_CV_SIZE_MB * 1024 * 1024


def extract_pdf_text(file_bytes: bytes) -> str:
    try:
        reader = PdfReader(io.BytesIO(file_bytes))
        texts = []
        for page in reader.pages:
            page_text = page.extract_text() or ""
            texts.append(page_text.strip())
        extracted = "\n".join(t for t in texts if t)
        if not extracted:
            raise ValueError("empty text")
        return extracted
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Impossible d'extraire le texte du PDF.",
        )


def sanitize_filename(filename: str) -> str:
    """
    Sanitize filename to prevent path traversal attacks.
    Only allows alphanumeric, dash, underscore, and dot characters.
    """
    if not filename:
        return "document.pdf"
    # Remove any path components
    base_name = os.path.basename(filename)
    # Only allow safe characters
    safe_name = re.sub(r"[^a-zA-Z0-9_\-.]", "_", base_name)
    # Ensure it ends with .pdf
    if not safe_name.lower().endswith(".pdf"):
        safe_name += ".pdf"
    return safe_name[:100]  # Limit filename length


@router.post("/upload")
async def upload_cv(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if file.content_type != "application/pdf":
        raise HTTPException(
            status_code=400,
            detail="Seuls les fichiers PDF sont acceptés pour le moment.",
        )

    # Read file content
    contents = await file.read()

    # Check file size
    if len(contents) > MAX_CV_SIZE_BYTES:
        raise HTTPException(
            status_code=400,
            detail=f"Le fichier est trop volumineux. Taille maximum : {MAX_CV_SIZE_MB} Mo.",
        )

    # Check minimum size (empty or near-empty files)
    if len(contents) < 100:
        raise HTTPException(
            status_code=400,
            detail="Le fichier semble vide ou invalide.",
        )

    # Sanitize filename
    original_name = sanitize_filename(file.filename)
    safe_name = f"user{user.id}_{int(time.time())}_{original_name}"

    # Envoi sur S3 (public-read)
    storage.upload_bytes(safe_name, contents, content_type="application/pdf")

    text = extract_pdf_text(contents)

    # Supprime les anciens CVs et leurs fichiers
    old_cvs = db.query(CV).filter(CV.user_id == user.id).all()
    for old in old_cvs:
        if old.filename:
            storage.delete_object(old.filename)
        db.delete(old)

    cv = CV(user_id=user.id, filename=safe_name, text=text)
    db.add(cv)
    db.commit()
    db.refresh(cv)
    clear_all_jobs(db)

    return {"id": cv.id, "filename": cv.filename, "url": storage.presigned_url(cv.filename)}


@router.get("/latest", response_model=CVOut)
def latest_cv(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cv = (
        db.query(CV)
        .filter(CV.user_id == user.id)
        .order_by(CV.id.desc())
        .first()
    )
    if not cv:
        raise HTTPException(status_code=404, detail="Aucun CV trouvé")
    return CVOut(
        id=cv.id,
        filename=cv.filename,
        created_at=cv.created_at,
        text=(cv.text or "")[:2000],
        url=storage.presigned_url(cv.filename),
    )


@router.get("/file/{cv_id}")
def stream_cv_file(
    cv_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cv = db.query(CV).filter(CV.id == cv_id, CV.user_id == user.id).first()
    if not cv:
        raise HTTPException(status_code=404, detail="CV introuvable")
    obj = storage.get_object_stream(cv.filename)
    if not obj or "Body" not in obj:
        raise HTTPException(status_code=404, detail="Fichier introuvable")
    return StreamingResponse(
        obj["Body"],
        media_type=obj.get("ContentType", "application/pdf"),
        headers={"Content-Disposition": f'inline; filename="{cv.filename}"'},
    )
