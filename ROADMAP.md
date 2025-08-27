# Airplane AI – Progress, Next Steps, and AR Roadmap

Updated: 2025-08-26

## 1) Current State
- Monorepo scaffolded: `webxr/`, `services/flight-proxy/`, `services/tts-explain/`, docs and scripts.
- Flight proxy (Node/Express) running on `:8080`; proxies OpenSky with simple cache; `/nearby` endpoint filters by haversine.
- TTS service (FastAPI + GCP TTS) prepared on `:8081` with Web Speech fallback in front-end; ADC needed for real MP3.
- Front-end served via local HTTP (`:5173`):
  - Search shows nearest + top5 flights with distance/heading/altitude.
  - AR session renders reticle (1m) + info panel (2m), draws every frame, and shows HUD text; nearest flight refreshes every 15s.
  - Bearing-aware panel: panel rotates around camera to roughly point toward nearest flight (emulator/desktop limitations apply).

## 2) How To Resume (Quick Start)
- Start frontend + proxy (recommended):
  - Windows: double-click `scripts\start_frontend_and_proxy.bat`
  - Opens http://localhost:5173/ and runs proxy on :8080
- Start TTS (optional):
  - `scripts\start_tts.bat` (creates venv if absent) → `http://localhost:8081/health`
  - Enable ADC: `gcloud auth application-default login` or set `GOOGLE_APPLICATION_CREDENTIALS`
- Enter AR:
  - Desktop: Chrome + WebXR Emulator → click “Enter AR” on the page
  - Quest 3: open Oculus Browser → same LAN → visit `http://<PC-IP>:5173/`
    - If needed, serve publicly on LAN: `py -3 -m http.server 5173 --directory webxr --bind 0.0.0.0`

## 3) Known Issues / Limitations
- Desktop emulator shows grid background by design; camera passthrough available on Quest only.
- `heading` (device compass) may be unavailable on desktop; bearing panel becomes approximate.
- If Search shows “Failed to fetch”: proxy not running, port conflict, or firewall blocks.
- OpenSky rate limits/availability may cause 5xx from proxy (the app still functions).
- Current AR placement is camera-relative; no real-world anchoring yet.

## 4) Next Enhancements (Prioritized)
1) WebXR Hit Test + Anchors (AR quality)
- Enable `optionalFeatures: ["hit-test","anchors"]`
- Raycast from viewer/tap to plane; create anchor and attach a flight card quad (billboard)
- Keep nearest card updated; allow multiple anchors with decay/fade

2) Multi-flight Visualization (awareness)
- Show top-N bearings as small ring markers; highlight nearest with larger panel
- Add simple occlusion handling and alpha fading to reduce clutter

3) Data Loop & Tracking (stability)
- Poll every 15–30s; keep identity by `icao24`; smooth heading/altitude; show last-updated timestamp

4) Interaction (no extra UI)
- Tap/click to place card; dwell-on-reticle to select; pinch to scale (Quest hand-tracking optional)

5) Info Enrichment (clarity)
- Display speed (km/h), airline/callsign normalization, altitude in meters/feet toggle

6) TTS/Audio
- If ADC available, use GCP TTS MP3; else Web Speech fallback (already wired)
- Spatialize short prompts (Unity/native later)

## 5) Generative AI Capabilities (Planned)
- Natural-language explainer: generate Japanese summaries like “右前方にANAの◯◯便、高度◯◯m、東京湾上空を北東へ”。
- Conversational agent: voice commands to change search radius、フォーカス航空会社、過去ログ参照。
- Contextual narration: 航路や機材、機齢、就航路線の豆知識を動的生成（安全配慮した範囲で）。
- On-device fallback: ネット不安定時はローカル軽量モデルで短文生成（将来、端末性能に応じ選択）。

Implementation notes:
- Add `services/ai-orchestrator/` (Node or Python) to call an LLM API; redact PII; add rate limit; cache prompts/results.
- Front-end: `Explain`ボタン or 自動説明（一定間隔/ユーザー発話トリガ）→ TTSへ渡し音声再生。

## 6) Meta Quest Integration Paths
- WebXR on Quest (shortest path)
  - Modules: Hit Test, Anchors, DOM Overlay, Hand Tracking (`inputSources` pinch/air-tap)
  - Deliver via local LAN or HTTPS (self-signed/Cloudflare Tunnel)
- Native (Unity/Unreal) with OpenXR (production path)
  - Meta Presence Platform: Passthrough API, Scene/Plane, Anchors, Spatial Anchors、Mixed Reality Capture
  - AR UI: world-locked panels, reticle ray, selectable markers, spatialized audio
  - Bridge: reuse `flight-proxy` API; port front-end logic (bearing, selection) to C#

## 7) API Reference (Local)
- Flight Proxy: `GET /nearby?lat=<float>&lon=<float>&radius_km=<int>` → `{ states: [...] }`
- TTS: `POST /tts {text}` → MP3 bytes (ADC必要)

## 8) Troubleshooting
- “Failed to fetch” on Search: start `flight-proxy` or check port 8080 / firewall
- AR shows grid only: emulator仕様。描画確認は薄い画面オーバーレイと中央レティクルで判断
- “AR not supported”: WebXR or insecure context。`http://localhost:5173/` で確認
- Console: “Unchecked runtime.lastError … Receiving end …” → 拡張由来。無視可

## 9) Code Hotspots (Where to Work Next)
- Front-end: `webxr/index.html`
  - AR wiring: session init, `onXRFrame`、bearing panel、HUD（検索・更新間隔もここ）
  - Next: add hit test + anchors、multi-flight ring、tap to place
- Proxy: `services/flight-proxy/index.js`
  - Next: basic rate limit / fallback sample data for offline demo
- TTS: `services/tts-explain/main.py`
  - Next: guardrails（文字数制限、言語指定）、エラー時の丁寧なJSON

## 10) Resume Checklist
1. Run `scripts\start_frontend_and_proxy.bat` → open http://localhost:5173/
2. (Optional) Run `scripts\start_tts.bat` and sign in with `gcloud auth application-default login`
3. Verify Search works (top5 shown) and AR draws reticle + blue panel
4. Choose next enhancement:
   - Hit test + anchors / Multi-flight / Data enrichment / TTS explainer
5. Create a short branch `feat/ar-anchors` and implement in `webxr/index.html`

---

Notes:
- Keep dependencies minimal; prefer WebXR modules over heavy frameworks.
- Use small, composable functions and readable comments for AR math.
- Be mindful of API rate limits and CORS during dev only.
