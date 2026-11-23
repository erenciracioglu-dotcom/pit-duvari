// Pist krokileri: bacinger/f1-circuits (MIT) GeoJSON -> sade SVG yollari.
import fs from 'node:fs';
import path from 'node:path';
import { http, readJson, writeJson, log } from './util.mjs';

const SRC = 'https://raw.githubusercontent.com/bacinger/f1-circuits/master/f1-circuits.geojson';

// F1DB circuitId -> bacinger id
const MAP = {
  melbourne: 'au-1953', bahrain: 'bh-2002', shanghai: 'cn-2004', catalunya: 'es-1991', monaco: 'mc-1929', montreal: 'ca-1978',
  'paul-ricard': 'fr-1969', spielberg: 'at-1969', silverstone: 'gb-1948', hockenheimring: 'de-1932', hockenheim: 'de-1932',
  hungaroring: 'hu-1986', 'spa-francorchamps': 'be-1925', monza: 'it-1922', 'marina-bay': 'sg-2008', sirius: 'ru-2014', sochi: 'ru-2014',
  suzuka: 'jp-1962', austin: 'us-2012', 'mexico-city': 'mx-1962', interlagos: 'br-1940', 'yas-marina': 'ae-2009', imola: 'it-1953',
  nurburgring: 'de-1927', portimao: 'pt-2008', mugello: 'it-1914', sepang: 'my-1999', istanbul: 'tr-2005', zandvoort: 'nl-1948',
  'magny-cours': 'fr-1960', estoril: 'pt-1972', jacarepagua: 'br-1977', jeddah: 'sa-2021', miami: 'us-2022', lusail: 'qa-2004',
  madring: 'es-2026', baku: 'az-2016', 'las-vegas': 'us-2023', indianapolis: 'us-1909', 'buenos-aires': 'ar-1952', kyalami: 'za-1961',
  'watkins-glen': 'us-1956'
};

function simplify(pts, eps) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let maxD = 0, idx = -1;
    const [ax, ay] = pts[a], [bx, by] = pts[b];
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy);
    for (let i = a + 1; i < b; i++) {
      // kapali cizgide ilk ve son nokta ayni: dogru parcasi yerine noktaya uzaklik
      const d = len < 1e-9 ? Math.hypot(pts[i][0] - ax, pts[i][1] - ay) : Math.abs(dy * pts[i][0] - dx * pts[i][1] + bx * ay - by * ax) / len;
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (maxD > eps && idx > 0) { keep[idx] = 1; stack.push([a, idx], [idx, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}

function toPath(coords) {
  const lat0 = coords.reduce((s, c) => s + c[1], 0) / coords.length;
  const k = Math.cos((lat0 * Math.PI) / 180);
  let pts = coords.map(([lon, lat]) => [lon * k, -lat]);
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const minX = Math.min(...xs), minY = Math.min(...ys);
  const w0 = Math.max(...xs) - minX, h0 = Math.max(...ys) - minY;
  const s = 1000 / Math.max(w0, h0);
  pts = pts.map(([x, y]) => [(x - minX) * s, (y - minY) * s]);
  pts = simplify(pts, 1.2);
  const w = Math.round(w0 * s), h = Math.round(h0 * s);
  const d = 'M' + pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L') + 'Z';
  return { d, w, h };
}

export async function buildGeo(cacheDir, circuitIds) {
  const file = path.join(cacheDir, 'f1-circuits.geojson');
  let gj = readJson(file);
  const age = fs.existsSync(file) ? Date.now() - fs.statSync(file).mtimeMs : Infinity;
  if (!gj || age > 14 * 86400000) {
    try {
      gj = await http(SRC, { timeout: 30000 });
      writeJson(file, gj);
    } catch (e) {
      log('Pist krokileri indirilemedi:', e.message);
    }
  }
  if (!gj) return {};
  const byId = new Map(gj.features.map((f) => [f.properties.id, f]));
  const out = {};
  for (const id of circuitIds) {
    const f = byId.get(MAP[id]);
    if (!f || f.geometry?.type !== 'LineString') continue;
    out[id] = toPath(f.geometry.coordinates);
  }
  return out;
}
