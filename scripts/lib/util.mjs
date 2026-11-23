import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const UA = 'PitDuvari/1.0 (+https://erenciracioglu-dotcom.github.io/pit-duvari/)';

export class HttpError extends Error {
  constructor(status, url) {
    super(`HTTP ${status} ${url}`);
    this.status = status;
    this.url = url;
  }
}

const lastHit = new Map();

// fetch + zaman asimi + yeniden deneme + host basina asgari aralik (hiz siniri olan API'ler icin)
export async function http(url, { as = 'json', timeout = 30000, retries = 3, gap = 0, headers = {} } = {}) {
  const host = new URL(url).host;
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (gap) {
      const wait = (lastHit.get(host) || 0) + gap - Date.now();
      if (wait > 0) await sleep(wait);
      lastHit.set(host, Date.now());
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout);
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, ...headers }, signal: ctrl.signal, redirect: 'follow' });
      if (res.status === 429 || res.status >= 500) {
        const ra = Number(res.headers.get('retry-after')) || 0;
        lastErr = new HttpError(res.status, url);
        if (attempt < retries) {
          await sleep(Math.max(ra * 1000, 2000 * (attempt + 1) ** 2));
          continue;
        }
        throw lastErr;
      }
      if (!res.ok) throw new HttpError(res.status, url);
      if (as === 'json') return await res.json();
      if (as === 'text') return await res.text();
      return Buffer.from(await res.arrayBuffer());
    } catch (e) {
      lastErr = e;
      if (e instanceof HttpError && e.status < 500 && e.status !== 429) throw e;
      if (attempt === retries) throw e;
      await sleep(1000 * (attempt + 1));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr;
}

export function writeJson(file, obj, pretty = false) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(obj, null, pretty ? 1 : 0));
}

export function readJson(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

export function copyDir(src, dst) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name);
    const d = path.join(dst, e.name);
    if (e.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

export const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

export const sha1 = (s) => crypto.createHash('sha1').update(s).digest('hex');
export const sha256File = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

// F1DB tarih/saatleri UTC: "2026-03-08" + "04:00"
export function utcIso(date, time) {
  if (!date) return null;
  return `${date}T${time || '00:00'}:00Z`;
}

export function msToLap(ms) {
  if (ms == null || !isFinite(ms)) return null;
  const neg = ms < 0;
  ms = Math.abs(Math.round(ms));
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const r = ms % 1000;
  const core = h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(r).padStart(3, '0')}`
    : m ? `${m}:${String(s).padStart(2, '0')}.${String(r).padStart(3, '0')}`
      : `${s}.${String(r).padStart(3, '0')}`;
  return (neg ? '-' : '') + core;
}

export const secToLap = (s) => (s == null ? null : msToLap(s * 1000));

export function slug(s) {
  return String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function groupBy(rows, key) {
  const m = new Map();
  for (const r of rows) {
    const k = typeof key === 'function' ? key(r) : r[key];
    let a = m.get(k);
    if (!a) m.set(k, (a = []));
    a.push(r);
  }
  return m;
}

export function args() {
  const out = {};
  for (const a of process.argv.slice(2)) {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    if (m) out[m[1]] = m[2] === undefined ? true : m[2];
  }
  return out;
}
