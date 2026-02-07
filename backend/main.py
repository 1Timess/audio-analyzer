import os
from fastapi import FastAPI, UploadFile, File, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from audio.analyze import analyze_audio

app = FastAPI()

# 🔐 Load the access code from env (never hardcode in prod)
ANALYSIS_CODE = os.getenv("ANALYSIS_CODE", "12345")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],  # IMPORTANT: allows X-Analysis-Code
)

@app.post("/analyze")
async def analyze(
    file: UploadFile = File(...),
    x_analysis_code: str | None = Header(default=None),
):
    # 🔐 Enforce access code
    if x_analysis_code != ANALYSIS_CODE:
        raise HTTPException(status_code=403, detail="Invalid analysis code")

    result = analyze_audio(await file.read())
    return result
