# Codex Playbook (Local PoC)

- Create skeleton
```
codex "Create monorepo: webxr (plain HTML+JS), services/flight-proxy (Node/Express), services/tts-explain (FastAPI)."
```

- Implement flight-proxy API
```
codex "In services/flight-proxy, add an Express server with /nearby that proxies OpenSky states/all and filters by haversine distance."
```

- Implement TTS API
```
codex "In services/tts-explain, create FastAPI with POST /tts that uses Google Cloud Text-to-Speech to return MP3 bytes."
```

- Frontend wiring
```
codex "In webxr/index.html, add basic UI to call flight-proxy and tts endpoints, with WebXR session start button."
```

