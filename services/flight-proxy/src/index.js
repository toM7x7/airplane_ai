/*
  Flight Proxy (Dev)
  - Minimal Express server exposing /flights with mock data
  - CORS is allowed only in non-production environments
*/

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const app = express();
app.use(express.json({ limit: '1mb' }));
const PORT = process.env.PORT || 8000;

const isProd = process.env.NODE_ENV === 'production';
const provider = (process.env.FLIGHT_PROVIDER || '').toLowerCase();
const OPENSKY_USER = process.env.OPENSKY_USER;
const OPENSKY_PASS = process.env.OPENSKY_PASS;
const CACHE_TTL_MS = Number(process.env.CACHE_TTL_MS || 5000);
if (!isProd) {
  app.use(cors());
}

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/', (_req, res) => {
  const body = `<!doctype html><html><meta charset="utf-8"><title>flight-proxy</title><body style="font-family:system-ui,sans-serif;line-height:1.6;padding:16px;">
  <h1>flight-proxy</h1>
  <p>provider: <b>${provider || 'mock'}</b> (set FLIGHT_PROVIDER=opensky)</p>
  <ul>
    <li><a href="/health">/health</a></li>
    <li><a href="/flights?lat=35.68&lon=139.76&radius=2">/flights?lat=35.68&lon=139.76&radius=2</a></li>
  </ul>
  <p>環境変数: OPENSKY_USER / OPENSKY_PASS（任意）</p>
  </body></html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(body);
});

function getJson(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const m = url.startsWith('https:') ? https : http;
    const req = m.request(url, { method: 'GET', headers }, (res) => {
      let buf = '';
      res.on('data', (c) => (buf += c));
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(`HTTP ${res.statusCode}`));
        }
        try {
          resolve(JSON.parse(buf));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function fetchOpenSky(lat, lon, radiusKm = 100) {
  const delta = Math.max(1, Math.min(4, radiusKm)) / 111; // deg approx, clamp
  const lamin = (lat - delta).toFixed(4);
  const lamax = (lat + delta).toFixed(4);
  const lomin = (lon - delta).toFixed(4);
  const lomax = (lon + delta).toFixed(4);
  const url = `https://opensky-network.org/api/states/all?lamin=${lamin}&lomin=${lomin}&lamax=${lamax}&lomax=${lomax}`;

  const headers = {};
  if (OPENSKY_USER && OPENSKY_PASS) {
    const b64 = Buffer.from(`${OPENSKY_USER}:${OPENSKY_PASS}`).toString('base64');
    headers.Authorization = `Basic ${b64}`;
  }
  const data = await getJson(url, headers);
  const flights = (data.states || []).map((s) => {
    // OpenSky indices:
    // 0: icao24, 1: callsign, 5: lon, 6: lat, 7: baro_altitude, 9: velocity (m/s), 10: heading (deg), 13: geo_altitude
    const lat = s[6];
    const lon = s[5];
    const alt = s[13] ?? s[7] ?? 0;
    const speed = s[9] ?? 0;
    const heading = s[10] ?? 0;
    return {
      id: s[0],
      callsign: (s[1] || '').trim(),
      lat, lon, alt, speed, heading,
    };
  }).filter(f => Number.isFinite(f.lat) && Number.isFinite(f.lon));
  return { source: 'opensky', generatedAt: new Date().toISOString(), flights };
}

async function loadFlightsFromMock() {
  const file = path.join(__dirname, '..', 'data', 'sample_flights.json');
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

app.get('/flights', async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat || '35.68');
    const lon = parseFloat(req.query.lon || '139.76');
    const radius = parseFloat(req.query.radius || '2'); // km
    const key = `${provider}|${lat.toFixed(3)},${lon.toFixed(3)}|${radius}`;
    const now = Date.now();
    if (!app._cache) app._cache = new Map();
    const cached = app._cache.get(key);
    if (cached && (now - cached.t) < CACHE_TTL_MS) {
      return res.json(cached.data);
    }

    let json;
    if (provider === 'opensky') {
      json = await fetchOpenSky(lat, lon, radius);
    } else {
      json = await loadFlightsFromMock();
    }
    app._cache.set(key, { t: now, data: json });
    res.json(json);
  } catch (err) {
    console.error('Failed to load flight data:', err);
    try {
      const fallback = await loadFlightsFromMock();
      res.json(fallback);
    } catch (e2) {
      res.status(500).json({ error: 'Failed to load flight data' });
    }
  }
});

function postJson(url, { headers = {}, body }) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const data = Buffer.from(JSON.stringify(body));
    const opts = {
      method: 'POST',
      hostname: u.hostname,
      path: u.pathname + (u.search || ''),
      port: u.protocol === 'https:' ? 443 : 80,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
        ...headers,
      },
    };
    const m = u.protocol === 'https:' ? https : http;
    const req = m.request(opts, (res) => {
      let buf = '';
      res.on('data', (c) => (buf += c));
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(`HTTP ${res.statusCode}: ${buf}`));
        }
        try { resolve(JSON.parse(buf)); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

app.post('/chat', async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  const input = (req.body && String(req.body.input || '').slice(0, 4000)) || '';
  const system = (req.body && String(req.body.system || '')) || '';
  if (!input) return res.status(400).json({ error: 'input required' });
  try {
    if (!apiKey) {
      return res.json({
        provider: 'stub',
        text: `（Stub応答）${input}`,
      });
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${encodeURIComponent(apiKey)}`;
    const body = {
      contents: [
        system ? { role: 'user', parts: [{ text: system }] } : null,
        { role: 'user', parts: [{ text: input }] },
      ].filter(Boolean),
    };
    const json = await postJson(url, { body });
    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    res.json({ provider: 'gemini', text });
  } catch (e) {
    console.error('chat error:', e);
    res.status(500).json({ error: 'chat failed' });
  }
});

app.listen(PORT, () => {
  console.log(`flight-proxy listening on http://localhost:${PORT}`);
});
