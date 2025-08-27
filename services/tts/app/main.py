import os
import uuid
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel


app = FastAPI(title="Local TTS Stub", version="0.1.0")

is_prod = os.getenv("ENV") == "production"
if not is_prod:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )


@app.get("/health")
def health():
    return {"ok": True}


class SpeakRequest(BaseModel):
    text: str
    voice: str | None = "ja-JP"


@app.post("/speak")
def speak(req: SpeakRequest):
    # Stub: 実TTSは未接続。将来ローカルTTSやSDKに差し替え。
    return {
        "id": str(uuid.uuid4()),
        "text": req.text,
        "voice": req.voice,
        "note": "TTS stub response (no audio)"
    }

