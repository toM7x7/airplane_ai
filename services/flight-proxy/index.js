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

  try {
    const now = Date.now();
    if (!cache.data || now - cache.ts > CACHE_MS) {
      const r = await fetch('https://opensky-network.org/api/states/all');
      if (!r.ok) throw new Error(`opensky ${r.status}`);
      cache = { ts: now, data: await r.json() };
    }
    const states = (cache.data?.states||[])
      .map(s=>({ icao24:s[0], callsign:s[1]?.trim(), lon:s[5], lat:s[6], baro_alt:s[7], geo_alt:s[13], vel:s[9], hdg:s[10] }))
      .filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lon))
      .filter(p=> haversine(lat,lon,p.lat,p.lon) <= radiusKm);
    res.json({ states, fetchedAt: new Date().toISOString() });
  } catch (e) {
    res.status(502).json({ error: String(e) });
  }
});

function haversine(lat1,lon1,lat2,lon2){
  const R=6371e3, rad=x=>x*Math.PI/180;
  const dlat=rad(lat2-lat1), dlon=rad(lon2-lon1);
  const a = Math.sin(dlat/2)**2 + Math.cos(rad(lat1))*Math.cos(rad(lat2))*Math.sin(dlon/2)**2;
  return (2*R*Math.asin(Math.sqrt(a)))/1000; // km
}

const port=process.env.PORT||8080;
app.listen(port,()=>console.log('flight-proxy on',port));

