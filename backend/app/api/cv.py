import io
import time
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session
from pypdf import PdfReader

from app.auth import get_current_user
from app.deps import get_db
from app.models import CV, User
from app.schemas import CVOut
from app.services.matching import clear_all_jobs

UPLOAD_DIR = Path("uploads")

router = APIRouter(prefix="/cv", tags=["cv"])


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

    UPLOAD_DIR.mkdir(exist_ok=True)
    safe_name = f"user{user.id}_{int(time.time())}_{file.filename}"
    filepath = UPLOAD_DIR / safe_name
    contents = await file.read()
    filepath.write_bytes(contents)

    text = extract_pdf_text(contents)

    cv = CV(user_id=user.id, filename=safe_name, text=text)
    db.add(cv)
    db.commit()
    db.refresh(cv)
    clear_all_jobs(db)

    return {"id": cv.id, "filename": cv.filename, "url": f"/uploads/{cv.filename}"}


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
        url=f"/uploads/{cv.filename}",
    )
