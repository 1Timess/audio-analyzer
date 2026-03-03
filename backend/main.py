import os
import shutil
from tempfile import NamedTemporaryFile
from typing import Annotated

from fastapi import FastAPI, UploadFile, File, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from audio.analyze import analyze_audio_from_path

app = FastAPI()

ANALYSIS_CODE = os.getenv("ANALYSIS_CODE", "12345")

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

    # 🔥 Stream upload directly to disk instead of loading into memory
    with NamedTemporaryFile(delete=False) as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name

    try:
        result = analyze_audio_from_path(tmp_path)
        return result
    finally:
        try:
            os.remove(tmp_path)
        except Exception:
            pass