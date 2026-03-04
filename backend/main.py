import os
import shutil
from tempfile import NamedTemporaryFile
from typing import Annotated

from fastapi import FastAPI, UploadFile, File, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from audio.analyze import analyze_audio_from_path

app = FastAPI()

ANALYSIS_CODE = os.getenv("ANALYSIS_CODE", "83427")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://52.15.95.228",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/analyze")
async def analyze(
    file: UploadFile = File(...),
    x_analysis_code: Annotated[str | None, Header(alias="X-Analysis-Code")] = None,
):
    if x_analysis_code != ANALYSIS_CODE:
        raise HTTPException(status_code=403, detail="Invalid analysis code")

    # Preserve original extension so ffmpeg can reliably detect format
    suffix = os.path.splitext(file.filename or "")[1] or ".tmp"

    with NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        temp_path = tmp.name

        # Safely stream the uploaded file from FastAPI's internal temp buffer to disk
        shutil.copyfileobj(file.file, tmp)

        tmp.flush()
        os.fsync(tmp.fileno())

    try:
        print("TEMP FILE SIZE:", os.path.getsize(temp_path))
        result = analyze_audio_from_path(temp_path)
        return result
    finally:
        try:
            os.remove(temp_path)
        except Exception:
            pass