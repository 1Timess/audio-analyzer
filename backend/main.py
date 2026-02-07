import os
from typing import Annotated

from fastapi import FastAPI, UploadFile, File, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from audio.analyze import analyze_audio

app = FastAPI()

# 🔐 Load the access code from env (never hardcode in prod)
ANALYSIS_CODE = os.getenv("ANALYSIS_CODE", "12345")

# CORS: If you proxy through nginx and the frontend calls "/analyze" on the same origin,
# CORS is not needed. Keeping it enabled with a safer default for local dev + your EC2 IP.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://52.15.95.228",
    ],
    allow_methods=["*"],
    allow_headers=["*"],  # allows X-Analysis-Code
)

@app.post("/analyze")
async def analyze(
    file: UploadFile = File(...),
    x_analysis_code: Annotated[str | None, Header(alias="X-Analysis-Code")] = None,
):
    # 🔐 Enforce access code
    if x_analysis_code != ANALYSIS_CODE:
        raise HTTPException(status_code=403, detail="Invalid analysis code")

    result = analyze_audio(await file.read())
    return result