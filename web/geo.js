// Lightweight geodesy helpers (WGS84) for AR ENU mapping

const a = 6378137.0; // semi-major axis (m)
const f = 1 / 298.257223563; // flattening
const e2 = f * (2 - f); // eccentricity squared

export function deg2rad(d) { return d * Math.PI / 180; }

export function geodeticToECEF(latDeg, lonDeg, h = 0) {
  const lat = deg2rad(latDeg);
  const lon = deg2rad(lonDeg);
  const sinLat = Math.sin(lat), cosLat = Math.cos(lat);
  const sinLon = Math.sin(lon), cosLon = Math.cos(lon);
  const N = a / Math.sqrt(1 - e2 * sinLat * sinLat);
  const x = (N + h) * cosLat * cosLon;
  const y = (N + h) * cosLat * sinLon;
  const z = (N * (1 - e2) + h) * sinLat;
  return { x, y, z };
}

export function ecefToENU(x, y, z, lat0Deg, lon0Deg, h0 = 0) {
  const { x: x0, y: y0, z: z0 } = geodeticToECEF(lat0Deg, lon0Deg, h0);
  const dx = x - x0, dy = y - y0, dz = z - z0;
  const lat0 = deg2rad(lat0Deg), lon0 = deg2rad(lon0Deg);
  const sinLat = Math.sin(lat0), cosLat = Math.cos(lat0);
  const sinLon = Math.sin(lon0), cosLon = Math.cos(lon0);
  // ENU axes
  const t = -sinLon * dx + cosLon * dy; // East
  const u = -sinLat * cosLon * dx - sinLat * sinLon * dy + cosLat * dz; // Up
  const s = cosLat * cosLon * dx + cosLat * sinLon * dy + sinLat * dz; // North
  return { e: t, n: s, u };
}

export function geodeticToENU(latDeg, lonDeg, h, origin) {
  const { x, y, z } = geodeticToECEF(latDeg, lonDeg, h || 0);
  return ecefToENU(x, y, z, origin.lat, origin.lon, origin.alt || 0);
}

