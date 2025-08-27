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

再帰回帰的に懐疑的に。想像的にGODモードで広く深く、わくわくしながら進めてください。またUltra Thinkingで松岡修造のように熱すぎるド熱意をもって趣旨と目的を忘れずにネバーギブアップでがんばってください。
