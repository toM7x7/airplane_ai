// Minimal Three.js + WebXR bootstrap with desktop fallback
import { geodeticToENU } from './geo.js';

async function loadThree() {
  try {
    return await import('./lib/three.module.js');
  } catch (e) {
    console.warn('Local three not found. Falling back to CDN.');
    return await import('https://unpkg.com/three@0.161.0?module');
  }
}

async function loadExample(modulePath, cdnPath) {
  try {
    return await import(modulePath);
  } catch (e) {
    return await import(cdnPath);
  }
}

async function main() {
  const THREE = await loadThree();
  const { OrbitControls } = await loadExample(
    './lib/OrbitControls.js',
    'https://unpkg.com/three@0.161.0/examples/jsm/controls/OrbitControls.js?module'
  );
  const { ARButton } = await loadExample(
    './lib/ARButton.js',
    'https://unpkg.com/three@0.161.0/examples/jsm/webxr/ARButton.js?module'
  );

  const app = document.getElementById('app');
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0e13);

  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.01, 1000);
  camera.position.set(0, 2, 5);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  app.appendChild(renderer.domElement);

  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const dir = new THREE.DirectionalLight(0xffffff, 0.8);
  dir.position.set(5, 10, 7);
  scene.add(dir);

  const grid = new THREE.GridHelper(20, 20, 0x93c5fd, 0x475569);
  scene.add(grid);

  const markers = [];
  const labels = new Map();
  let currentFlights = [];
  let selectedIndex = -1;
  let isAR = false;

  const cfg = (window.AI_CONFIG || {});
  const FLIGHT_PROXY = cfg.FLIGHT_PROXY || 'http://localhost:8000';
  const TTS_API = cfg.TTS_API || 'http://localhost:8001';
  const CHAT_API = cfg.CHAT_API || `${FLIGHT_PROXY}`; // /chat on same proxy by default
  const SCALE = 0.001; // meters -> world units (AR)
  let origin = { lat: 35.6812, lon: 139.7671, alt: 0 }; // default: 東京駅付近
  let showFlights = true;

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  function setLoading(v) {
    const el = document.getElementById('loading');
    if (el) el.style.display = v ? 'block' : 'none';
  }

  function setMarkersVisible(v) {
    markers.forEach(m => m.visible = v);
    labels.forEach(sp => sp.visible = v);
  }

  function makePlaneMarker(color = 0x3b82f6) {
    const g = new THREE.BoxGeometry(0.3, 0.1, 0.6);
    const m = new THREE.MeshStandardMaterial({ color });
    const mesh = new THREE.Mesh(g, m);
    mesh.castShadow = true;
    return mesh;
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fill();
  }

  function makeLabel(text) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const pad = 6; const fs = 22; const font = `${fs}px system-ui, sans-serif`;
    ctx.font = font;
    const w = Math.ceil(ctx.measureText(text).width) + pad * 2;
    const h = fs + pad * 2;
    canvas.width = w * 2; canvas.height = h * 2; // hi-dpi
    const ctx2 = canvas.getContext('2d');
    ctx2.scale(2, 2);
    ctx2.font = font;
    ctx2.fillStyle = 'rgba(17,24,39,0.85)';
    roundRect(ctx2, 0, 0, w, h, 6);
    ctx2.fillStyle = '#e5e7eb';
    ctx2.fillText(text, pad, h - pad - 2);
    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
    const sp = new THREE.Sprite(mat);
    sp.scale.set(w / 100, h / 100, 1);
    return sp;
  }

  function latLonToXZ(lat, lon) {
    // Relative to current origin using equirectangular approximation
    const Rkm = 111; // km per deg
    const dLat = (lat - origin.lat);
    const dLon = (lon - origin.lon);
    const m = Math.cos(THREE.MathUtils.degToRad((lat + origin.lat) / 2));
    const dxKm = dLon * Rkm * m;
    const dzKm = dLat * Rkm;
    const KM_TO_UNIT = 0.05; // 1 unit = 20km
    return { x: dxKm * KM_TO_UNIT, z: dzKm * KM_TO_UNIT };
  }

  async function fetchFlights() {
    try {
      const rEl = document.getElementById('radius');
      const radius = Math.max(1, parseFloat((rEl && (rEl.value || rEl.placeholder)) || '30'));
      const url = `${FLIGHT_PROXY}/flights?lat=${encodeURIComponent(origin.lat)}&lon=${encodeURIComponent(origin.lon)}&radius=${radius}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const flights = data.flights || [];
      updateStatus(data.source || 'unknown', flights.length);
      return flights;
    } catch (e) {
      console.warn('flights fetch failed:', e);
      updateStatus('error', 0);
      return [];
    }
  }

  function updateStatus(source, count) {
    let el = document.getElementById('status');
    if (!el) {
      el = document.createElement('div');
      el.id = 'status';
      el.style.position = 'absolute';
      el.style.top = '8px';
      el.style.right = '8px';
      el.style.fontSize = '12px';
      el.style.opacity = '0.8';
      el.style.background = 'rgba(17,24,39,.5)';
      el.style.padding = '4px 6px';
      el.style.borderRadius = '4px';
      document.body.appendChild(el);
    }
    el.textContent = `source: ${source} | flights: ${count}`;
  }

  async function refreshMarkers() {
    setLoading(true);
    const flights = await fetchFlights();
    currentFlights = flights;
    // Clear existing
    markers.splice(0).forEach((m) => scene.remove(m));
    labels.forEach((sp) => scene.remove(sp));
    labels.clear();

    for (let i = 0; i < flights.length; i++) {
      const f = flights[i];
      const marker = makePlaneMarker();
      if (isAR) {
        const enu = geodeticToENU(f.lat, f.lon, (f.alt || 0), origin);
        marker.position.set(enu.e * SCALE, Math.max(0.1, enu.u * SCALE), -enu.n * SCALE);
      } else {
        const { x, z } = latLonToXZ(f.lat, f.lon);
        marker.position.set(x, 0.1 + (f.alt || 0) / 50000, z);
      }
      marker.rotation.y = THREE.MathUtils.degToRad(-(f.heading || 0));
      scene.add(marker);
      markers.push(marker);

      const label = makeLabel(`${i + 1}: ${f.callsign || f.id || 'FLIGHT'}`);
      label.position.copy(marker.position.clone().add(new THREE.Vector3(0, 0.25, 0)));
      scene.add(label);
      labels.set(marker.uuid, label);
    }
    updateFlightList(flights);
    if (!flights.length) {
      const ghost = makePlaneMarker(0x64748b);
      ghost.position.set(0, 0.2, 0);
      scene.add(ghost);
      markers.push(ghost);
    }
    setMarkersVisible(showFlights);
    setLoading(false);
    // keep non-selected by default; user can select from list or scene
  }

  function updateFlightList(flights) {
    const list = document.getElementById('flightList');
    if (!list) return;
    list.innerHTML = '';
    flights.forEach((f, idx) => {
      const div = document.createElement('div');
      div.className = 'item';
      const title = (f.callsign || f.id || 'FLIGHT').trim();
      const alt = Math.round((f.alt || 0));
      const spd = Math.round((f.speed || 0) * 1.94384);
      const h = Math.round(f.heading || 0);
      div.innerHTML = `<div><div>${title}</div><div class="meta">alt ${alt}m / hdg ${h} / spd ${spd}kt</div></div><div>#${idx + 1}</div>`;
      div.addEventListener('click', () => selectFlight(idx, true));
      list.appendChild(div);
    });
    refreshListSelection();
  }

  function refreshListSelection() {
    const list = document.getElementById('flightList');
    if (!list) return;
    Array.from(list.children).forEach((el, idx) => {
      if (el.classList) el.classList.toggle('selected', idx === selectedIndex);
    });
  }

  function selectFlight(index, announce) {
    const marker = markers[index];
    if (!marker) return;
    selectedIndex = index;
    markers.forEach((m) => m.material.color.setHex(COLOR_DEFAULT));
    marker.material.color.setHex(COLOR_SELECTED);
    const lbl = labels.get(marker.uuid);
    if (lbl) lbl.visible = true;
    controls.target.copy(marker.position);
    camera.lookAt(marker.position);
    refreshListSelection();
    updateHUD();
    if (announce) {
      const f = currentFlights[index];
      if (f) {
        const msg = `フライト ${f.callsign || f.id}、高度 ${Math.round((f.alt||0)/100)}百フィート、方位 ${Math.round(f.heading||0)}。`;
        speak(msg);
      }
    }
  }

  function updateHUD() {
    const hud = document.getElementById('hud');
    if (!hud) return;
    const f = currentFlights[selectedIndex];
    if (!f) { hud.style.display = 'none'; return; }
    const enu = geodeticToENU(f.lat, f.lon, (f.alt||0), origin);
    const dist = Math.sqrt(enu.e*enu.e + enu.n*enu.n) / 1000; // km ground distance
    const bearing = Math.atan2(enu.e, enu.n) * 180 / Math.PI; // deg from north
    const altm = Math.round(f.alt || 0);
    const spdkt = Math.round((f.speed || 0) * 1.94384);
    hud.innerHTML = `選択: <b>${(f.callsign || f.id || 'FLIGHT').trim()}</b> | 距離 ${dist.toFixed(1)} km | 方位 ${Math.round((bearing+360)%360)}° | 高度 ${altm} m | 速度 ${spdkt} kt`;
    hud.style.display = 'block';
  }

  function highlightByGaze() {
    if (!markers.length) return null;
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).normalize();
    let best = null; let bestAng = 180;
    const camPos = new THREE.Vector3();
    camera.getWorldPosition(camPos);
    for (const m of markers) {
      const v = m.position.clone().sub(camPos).normalize();
      const d = THREE.MathUtils.clamp(forward.dot(v), -1, 1);
      const ang = THREE.MathUtils.radToDeg(Math.acos(d));
      if (ang < bestAng) { bestAng = ang; best = m; }
    }
    const selected = selectedIndex >= 0 ? markers[selectedIndex] : null;
    markers.forEach((m) => {
      if (m === selected) {
        m.material.color.setHex(COLOR_SELECTED);
      } else if (m === best && bestAng < 10) {
        m.material.color.setHex(0xfbbf24);
      } else {
        m.material.color.setHex(COLOR_DEFAULT);
      }
      const lbl = labels.get(m.uuid);
      if (lbl) lbl.visible = (m === selected) || (m === best && bestAng < 15);
      if (lbl) lbl.lookAt(camera.position);
    });
    return bestAng < 10 ? best : null;
  }

  async function speak(text) {
    try {
      await fetch(`${TTS_API}/speak`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice: 'ja-JP' })
      });
    } catch {}
    if ('speechSynthesis' in window) {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'ja-JP';
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    }
  }

  function logChat(text) {
    const log = document.getElementById('chatLog');
    if (!log) return;
    const line = document.createElement('div');
    line.textContent = text;
    log.appendChild(line);
    log.scrollTop = log.scrollHeight;
  }

  async function chatSend(text) {
    try {
      const r = await fetch(`${CHAT_API}/chat`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: text })
      });
      if (!r.ok) throw new Error('chat http ' + r.status);
      const j = await r.json();
      return j.text;
    } catch (e) {
      console.warn('chat failed', e);
      return '（通信に失敗しました）';
    }
  }

  function typeOut(text) {
    const log = document.getElementById('chatLog');
    if (!log) return;
    const line = document.createElement('div');
    log.appendChild(line);
    let i = 0;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const audioCtx = AudioCtx ? new AudioCtx() : null;
    let lastBeep = 0;
    const t = setInterval(() => {
      line.textContent = text.slice(0, i++);
      log.scrollTop = log.scrollHeight;
      if (audioCtx && i - lastBeep > 3) {
        const o = audioCtx.createOscillator(); const g = audioCtx.createGain();
        o.type = 'square'; o.frequency.value = 880; g.gain.value = 0.02;
        o.connect(g).connect(audioCtx.destination); o.start();
        setTimeout(() => { o.stop(); o.disconnect(); g.disconnect(); }, 40);
        lastBeep = i;
      }
      if (i > text.length) clearInterval(t);
    }, 15);
  }

  // UI wiring
  const speakBtn = document.getElementById('speakBtn');
  if (speakBtn) {
    speakBtn.addEventListener('click', async () => {
      const flights = currentFlights.length ? currentFlights : await fetchFlights();
      if (!flights.length) return speak('フライト情報が取得できませんでした。');
      const f = flights[0];
      const msg = `フライト ${f.callsign || f.id}、高度 ${Math.round((f.alt||0)/100)}百フィート、方位 ${f.heading||0} です。`;
      speak(msg);
    });
  }

  const setBtn = document.getElementById('setCenter');
  if (setBtn) {
    setBtn.addEventListener('click', async () => {
      const latEl = document.getElementById('lat');
      const lonEl = document.getElementById('lon');
      const lat = parseFloat(latEl.value || latEl.placeholder);
      const lon = parseFloat(lonEl.value || lonEl.placeholder);
      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        origin.lat = lat; origin.lon = lon;
        await refreshMarkers();
        speak(`中心を緯度${lat.toFixed(3)}、経度${lon.toFixed(3)}に設定しました。`);
      }
    });
  }

  const myLocBtn = document.getElementById('myLoc');
  if (myLocBtn && navigator.geolocation) {
    myLocBtn.addEventListener('click', () => {
      navigator.geolocation.getCurrentPosition(async (pos) => {
        origin.lat = pos.coords.latitude;
        origin.lon = pos.coords.longitude;
        await refreshMarkers();
        speak('現在地を中心に設定しました。');
        const latEl = document.getElementById('lat');
        const lonEl = document.getElementById('lon');
        if (latEl) latEl.value = origin.lat.toFixed(4);
        if (lonEl) lonEl.value = origin.lon.toFixed(4);
      });
    });
  }

  const fetchBtn = document.getElementById('fetchNow');
  if (fetchBtn) fetchBtn.addEventListener('click', () => refreshMarkers());

  const toggleBtn = document.getElementById('toggleFlights');
  if (toggleBtn) toggleBtn.addEventListener('click', () => {
    showFlights = !showFlights;
    setMarkersVisible(showFlights);
  });

  function clearSelection() {
    selectedIndex = -1;
    markers.forEach((m) => m.material.color.setHex(COLOR_DEFAULT));
    const hud = document.getElementById('hud');
    if (hud) hud.style.display = 'none';
    refreshListSelection();
    // hide all labels; gaze will show current focus
    labels.forEach((sp) => sp.visible = false);
  }

  const clearBtn = document.getElementById('clearSel');
  if (clearBtn) clearBtn.addEventListener('click', clearSelection);

  // Background click to select/deselect
  renderer.domElement.addEventListener('pointerdown', (ev) => {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(markers, false);
    if (intersects && intersects.length) {
      const obj = intersects[0].object;
      const idx = markers.indexOf(obj);
      if (idx >= 0) selectFlight(idx, true);
    } else {
      clearSelection();
    }
  });

  const sendBtn = document.getElementById('sendPrompt');
  if (sendBtn) {
    sendBtn.addEventListener('click', async () => {
      const ta = document.getElementById('prompt');
      const content = (ta && ta.value.trim()) || '';
      if (!content) return;
      ta.value = '';
      logChat('> ' + content);
      const res = await chatSend(content);
      typeOut(res || '（応答なし）');
    });
  }

  // WebXR setup (AR if available)
  if (navigator.xr) {
    renderer.xr.enabled = true;
    const button = ARButton.createButton(renderer, { requiredFeatures: [] });
    document.body.appendChild(button);
    renderer.xr.addEventListener('sessionstart', async () => {
      isAR = true;
      grid.visible = false;
      try {
        origin = await new Promise((resolve) => {
          if (!navigator.geolocation) return resolve(origin);
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude, alt: pos.coords.altitude || 0 }),
            () => resolve(origin),
            { enableHighAccuracy: true, timeout: 3000 }
          );
        });
      } catch {}
      await refreshMarkers();
    });
    renderer.xr.addEventListener('sessionend', () => {
      isAR = false;
      grid.visible = true;
      refreshMarkers();
    });
    const session = renderer.xr.getSession?.();
    if (session) {
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  const COLOR_DEFAULT = 0x3b82f6;
  const COLOR_SELECTED = 0xf59e0b;
      session.addEventListener('select', () => {
        const m = highlightByGaze();
        if (!m) return;
        const idx = markers.indexOf(m);
        if (idx >= 0) selectFlight(idx, true);
      });
    } else {
      renderer.xr.addEventListener('sessionstart', () => {
        const s = renderer.xr.getSession();
        s.addEventListener('select', () => {
          const m = highlightByGaze();
          if (!m) return;
          const idx = markers.indexOf(m);
          if (idx >= 0) selectFlight(idx, true);
        });
      });
    }
  }

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  await refreshMarkers();
  setInterval(() => { if (!isAR) refreshMarkers(); }, 10000);

  renderer.setAnimationLoop(() => {
    controls.update();
    highlightByGaze();
    renderer.render(scene, camera);
  });
}

main().catch((e) => console.error(e));
