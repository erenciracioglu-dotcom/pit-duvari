// Kucuk yardimcilar: DOM kurucu, bicimlendirme, rastgelelik.
const SVGNS = 'http://www.w3.org/2000/svg';

function apply(el, attrs, isSvg) {
  if (!attrs) return;
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.setAttribute('class', Array.isArray(v) ? v.filter(Boolean).join(' ') : v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'value' && !isSvg) el.value = v;
    else if (k === 'checked' || k === 'disabled' || k === 'selected') { el[k] = !!v; if (v) el.setAttribute(k, ''); }
    else el.setAttribute(k, v === true ? '' : v);
  }
}

function append(el, kids) {
  for (const k of kids) {
    if (k == null || k === false || k === true) continue;
    if (Array.isArray(k)) append(el, k);
    else el.appendChild(k instanceof Node ? k : document.createTextNode(String(k)));
  }
}

export function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs instanceof Node || Array.isArray(attrs) || typeof attrs !== 'object' || attrs === null) {
    append(el, [attrs, ...kids]);
  } else {
    apply(el, attrs, false);
    append(el, kids);
  }
  return el;
}

export function s(tag, attrs, ...kids) {
  const el = document.createElementNS(SVGNS, tag);
  apply(el, attrs, true);
  append(el, kids);
  return el;
}

export const clear = (el) => { while (el.firstChild) el.removeChild(el.firstChild); return el; };
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const sum = (a) => a.reduce((x, y) => x + (y || 0), 0);
export const uniq = (a) => [...new Set(a)];
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export function groupBy(rows, key) {
  const m = new Map();
  for (const r of rows) {
    const k = typeof key === 'function' ? key(r) : r[key];
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(r);
  }
  return m;
}
export function debounce(fn, ms = 150) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

// puan: 0.5'li degerler (yarim puanli yarislar) icin
export function fmtPts(p) {
  if (p == null) return '0';
  const r = Math.round(p * 2) / 2;
  const loc = document.documentElement.lang === 'en' ? 'en-GB' : 'tr-TR';
  return r.toLocaleString(loc, { maximumFractionDigits: 1, useGrouping: Math.abs(r) >= 10000 });
}

export function lapToMs(s) {
  if (s == null || s === '') return null;
  if (typeof s === 'number') return s;
  const parts = String(s).split(':').map(Number);
  if (parts.some((x) => isNaN(x))) return null;
  let ms = 0;
  for (const p of parts) ms = ms * 60 + p;
  return Math.round(ms * 1000);
}

export function msToLap(ms, { plus = false } = {}) {
  if (ms == null || !isFinite(ms)) return '–';
  const neg = ms < 0;
  ms = Math.abs(Math.round(ms));
  const m = Math.floor(ms / 60000);
  const sec = Math.floor((ms % 60000) / 1000);
  const r = ms % 1000;
  const core = m ? `${m}:${String(sec).padStart(2, '0')}.${String(r).padStart(3, '0')}` : `${sec}.${String(r).padStart(3, '0')}`;
  return (neg ? '−' : plus ? '+' : '') + core;
}

export function hashStr(str) {
  let h1 = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h1 = Math.imul(h1 ^ str.charCodeAt(i), 3432918353);
    h1 = (h1 << 13) | (h1 >>> 19);
  }
  return (h1 >>> 0);
}

export function rng(seed) {
  let a = typeof seed === 'number' ? seed : hashStr(String(seed));
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle(arr, rand = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const isTimed = (iso) => typeof iso === 'string' && iso.includes('T');
export const todayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function download(filename, text, type = 'application/json') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = h('textarea', { style: { position: 'fixed', opacity: '0' } }, text);
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove();
    return ok;
  }
}

// null/false atlayan append
export function add(el, ...kids) {
  for (const k of kids.flat(Infinity)) if (k != null && k !== false && k !== true) el.append(k instanceof Node ? k : String(k));
  return el;
}
