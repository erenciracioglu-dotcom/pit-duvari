// Dil ve bicimlendirme. Metinler kullanildiklari yerde L('Turkce', 'English') ile yazilir.
import { GP_TR, SESSION_LABEL, SESSION_SHORT, REASON_TR, TYRE } from './names.js';
import { isTimed } from './util.js';

let LANG = 'tr';
let TZ = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Istanbul'; } catch { return 'Europe/Istanbul'; } })();
const DEVICE_TZ = TZ;

export function setLocale({ lang, tz } = {}) {
  if (lang) LANG = lang === 'en' ? 'en' : 'tr';
  TZ = tz || DEVICE_TZ;
  document.documentElement.lang = LANG;
  cache.clear();
}
export const lang = () => LANG;
export const tz = () => TZ;
export const deviceTz = () => DEVICE_TZ;
export const L = (tr, en) => (LANG === 'en' && en != null ? en : tr);
const locale = () => (LANG === 'tr' ? 'tr-TR' : 'en-GB');

const cache = new Map();
function fmt(opts) {
  const key = JSON.stringify(opts);
  if (!cache.has(key)) cache.set(key, new Intl.DateTimeFormat(locale(), { timeZone: TZ, ...opts }));
  return cache.get(key);
}
const toDate = (x) => (x instanceof Date ? x : typeof x === 'number' ? new Date(x) : isTimed(x) ? new Date(x) : new Date(x + 'T12:00:00Z'));

export function fmtDay(x, { weekday = true, year = false } = {}) {
  if (!x) return '';
  const o = { day: 'numeric', month: 'short' };
  if (weekday) o.weekday = 'short';
  if (year) o.year = 'numeric';
  if (!isTimed(x) && typeof x === 'string') return new Intl.DateTimeFormat(locale(), { ...o, timeZone: 'UTC' }).format(toDate(x));
  return fmt(o).format(toDate(x));
}
export function fmtDate(x, opts = { day: 'numeric', month: 'long', year: 'numeric' }) {
  if (!x) return '';
  if (!isTimed(x) && typeof x === 'string') return new Intl.DateTimeFormat(locale(), { ...opts, timeZone: 'UTC' }).format(toDate(x));
  return fmt(opts).format(toDate(x));
}
export const fmtTime = (x) => (x && (isTimed(x) || typeof x === 'number' || x instanceof Date) ? fmt({ hour: '2-digit', minute: '2-digit', hour12: false }).format(toDate(x)) : L('saat belli değil', 'time TBC'));
export const fmtWeekday = (x) => fmt({ weekday: 'long' }).format(toDate(x));
export function fmtRange(a, b) {
  if (!a) return '';
  const da = toDate(a), db = toDate(b || a);
  const f = new Intl.DateTimeFormat(locale(), { day: 'numeric', month: 'short', timeZone: 'UTC' });
  if (da.getUTCMonth() === db.getUTCMonth()) return `${da.getUTCDate()}–${f.format(db)}`;
  return `${f.format(da)} – ${f.format(db)}`;
}
export function fmtRel(ms, now = Date.now()) {
  const d = ms - now;
  const rtf = new Intl.RelativeTimeFormat(locale(), { numeric: 'auto' });
  const a = Math.abs(d);
  if (a < 60000) return L('az önce', 'just now');
  if (a < 3600000) return rtf.format(Math.round(d / 60000), 'minute');
  if (a < 86400000) return rtf.format(Math.round(d / 3600000), 'hour');
  if (a < 7 * 86400000) return rtf.format(Math.round(d / 86400000), 'day');
  return fmtDay(ms, { weekday: false, year: new Date(ms).getFullYear() !== new Date(now).getFullYear() });
}
export function tzLabel() {
  if (TZ === 'Europe/Istanbul') return L('Türkiye saati', 'Türkiye time');
  const city = TZ.split('/').pop().replace(/_/g, ' ');
  return L(`${city} saati`, `${city} time`);
}

let regionNames = null;
export function countryName(ref, countryId) {
  const c = ref?.countries?.[countryId];
  if (!c) return countryId || '';
  try {
    if (!regionNames || regionNames._l !== LANG) { regionNames = new Intl.DisplayNames([locale()], { type: 'region' }); regionNames._l = LANG; }
    return regionNames.of(c.a2) || c.n;
  } catch { return c.n; }
}
export const flagCode = (ref, countryId) => ref?.countries?.[countryId]?.a2?.toLowerCase() || null;

export function gpName(ref, gpId) {
  if (LANG === 'tr' && GP_TR[gpId]) return GP_TR[gpId];
  return ref?.gps?.[gpId]?.s || gpId;
}
export const gpFull = (ref, gpId) => (LANG === 'tr' ? (GP_TR[gpId] || '').replace(/ GP$/, " Grand Prix'si") : ref?.gps?.[gpId]?.n) || gpName(ref, gpId);
export const sessionLabel = (k, short = false) => (short ? SESSION_SHORT : SESSION_LABEL)[LANG][k] || k;
export const reasonText = (st) => (LANG === 'tr' ? REASON_TR[st] || st : st);
export const tyreName = (c) => (TYRE[c] || TYRE.UNKNOWN)[LANG];

export function driverName(ref, id, style = 'full') {
  const d = ref?.drivers?.[id];
  if (!d) return id ? id.replace(/-/g, ' ') : '?';
  if (style === 'last') return d.l || d.n;
  if (style === 'code') return d.a || (d.l || d.n).slice(0, 3).toUpperCase();
  return d.n;
}
export const teamName = (ref, id) => ref?.constructors?.[id]?.n || (id ? id.replace(/-/g, ' ') : '?');
export const circuitName = (ref, id) => ref?.circuits?.[id]?.fn || ref?.circuits?.[id]?.n || id;

export function ordinalTr(n) {
  if (LANG === 'en') {
    const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }
  return `${n}.`;
}
export const nf = (n, d = 0) => (n == null ? '–' : new Intl.NumberFormat(locale(), { maximumFractionDigits: d, minimumFractionDigits: d }).format(n));
