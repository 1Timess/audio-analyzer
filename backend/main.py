import os
import shutil
from tempfile import NamedTemporaryFile
from typing import Annotated

from fastapi import FastAPI, UploadFile, File, Header, HTTPException, Request
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
    request: Request,
    x_analysis_code: Annotated[str | None, Header(alias="X-Analysis-Code")] = None,
):
    if x_analysis_code != ANALYSIS_CODE:
        raise HTTPException(status_code=403, detail="Invalid analysis code")

    with NamedTemporaryFile(delete=False) as tmp:
        tmp_path = tmp.name

        async for chunk in request.stream():
            tmp.write(chunk)

    try:
        result = analyze_audio_from_path(tmp_path)
        return result
    finally:
        try:
            os.remove(tmp_path)
        except Exception:
            pass