from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from google.cloud import texttospeech
import io

app = FastAPI()

@app.get('/health')
def health():
    return {"ok": True}

@app.post('/tts')
async def tts(payload: dict):
    text = payload.get('text','テスト音声です')
    client = texttospeech.TextToSpeechClient()
    input_text = texttospeech.SynthesisInput(text=text)
    voice = texttospeech.VoiceSelectionParams(language_code='ja-JP', name='ja-JP-Standard-A')
    audio_config = texttospeech.AudioConfig(audio_encoding=texttospeech.AudioEncoding.MP3)
    audio = client.synthesize_speech(input=input_text, voice=voice, audio_config=audio_config)
    return StreamingResponse(io.BytesIO(audio.audio_content), media_type='audio/mpeg')

