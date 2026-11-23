// Veri yukleme ve turetilmis durumlar (siradaki seans, son yaris, puan durumu).
import { SESSION_ORDER, SESSION_MINUTES } from './names.js';
import { isTimed } from './util.js';

const LIVE = 'https://erenciracioglu-dotcom.github.io/pit-duvari/data/';
const LOCAL = new URL('../../../data/', import.meta.url).href;
const isLocalHost = ['localhost', '127.0.0.1', ''].includes(location.hostname) || location.protocol === 'file:';
const mem = new Map();

async function fetchJSON(url, timeout = 30000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  const res = await fetch(url, { cache: 'no-cache', signal: ctrl.signal }).finally(() => clearTimeout(t));
  if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });
  return res.json();
}

export function getJSON(path, { fresh = false } = {}) {
  if (!fresh && mem.has(path)) return mem.get(path);
  const p = (async () => {
    // Bilgisayarda .bat ile acildiginda en guncel veri canli siteden gelir; internet yoksa yerel kopya
    if (isLocalHost) {
      try { return await fetchJSON(LIVE + path, 5000); } catch { /* yerel kopyaya dus */ }
    }
    return fetchJSON(LOCAL + path);
  })();
  mem.set(path, p);
  p.catch(() => mem.delete(path));
  return p;
}

export const meta = () => getJSON('meta.json');
export const ref = () => getJSON('ref.json');
export const season = (y) => getJSON(`season/${y}.json`);
export const news = () => getJSON('news.json');
export const geo = () => getJSON('circuits-geo.json');
export const allResults = () => getJSON('hist/all-results.json');
export const records = () => getJSON('hist/records.json');
export const story = (y, r) => getJSON(`stories/${y}-${r}.json`);
export const report = (y, r) => getJSON(`reports/${y}-${r}.json`);
export const calendarUrl = (name) => new URL(`data/calendar/${name}`, location.href.split('#')[0]).href;

export async function boot() {
  const [m, r] = await Promise.all([meta(), ref()]);
  const [cur, next] = await Promise.all([season(m.currentSeason), m.nextSeason ? season(m.nextSeason).catch(() => null) : null]);
  return { meta: m, ref: r, cur, next, seasons: [cur, next].filter(Boolean) };
}

// ---- seanslar ----
export function sessionsOf(race) {
  const out = [];
  for (const k of SESSION_ORDER) {
    const iso = race.s?.[k];
    if (!iso) continue;
    const timed = isTimed(iso);
    const start = timed ? Date.parse(iso) : Date.parse(iso + 'T00:00:00Z');
    out.push({ k, iso, timed, start, end: start + (timed ? SESSION_MINUTES[k] * 60000 : 86400000) });
  }
  return out.sort((a, b) => a.start - b.start);
}

export function raceWindow(race) {
  const ss = sessionsOf(race);
  if (!ss.length) return null;
  return { start: ss[0].start, end: ss[ss.length - 1].end };
}

export function raceState(race, now = Date.now()) {
  if (race.res?.length) return 'done';
  const w = raceWindow(race);
  if (!w) return 'upcoming';
  if (now >= w.start - 3600000 && now <= w.end + 3 * 3600000) return 'live';
  if (now > w.end) return 'pending';
  return 'upcoming';
}

// siradaki (ya da su an suren) seans
export function nextEvent(seasons, now = Date.now()) {
  for (const S of seasons) {
    if (!S) continue;
    for (const race of S.races) {
      for (const s of sessionsOf(race)) {
        if (s.end > now) return { season: S, race, session: s, live: s.timed && s.start <= now };
      }
    }
  }
  return null;
}

export function lastRace(seasons) {
  for (const S of [...seasons].reverse()) {
    if (!S) continue;
    const r = [...S.races].reverse().find((x) => x.res?.length);
    if (r) return { season: S, race: r };
  }
  return null;
}

export const raceKey = (year, round) => `${year}-${round}`;

// Puan durumu: yaris sonrasi resmi tablo varsa onu, yoksa sonuclardan hesaplar
export function standingsAfter(season, round) {
  const races = season.races.filter((r) => r.r <= round && (r.res?.length || r.spr?.length));
  const last = races[races.length - 1];
  if (last?.sd?.length && last.r === round) return { d: last.sd, c: last.sc || [], round };
  return computeStandings(season, round);
}

export function computeStandings(season, round = Infinity) {
  const d = new Map(), c = new Map();
  for (const r of season.races) {
    if (r.r > round) break;
    for (const rows of [r.res, r.spr]) {
      for (const x of rows || []) {
        if (!x.pts) continue;
        d.set(x.d, (d.get(x.d) || 0) + x.pts);
        c.set(x.t, (c.get(x.t) || 0) + x.pts);
      }
    }
  }
  const rank = (m) => [...m.entries()].sort((a, b) => b[1] - a[1]).map(([id, pts], i) => [id, i + 1, pts]);
  return { d: rank(d), c: rank(c), round, computed: true };
}

export function latestStandings(season) {
  const done = season.races.filter((r) => r.res?.length);
  if (!done.length) return { d: season.final?.d || [], c: season.final?.c || [], round: 0 };
  const last = done[done.length - 1];
  if (last.sd?.length) return { d: last.sd, c: last.sc || [], round: last.r };
  if (season.final?.d?.length) return { d: season.final.d, c: season.final.c, round: last.r };
  return computeStandings(season);
}

// Tur tur puan serisi (grafik icin)
export function pointsProgression(season, kind = 'd') {
  const done = season.races.filter((r) => r.res?.length);
  const rows = new Map();
  done.forEach((r, i) => {
    const table = kind === 'd' ? r.sd : r.sc;
    const list = table?.length ? table : computeStandings(season, r.r)[kind];
    for (const [id, pos, pts] of list) {
      if (!rows.has(id)) rows.set(id, { id, pts: Array(done.length).fill(null), pos: Array(done.length).fill(null) });
      rows.get(id).pts[i] = pts;
      rows.get(id).pos[i] = pos;
    }
  });
  return { races: done, rows: [...rows.values()] };
}

export function teamOf(season, driverId, round = Infinity) {
  let t = null;
  for (const r of season.races) {
    if (r.r > round) break;
    const x = (r.res || r.q || []).find((y) => y.d === driverId);
    if (x) t = x.t;
  }
  if (!t) for (const tm of season.teams || []) if (tm.d.some((x) => x.d === driverId)) t = tm.t;
  return t;
}

// Guncel kadro: takim -> suruculer
export function lineup(ref, season) {
  const map = new Map();
  for (const x of ref.lineup || []) {
    if (!map.has(x.t)) map.set(x.t, []);
    if (!map.get(x.t).includes(x.d)) map.get(x.t).push(x.d);
  }
  if (!map.size && season) for (const t of season.teams || []) map.set(t.t, t.d.map((x) => x.d));
  return map;
}
