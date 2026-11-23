// Guncel sezon: F1DB henuz guncellenmediyse yeni seans sonuclarini OpenF1'den ekler,
// takim renklerini OpenF1'den alir, gelecek sezon takvimini olusturur.
import fs from 'node:fs';
import path from 'node:path';
import { of1, sessionsOfYear, matchMeetings, sessionDone } from './openf1.mjs';
import { http, secToLap, slug, log } from './util.mjs';

function numberMap(season) {
  const m = new Map();
  for (const r of season.races) for (const rows of [r.q, r.res, r.spr]) for (const x of rows || []) if (x.no) m.set(String(x.no), { d: x.d, t: x.t });
  return m;
}

function resolveDrivers(ofDrivers, nm, ref) {
  // OpenF1 surucu listesi -> { numara: {d, t, code, color} }
  const out = {};
  const teamOfName = new Map();
  for (const od of ofDrivers) {
    const k = String(od.driver_number);
    const known = nm.get(k);
    let d = known?.d;
    if (!d || (ref.drivers[d] && ref.drivers[d].a && od.name_acronym && ref.drivers[d].a !== od.name_acronym)) {
      // numara degismis ya da yeni surucu: kisaltma + soyadi ile bul
      const last = (od.last_name || '').toLowerCase();
      const hit = Object.entries(ref.drivers).find(([, v]) => v.a === od.name_acronym && (v.l || '').toLowerCase() === last);
      d = hit ? hit[0] : slug(`${od.first_name} ${od.last_name}`);
      if (!ref.drivers[d]) {
        ref.drivers[d] = { n: `${od.first_name} ${od.last_name}`, f: od.first_name, l: od.last_name, a: od.name_acronym, no: k, nat: null, s: [], fresh: 1 };
      }
    }
    out[k] = { d, code: od.name_acronym, color: od.team_colour ? '#' + od.team_colour : null, team: od.team_name, t: known?.d === d ? known.t : null };
    if (out[k].t) teamOfName.set(od.team_name, out[k].t);
  }
  for (const v of Object.values(out)) if (!v.t) v.t = teamOfName.get(v.team) || slug(v.team);
  return out;
}

function gapText(g) {
  if (g == null || g === 0) return null;
  if (typeof g === 'number') return `+${g.toFixed(3)}`;
  return String(g).replace(/LAPS?/i, (m) => (m.toUpperCase() === 'LAP' ? 'lap' : 'laps'));
}

function raceRows(rows, drivers, quali) {
  const qpos = new Map((quali || []).map((q) => [q.d, q.pn]));
  return rows
    .slice()
    .sort((a, b) => (a.position ?? 99) - (b.position ?? 99))
    .map((x) => {
      const dv = drivers[String(x.driver_number)] || { d: `no-${x.driver_number}`, t: 'unknown' };
      const o = { d: dv.d, t: dv.t, no: String(x.driver_number) };
      if (x.dsq) o.p = 'DSQ';
      else if (x.dns) o.p = 'DNS';
      else if (x.dnf) o.p = 'DNF';
      else { o.p = String(x.position); o.pn = x.position; }
      if (x.number_of_laps != null) o.l = x.number_of_laps;
      if (o.pn === 1 && x.duration) o.tm = secToLap(Array.isArray(x.duration) ? x.duration[0] : x.duration);
      else if (o.pn) { const g = gapText(Array.isArray(x.gap_to_leader) ? x.gap_to_leader[0] : x.gap_to_leader); if (g) o.gap = g; }
      if (o.p === 'DNF') o.st = 'Retired';
      if (x.points) o.pts = x.points;
      const g = qpos.get(dv.d);
      if (g) o.g = g;
      return o;
    });
}

function qualiRows(rows, drivers) {
  return rows
    .slice()
    .sort((a, b) => (a.position ?? 99) - (b.position ?? 99))
    .map((x) => {
      const dv = drivers[String(x.driver_number)] || { d: `no-${x.driver_number}`, t: 'unknown' };
      const o = { d: dv.d, t: dv.t, no: String(x.driver_number) };
      if (x.position != null) { o.p = String(x.position); o.pn = x.position; } else o.p = x.dsq ? 'DSQ' : 'NC';
      const dur = Array.isArray(x.duration) ? x.duration : [x.duration];
      if (dur[0]) o.q1 = secToLap(dur[0]);
      if (dur[1]) o.q2 = secToLap(dur[1]);
      if (dur[2]) o.q3 = secToLap(dur[2]);
      return o;
    });
}

export async function applyOverlay(season, ref, { now = Date.now() } = {}) {
  const info = { overlaid: [], colors: {}, errors: [] };
  let sessions;
  try {
    sessions = await sessionsOfYear(season.year);
  } catch (e) {
    info.errors.push('sessions: ' + e.message);
    return info;
  }
  const meetings = matchMeetings(season.races, sessions);
  const nm = numberMap(season);
  const driverCache = new Map();
  const driversOf = async (sk) => {
    if (!driverCache.has(sk)) driverCache.set(sk, resolveDrivers(await of1(`drivers?session_key=${sk}`), nm, ref));
    return driverCache.get(sk);
  };

  // Takim renkleri: sezonun son tamamlanan seansindaki surucu listesi
  const past = sessions.filter((s) => !s.is_cancelled && Date.parse(s.date_start) < now).sort((a, b) => Date.parse(b.date_start) - Date.parse(a.date_start));
  if (past[0]) {
    try {
      const dv = await driversOf(past[0].session_key);
      for (const v of Object.values(dv)) if (v.color && v.t) info.colors[v.t] = v.color;
      info.lineup = Object.entries(dv).map(([no, v]) => ({ no, d: v.d, t: v.t, code: v.code }));
    } catch (e) { info.errors.push('colors: ' + e.message); }
  }

  let lastOverlayRace = null;
  for (const race of season.races) {
    const m = meetings.get(race.r);
    if (!m) continue;
    race.ofm = m.meeting_key;
    try {
      const S = m.sessions;
      if (!race.q && sessionDone(S.q, now)) {
        const rows = await of1(`session_result?session_key=${S.q.session_key}`);
        if (rows.length) { race.q = qualiRows(rows, await driversOf(S.q.session_key)); race.srcQ = 'openf1'; info.overlaid.push(`${race.r}:q`); }
      }
      if (race.sprint && !race.sq && sessionDone(S.sq, now)) {
        const rows = await of1(`session_result?session_key=${S.sq.session_key}`);
        if (rows.length) { race.sq = qualiRows(rows, await driversOf(S.sq.session_key)); info.overlaid.push(`${race.r}:sq`); }
      }
      if (race.sprint && !race.spr && sessionDone(S.spr, now)) {
        const rows = await of1(`session_result?session_key=${S.spr.session_key}`);
        if (rows.length) { race.spr = raceRows(rows, await driversOf(S.spr.session_key), race.sq); race.srcS = 'openf1'; info.overlaid.push(`${race.r}:spr`); }
      }
      if (!race.res && sessionDone(S.r, now)) {
        const rows = await of1(`session_result?session_key=${S.r.session_key}`);
        if (rows.length) {
          race.res = raceRows(rows, await driversOf(S.r.session_key), race.q);
          if (race.res[0]?.pn === 1) race.res[0].pole = race.q?.[0]?.d === race.res[0].d ? 1 : undefined;
          for (const x of race.res) if (race.q?.[0]?.d === x.d) x.pole = 1;
          race.status = 'done';
          race.src = 'openf1';
          lastOverlayRace = { race, sk: S.r.session_key };
          info.overlaid.push(`${race.r}:r`);
        }
      }
    } catch (e) {
      info.errors.push(`round ${race.r}: ${e.message}`);
    }
  }

  if (lastOverlayRace) {
    const { race, sk } = lastOverlayRace;
    try {
      const dv = await driversOf(sk);
      const cd = await of1(`championship_drivers?session_key=${sk}`);
      const ct = await of1(`championship_teams?session_key=${sk}`);
      const teamByName = new Map(Object.values(dv).map((v) => [v.team, v.t]));
      if (cd.length) {
        race.sd = cd.slice().sort((a, b) => a.position_current - b.position_current)
          .map((x) => [dv[String(x.driver_number)]?.d || nm.get(String(x.driver_number))?.d || `no-${x.driver_number}`, x.position_current, x.points_current]);
      }
      if (ct.length) {
        race.sc = ct.slice().sort((a, b) => a.position_current - b.position_current)
          .map((x) => [teamByName.get(x.team_name) || slug(x.team_name), x.position_current, x.points_current]);
      }
      const won = new Map((season.final?.d || []).filter((x) => x[3]).map((x) => [x[0], 1]));
      const wonC = new Map((season.final?.c || []).filter((x) => x[3]).map((x) => [x[0], 1]));
      if (race.sd) season.final = { ...season.final, d: race.sd.map(([d, p, pts]) => [d, p, pts, won.get(d) || 0]) };
      if (race.sc) season.final = { ...season.final, c: race.sc.map(([t, p, pts]) => [t, p, pts, wonC.get(t) || 0]) };
    } catch (e) {
      info.errors.push('standings: ' + e.message);
    }
  }
  return info;
}

// Gelecek sezon: F1DB'de yoksa statik takvimden, saatler OpenF1 / Jolpica'dan.
// OpenF1 uzak hafta sonlari icin yer tutucu saatler yayinliyor (or. Singapur 14:00); bu yuzden
// OpenF1 saatleri yalnizca 30 gun icindeki hafta sonlari icin kullanilir.
export async function buildNextSeason(year, staticDir, ref, { now = Date.now() } = {}) {
  const file = path.join(staticDir, `calendar-${year}.json`);
  if (!fs.existsSync(file)) return null;
  const cal = JSON.parse(fs.readFileSync(file, 'utf8'));
  const season = {
    year,
    races: cal.races.map((x) => {
      const c = ref.circuits[x.c] || {};
      return { r: x.r, gp: x.gp, c: x.c, date: x.date, start: x.start, time: null, sprint: !!x.sprint, len: c.len, turns: c.turns, type: c.type, dir: c.dir, s: { r: x.date }, status: 'upcoming' };
    }),
    testing: cal.testing,
    final: { d: [], c: [] },
    teams: [],
    provisional: true
  };
  // OpenF1'de seanslar acildiysa saatleri doldur
  try {
    const sessions = await sessionsOfYear(year);
    if (sessions.length) {
      const meetings = matchMeetings(season.races, sessions);
      for (const race of season.races) {
        const m = meetings.get(race.r);
        if (!m) continue;
        if (Date.parse(race.start + 'T00:00:00Z') - now > 30 * 86400000) continue;
        for (const [k, s] of Object.entries(m.sessions)) race.s[k] = new Date(s.date_start).toISOString().replace('.000Z', 'Z');
        if (race.s.r?.includes('T')) race.time = race.s.r.slice(11, 16);
      }
    }
  } catch (e) {
    log('OpenF1 gelecek sezon:', e.message);
  }
  // Jolpica (Ergast uyumlu) saatleri
  try {
    const j = await http(`https://api.jolpi.ca/ergast/f1/${year}.json`, { timeout: 15000, retries: 1 });
    const races = j?.MRData?.RaceTable?.Races || [];
    const key = { FirstPractice: 'fp1', SecondPractice: 'fp2', ThirdPractice: 'fp3', Qualifying: 'q', Sprint: 'spr', SprintQualifying: 'sq', SprintShootout: 'sq' };
    for (const jr of races) {
      const race = season.races.find((r) => r.date === jr.date || Math.abs(Date.parse(r.date) - Date.parse(jr.date)) < 2 * 86400000);
      if (!race) continue;
      if (jr.time && !race.s.r.includes('T')) { race.s.r = `${jr.date}T${jr.time.slice(0, 5)}:00Z`; race.time = jr.time.slice(0, 5); }
      for (const [jk, k] of Object.entries(key)) if (jr[jk]?.date && jr[jk]?.time && !race.s[k]?.includes?.('T')) race.s[k] = `${jr[jk].date}T${jr[jk].time.slice(0, 5)}:00Z`;
    }
  } catch (e) {
    log('Jolpica gelecek sezon:', e.message);
  }
  return season;
}
