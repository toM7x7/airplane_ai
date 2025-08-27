# Codex CLI × ローカルPoC青写真（Quest不要版）

> 目的：**ノートPC単体**で、Codex CLI を使って XR/飛行機トラッキングPoC を最短構築。週末に Quest 3 を繋げて実機化する前提。

---

## 0) 前提・開発環境
- OS：Windows 11 / macOS / Linux いずれか
- 必要ツール：Node 18+、Python 3.10+、Git、gcloud（任意）、Firebase CLI（任意）
- Codex CLI：`npm i -g @openai/codex` または `brew install codex`
- （Windowsで `spawn codex ENOENT` が出る場合）
  - `npm prefix -g` でグローバル bin パスを確認し、**PATH** に追加
  - 代替：GitHub リリースの単体バイナリを `codex.exe` として配置

---

## 1) モノレポ構成（Quest不要のローカル実行）
```
repo-root/
  AGENTS.md                 # Codex CLI に渡す“開発ガイドライン”
  README.md                 # 手順書（この文書の要約）
  webxr/
    index.html              # WebXR最小ページ（PCでも動作。エミュレータ推奨）
    config.js               # APIエンドポイント設定（flight-proxy/tts）
  services/
    flight-proxy/           # 近傍飛行機API（Node/Express）
      package.json
      index.js
    tts-explain/            # 解説テキスト→音声（FastAPI + GCP TTS）
      requirements.txt
      main.py
  scripts/
    codex-playbook.md       # Codexに投げるプロンプト集
```

---

## 2) サンプルファイル

### 2.1 `AGENTS.md`（Codex 全体ガイド）
```md
# Project Agents Notes

**Mission**: Build a local PoC for "AIキャラ×飛行機トラッキング".

**Constraints**
- Keep everything self-contained in this repo.
- Prefer small, composable modules. Write unit-friendly functions when reasonable.
- Use minimal dependencies.
- For web: plain Three.js + WebXR (no frameworks) and gracefully fallback on desktop.
- For services: Node/Express for flight-proxy; Python/FastAPI for TTS.

**Non-goals**
- No production auth, no DB migrations, no heavy build chains.

**Quality bars**
- Lint-free minimal code, readable comments.
- Clear README and `npm`/`uvicorn` scripts.

**Security**
- CORS allow only during dev. Never run shell commands unrelated to the task.

```

### 2.2 `webxr/config.js`
```js
export const CONFIG = {
  FLIGHT_ENDPOINT: "http://localhost:8080", // ← 後で Cloud Run URL でもOK
  TTS_ENDPOINT: "http://localhost:8081"      // ← 後で Cloud Run URL でもOK
};
```

### 2.3 `webxr/index.html`（PC動作＋Quest対応）
```html
<!doctype html><meta charset="utf-8"/>
<title>Flight Peek (Local)</title>
<style>body{font:16px system-ui;margin:16px}input{width:120px}</style>
<h1>Flight Peek (Local)</h1>
<p>
  Lat <input id="lat" value="35.5494"/>
  Lon <input id="lon" value="139.7798"/>
  <button id="search">Search Flights</button>
  <button id="play">Play TTS</button>
</p>
<pre id="out">Ready.</pre>
<hr/>
<button id="enterAR">Enter AR (if supported)</button>
<script type="module">
import { CONFIG } from './config.js';

const out = document.getElementById('out');
const $ = (s)=>document.querySelector(s);

$('#search').onclick = async () => {
  const lat = Number($('#lat').value), lon = Number($('#lon').value);
  const url = `${CONFIG.FLIGHT_ENDPOINT}/nearby?lat=${lat}&lon=${lon}&radius_km=100`;
  const r = await fetch(url); const j = await r.json();
  j.states.sort((a,b)=>{
    const d=(p)=>Math.hypot(p.lat-lat,p.lon-lon); return d(a)-d(b);
  });
  out.textContent = JSON.stringify({count:j.states.length, nearest:j.states[0]}, null, 2);
};

$('#play').onclick = async () => {
  const text = 'こちらは飛行機解説テスト音声です';
  const r = await fetch(`${CONFIG.TTS_ENDPOINT}/tts`,{
    method:'POST',headers:{'Content-Type':'application/json'},
    body: JSON.stringify({text})
  });
  const buf = await r.arrayBuffer();
  const blob = new Blob([buf],{type:'audio/mpeg'});
  new Audio(URL.createObjectURL(blob)).play();
};

// --- WebXR (Quest 3で有効化 / PCはエミュレータで確認) ---
const btn = document.getElementById('enterAR');
if (navigator.xr?.isSessionSupported) {
  navigator.xr.isSessionSupported('immersive-ar').then(supported => {
    btn.disabled = !supported; btn.textContent = supported? 'Enter AR' : 'AR not supported';
  });
}
btn.onclick = async () => {
  if (!navigator.xr) return alert('WebXR not available.');
  const xrSession = await navigator.xr.requestSession('immersive-ar');
  // ここでは“起動確認”のみ（描画はUnity移行後に本格化）。
  alert('WebXR AR session started!');
  xrSession.end();
};
</script>
```

### 2.4 `services/flight-proxy/package.json`
```json
{
  "name": "flight-proxy",
  "type": "module",
  "private": true,
  "scripts": {
    "dev": "node index.js",
    "start": "node index.js"
  },
  "dependencies": {
    "cors": "^2.8.5",
    "express": "^4.19.2",
    "node-fetch": "^3.3.2"
  }
}
```

### 2.5 `services/flight-proxy/index.js`
```js
import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();
app.use(cors());

const CACHE_MS = 60_000;
let cache = { ts: 0, data: null };

app.get('/nearby', async (req, res) => {
  const lat = Number(req.query.lat), lon = Number(req.query.lon);
  const radiusKm = Number(req.query.radius_km || 50);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return res.status(400).json({error:'lat/lon required'});

  const now = Date.now();
  if (!cache.data || now - cache.ts > CACHE_MS) {
    const r = await fetch('https://opensky-network.org/api/states/all');
    cache = { ts: now, data: await r.json() };
  }
  const states = (cache.data?.states||[])
    .map(s=>({ icao24:s[0], callsign:s[1]?.trim(), lon:s[5], lat:s[6], baro_alt:s[7], geo_alt:s[13], vel:s[9], hdg:s[10] }))
    .filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lon))
    .filter(p=> haversine(lat,lon,p.lat,p.lon) <= radiusKm);
  res.json({ states, fetchedAt: new Date().toISOString() });
});

function haversine(lat1,lon1,lat2,lon2){
  const R=6371e3, rad=x=>x*Math.PI/180;
  const dlat=rad(lat2-lat1), dlon=rad(lon2-lon1);
  const a = Math.sin(dlat/2)**2 + Math.cos(rad(lat1))*Math.cos(rad(lat2))*Math.sin(dlon/2)**2;
  return (2*R*Math.asin(Math.sqrt(a)))/1000; // km
}

const port=process.env.PORT||8080;
app.listen(port,()=>console.log('flight-proxy on',port));
```

### 2.6 `services/tts-explain/requirements.txt`
```
fastapi
uvicorn
google-cloud-texttospeech
```

### 2.7 `services/tts-explain/main.py`
```py
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
```

---

## 3) ローカル実行手順（Quest不要）
1. **flight-proxy**
   ```bash
   cd services/flight-proxy
   npm i
   npm run dev
   # → http://localhost:8080/nearby?lat=35.5494&lon=139.7798&radius_km=100
   ```
2. **tts-explain**（GCP 認証が必要：`gcloud auth application-default login` など）
   ```bash
   cd ../tts-explain
   python -m venv .venv && source .venv/bin/activate  # Windowsは .venv\Scripts\activate
   pip install -r requirements.txt
   uvicorn main:app --port 8081
   ```
3. **webxr**
   - `webxr/config.js` の URL がローカルを向いていることを確認
   - `index.html` をブラウザで開く（Chrome推奨）→ **Search** / **Play TTS** が動けばOK
   - （ARはPCでは非対応。**WebXRエミュレータ拡張**で起動確認可能）

---

## 4) Codex CLI で“自動組み立て”する場合のプレイブック
> 既存ファイルがない空ディレクトリで順に実行。`--ask-for-approval on-request` で安全寄りに。

### 4.1 ひな型を作る
```bash
codex --sandbox workspace-write --ask-for-approval on-request \
  "Create a monorepo with webxr (plain HTML+JS), services/flight-proxy (Node/Express), services/tts-explain (FastAPI). Add README with run steps."
```

### 4.2 APIの実装指示
```bash
codex exec --sandbox workspace-write --ask-for-approval on-request \
  "In services/flight-proxy, implement /nearby reading OpenSky states/all, cache 60s, filter by radius_km using haversine. ESM modules, CORS enabled."

codex exec --sandbox workspace-write --ask-for-approval on-request \
  "In services/tts-explain, implement POST /tts using google-cloud-texttospeech returning MP3 via StreamingResponse. Add requirements.txt and run doc."
```

### 4.3 Webの最小UI
```bash
codex exec --sandbox workspace-write --ask-for-approval on-request \
  "In webxr, create index.html + config.js with inputs for lat/lon and buttons to call /nearby and /tts, show nearest flight as JSON, and play MP3 via Audio."
```

> **非対話全自動**で走らせたい場合（慣れてきたら）：
```bash
codex exec --ask-for-approval never --sandbox workspace-write \
  "Set up and wire the three modules end-to-end and print curl examples."
```

---

## 5) エミュレータ＆実機移行
- **デスクトップでのAR起動確認**：Chrome拡張 *Immersive Web Emulator* を導入 → `webxr/index.html` から `Enter AR` を試す。
- **週末の実機（Quest 3）**：URL を Firebase Hosting に載せる or APK（Unity後）をサイドロード。

---

## 6) よくある詰まりと対策
- `spawn codex ENOENT`：Codex バイナリが **PATH** にない → npm のグローバル bin を PATH 追加。代替で単体バイナリ設置。
- CORS：`flight-proxy` に `app.use(cors())` を忘れがち→追加。
- TTS 認証：`gcloud auth application-default login` or サービスアカウント鍵を `GOOGLE_APPLICATION_CREDENTIALS` で指定。
- WebXR 非対応：PCは素では不可→**WebXR エミュレータ**でテスト。Quest ではブラウザから動作。

---

## 7) 次の拡張（Want）
- 任意キャラ（GLB/VRM）を `webxr` に読み込み → 周回/追従アニメ＋ボイス再生。
- 地図（2Dミニマップ）を `webxr` に追加 → 近傍機の相対位置を点描。
- Cloud Run 化：`flight-proxy` / `tts-explain` を Dockerfile 化→`gcloud run deploy --source .` で公開。

