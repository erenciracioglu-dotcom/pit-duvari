// Yarisin hikayesi: OpenF1 verisinden tur tur siralama, lastik stintleri, pit stoplar,
// yaris kontrol olaylari, hava durumu ve pist tekrari icin pist cizgisi.
import fs from 'node:fs';
import path from 'node:path';
import { of1, sessionsOfYear, matchMeetings, sessionDone } from './openf1.mjs';
import { writeJson, log, groupBy } from './util.mjs';

const r3 = (x) => (x == null ? null : Math.round(x * 1000) / 1000);
const KEEP_MSG = /PENALTY|INVESTIGAT|REPRIMAND|DISQUALIF|NO FURTHER|STOP\/GO|DRIVE THROUGH|BLACK AND WHITE|UNSAFE RELEASE|CAUSING A COLLISION|FALSE START|RETIRED|STOPPED/i;

export async function buildStory(race, meeting, year) {
  const sk = meeting.sessions.r.session_key;
  const drivers = await of1(`drivers?session_key=${sk}`);
  const laps = await of1(`laps?session_key=${sk}`);
  if (!laps.length) return null;
  const stints = await of1(`stints?session_key=${sk}`);
  const pit = await of1(`pit?session_key=${sk}`);
  const rc = await of1(`race_control?session_key=${sk}`);
  const weather = await of1(`weather?session_key=${sk}`).catch(() => []);
  let overtakes = [];
  try { overtakes = await of1(`overtakes?session_key=${sk}`); } catch { /* 2026 oncesi yok */ }

  const noToRes = new Map((race.res || []).map((x) => [String(x.no), x]));
  const drv = {};
  for (const d of drivers) {
    const k = String(d.driver_number);
    const r = noToRes.get(k);
    drv[k] = { d: r?.d || null, t: r?.t || null, c: d.name_acronym, col: d.team_colour ? '#' + d.team_colour : null, n: `${d.first_name} ${d.last_name}` };
  }

  // Tur bitis zamanlari
  const byDrv = groupBy(laps, 'driver_number');
  let t0 = Infinity;
  const tmp = {};
  for (const [no, arr] of byDrv) {
    arr.sort((a, b) => a.lap_number - b.lap_number);
    const starts = new Map(arr.map((l) => [l.lap_number, l.date_start ? Date.parse(l.date_start) : null]));
    const durs = new Map(arr.map((l) => [l.lap_number, l.lap_duration]));
    let s1 = starts.get(1);
    if (!s1 && starts.get(2) && durs.get(1)) s1 = starts.get(2) - durs.get(1) * 1000;
    if (s1) t0 = Math.min(t0, s1);
    tmp[no] = { arr, starts, durs };
  }
  if (!isFinite(t0)) t0 = Date.parse(meeting.sessions.r.date_start);
  const lapRows = {};
  let maxLap = 0;
  for (const [no, { arr, starts, durs }] of Object.entries(tmp)) {
    const rows = [];
    for (const l of arr) {
      const n = l.lap_number;
      let end = starts.get(n + 1);
      if (!end && starts.get(n) && durs.get(n)) end = starts.get(n) + durs.get(n) * 1000;
      if (n === 1 && !end && starts.get(2)) end = starts.get(2);
      rows[n - 1] = [r3(l.lap_duration), r3(l.duration_sector_1), r3(l.duration_sector_2), r3(l.duration_sector_3), l.is_pit_out_lap ? 1 : 0, end ? r3((end - t0) / 1000) : null];
      maxLap = Math.max(maxLap, n);
    }
    for (let i = 0; i < rows.length; i++) if (!rows[i]) rows[i] = [null, null, null, null, 0, null];
    lapRows[no] = rows;
  }
  // Son turun bitisi eksikse sonuc tablosundaki surelerle tamamla
  const result = await of1(`session_result?session_key=${sk}`).catch(() => []);
  for (const x of result) {
    const rows = lapRows[String(x.driver_number)];
    if (!rows || !x.number_of_laps || !x.duration || Array.isArray(x.duration)) continue;
    const last = rows[x.number_of_laps - 1];
    if (last && last[5] == null) last[5] = r3(x.duration);
  }

  // Lastikler ve pitler
  const st = stints.map((s) => [String(s.driver_number), s.stint_number, s.lap_start, s.lap_end, (s.compound || 'UNKNOWN').toUpperCase(), s.tyre_age_at_start ?? 0])
    .sort((a, b) => a[0].localeCompare(b[0]) || a[1] - b[1]);
  const pits = pit.map((p) => [String(p.driver_number), p.lap_number, r3(p.pit_duration ?? p.lane_duration), r3(p.stop_duration ?? null)]);

  // Yaris kontrol: guvenlik araci, kirmizi bayrak, cezalar
  const events = [];
  const sc = [];
  let open = {};
  const tl = {};
  for (const m of rc.sort((a, b) => Date.parse(a.date) - Date.parse(b.date))) {
    const msg = m.message || '';
    const t = r3((Date.parse(m.date) - t0) / 1000);
    const lap = m.lap_number || null;
    if (/TRACK LIMITS|DELETED/i.test(msg) && m.driver_number) { tl[m.driver_number] = (tl[m.driver_number] || 0) + 1; continue; }
    let kind = null;
    if (/VIRTUAL SAFETY CAR DEPLOYED/i.test(msg)) { open.VSC = [lap, t]; kind = 'vsc'; }
    else if (/VIRTUAL SAFETY CAR ENDING/i.test(msg)) { if (open.VSC) sc.push(['VSC', open.VSC[0], lap, open.VSC[1], t]); open.VSC = null; kind = 'vsc'; }
    else if (/SAFETY CAR DEPLOYED/i.test(msg)) { open.SC = [lap, t]; kind = 'sc'; }
    else if (/SAFETY CAR IN THIS LAP/i.test(msg)) { if (open.SC) sc.push(['SC', open.SC[0], lap, open.SC[1], t]); open.SC = null; kind = 'sc'; }
    else if (m.flag === 'RED') { open.RED = [lap, t]; kind = 'red'; }
    else if (m.flag === 'GREEN' && open.RED) { sc.push(['RED', open.RED[0], lap, open.RED[1], t]); open.RED = null; kind = 'green'; }
    else if (m.flag === 'CHEQUERED') kind = 'chequered';
    else if (KEEP_MSG.test(msg)) kind = /INVESTIGAT|NOTED/i.test(msg) ? 'inv' : /PENALTY|DRIVE THROUGH|STOP\/GO|DISQUALIF|REPRIMAND|BLACK AND WHITE/i.test(msg) ? 'pen' : 'info';
    if (kind) events.push([lap, kind, msg, t, m.driver_number || null]);
  }
  for (const [k, v] of Object.entries(open)) if (v) sc.push([k, v[0], maxLap, v[1], null]);

  // Hava
  let wx = null;
  if (weather.length) {
    const mm = (k) => [Math.min(...weather.map((w) => w[k])), Math.max(...weather.map((w) => w[k]))];
    wx = { air: mm('air_temperature'), track: mm('track_temperature'), hum: Math.round(weather.reduce((s, w) => s + w.humidity, 0) / weather.length), rain: weather.some((w) => w.rainfall > 0), wind: r3(weather.reduce((s, w) => s + w.wind_speed, 0) / weather.length) };
  }

  // En hizli tur
  let fl = null;
  for (const [no, rows] of Object.entries(lapRows)) rows.forEach((r, i) => { if (r[0] && (!fl || r[0] < fl.dur)) fl = { no, lap: i + 1, dur: r[0] }; });

  // Pist cizgisi: en cok tur atan surucunun temiz ve hizli bir turu
  let trk = null;
  try {
    const best = Object.entries(lapRows).map(([no, rows]) => ({ no, rows })).sort((a, b) => b.rows.length - a.rows.length)[0];
    const cand = best.rows.map((r, i) => ({ i, r })).filter(({ i, r }) => r[0] && !r[4] && i > 1 && !best.rows[i + 1]?.[4]).sort((a, b) => a.r[0] - b.r[0])[0];
    if (cand) {
      const lapStart = tmp[best.no].starts.get(cand.i + 1);
      if (lapStart) {
        const a = new Date(lapStart).toISOString().replace('Z', '');
        const b = new Date(lapStart + cand.r[0] * 1000).toISOString().replace('Z', '');
        const loc = await of1(`location?session_key=${sk}&driver_number=${best.no}&date>=${a}&date<${b}`);
        if (loc.length > 50) {
          const step = Math.max(1, Math.floor(loc.length / 220));
          const pts = loc.filter((_, i) => i % step === 0).map((p) => [p.x, p.y, r3((Date.parse(p.date) - lapStart) / (cand.r[0] * 1000))]);
          trk = { pts, no: best.no, lap: cand.i + 1 };
        }
      }
    }
  } catch (e) {
    log('pist cizgisi alinamadi', year, race.r, e.message);
  }

  if (!trk) trk = await repairTrack({ t0: new Date(t0).toISOString(), lap: lapRows, sk }).catch(() => null);

  const ot = {};
  for (const o of overtakes) ot[o.overtaking_driver_number] = (ot[o.overtaking_driver_number] || 0) + 1;

  const story = {
    v: 1, year, round: race.r, sk, t0: new Date(t0).toISOString(), laps: maxLap,
    drv, lap: lapRows, st, pits, ev: events, sc, wx, fl, trk, ot, tl,
    cols: { lap: ['dur', 's1', 's2', 's3', 'pitOut', 'end'], st: ['no', 'stint', 'from', 'to', 'compound', 'age'], pits: ['no', 'lap', 'lane', 'stop'], ev: ['lap', 'kind', 'msg', 't', 'no'], sc: ['kind', 'fromLap', 'toLap', 'tFrom', 'tTo'] }
  };
  trimToLaps(story, raceLaps(story, race));
  return story;
}

// OpenF1 bazen damali bayraktan sonraki bos turu da listeler (yalniz kazananda, suresiz).
// Hikayenin tur sayisi resmi sonuctaki kazananin tur sayisidir; sonuc yoksa suresi olan son tur.
export function raceLaps(story, race) {
  const official = (race?.res || []).find((x) => x.pn === 1)?.l;
  if (official) return official;
  let last = 0;
  for (const rows of Object.values(story.lap || {})) rows.forEach((r, i) => { if (r && (r[0] != null || r[5] != null)) last = Math.max(last, i + 1); });
  return last || story.laps;
}

export function trimToLaps(story, N) {
  if (!N) return false;
  let changed = false;
  if (story.laps > N) { story.laps = N; changed = true; }
  for (const no of Object.keys(story.lap || {})) if (story.lap[no].length > N) { story.lap[no] = story.lap[no].slice(0, N); changed = true; }
  const st = [];
  for (const x of story.st || []) {
    if (x[2] > N) { changed = true; continue; }
    if (x[3] > N) { st.push([x[0], x[1], x[2], N, x[4], x[5]]); changed = true; } else st.push(x);
  }
  story.st = st;
  for (const e of story.ev || []) if (e[0] > N) { e[0] = N; changed = true; }
  for (const x of story.sc || []) { if (x[1] > N) { x[1] = N; changed = true; } if (x[2] > N) { x[2] = N; changed = true; } }
  return changed;
}

// Pist cizgisi eksik kalmis hikayeyi onar: kayitli tur zamanlarindan temiz bir tur secip konum verisini yeniden ister
export async function repairTrack(story) {
  const t0 = Date.parse(story.t0);
  const drivers = Object.entries(story.lap).sort((a, b) => b[1].length - a[1].length);
  for (const [no, rows] of drivers.slice(0, 3)) {
    const cands = rows.map((r, i) => ({ i, r })).filter(({ i, r }) => i > 0 && r[0] && !r[4] && !rows[i + 1]?.[4] && rows[i - 1]?.[5] != null).sort((a, b) => a.r[0] - b.r[0]).slice(0, 3);
    for (const c of cands) {
      const start = t0 + rows[c.i - 1][5] * 1000;
      const a = new Date(start).toISOString().replace('Z', '');
      const b = new Date(start + c.r[0] * 1000).toISOString().replace('Z', '');
      try {
        const loc = await of1(`location?session_key=${story.sk}&driver_number=${no}&date>=${a}&date<${b}`);
        if (loc.length > 50) {
          const step = Math.max(1, Math.floor(loc.length / 220));
          return { pts: loc.filter((_, k) => k % step === 0).map((p) => [p.x, p.y, r3((Date.parse(p.date) - start) / (c.r[0] * 1000))]), no, lap: c.i + 1 };
        }
      } catch { /* sonraki aday */ }
    }
  }
  // Yaris seansinda konum verisi yoksa ayni hafta sonunun siralama / antrenman turundan ciz
  try {
    const mk = (await of1(`sessions?session_key=${story.sk}`))[0]?.meeting_key;
    const ss = mk ? await of1(`sessions?meeting_key=${mk}`) : [];
    for (const name of ['Qualifying', 'Practice 3', 'Practice 2', 'Practice 1', 'Sprint Qualifying']) {
      const s = ss.find((x) => x.session_name === name);
      if (!s) continue;
      for (const [no] of drivers.slice(0, 2)) {
        const laps = (await of1(`laps?session_key=${s.session_key}&driver_number=${no}`)).filter((l) => l.lap_duration && l.date_start && !l.is_pit_out_lap).sort((x, y) => x.lap_duration - y.lap_duration);
        const lap = laps[0];
        if (!lap) continue;
        const start = Date.parse(lap.date_start);
        const a = new Date(start).toISOString().replace('Z', '');
        const b = new Date(start + lap.lap_duration * 1000).toISOString().replace('Z', '');
        const loc = await of1(`location?session_key=${s.session_key}&driver_number=${no}&date>=${a}&date<${b}`).catch(() => []);
        if (loc.length > 50) {
          const step = Math.max(1, Math.floor(loc.length / 220));
          return { pts: loc.filter((_, k) => k % step === 0).map((p) => [p.x, p.y, r3((Date.parse(p.date) - start) / (lap.lap_duration * 1000))]), no, lap: lap.lap_number, from: name };
        }
      }
    }
  } catch { /* vazgec */ }
  return null;
}

export async function buildStories({ seasons, years, dir, budget = 6, now = Date.now() }) {
  let made = 0;
  const errors = [];
  // once eksik pist cizgilerini onar (her calismada en fazla 4)
  let repairs = 0;
  if (fs.existsSync(dir)) {
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json')).sort().reverse()) {
      if (repairs >= 4) break;
      const file = path.join(dir, f);
      let st;
      try { st = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { continue; }
      if (st.trk || st.trkTried >= 3) continue;
      repairs++;
      const trk = await repairTrack(st).catch(() => null);
      if (trk) { st.trk = trk; delete st.trkTried; log('Pist cizgisi onarildi:', f); } else st.trkTried = (st.trkTried || 0) + 1;
      writeJson(file, st);
    }
  }
  // mevcut hikayelerde damadan sonraki bos turu kirp (API cagrisi gerektirmez)
  if (fs.existsSync(dir)) {
    for (const f of fs.readdirSync(dir).filter((x) => /^\d{4}-\d+\.json$/.test(x))) {
      const [y, r] = f.replace('.json', '').split('-').map(Number);
      const race = seasons[y]?.races?.find((x) => x.r === r);
      if (!race) continue;
      const file = path.join(dir, f);
      let st;
      try { st = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { continue; }
      if (trimToLaps(st, raceLaps(st, race))) { writeJson(file, st); log('Fazladan tur kirpildi:', f); }
    }
  }
  for (const year of years) {
    const season = seasons[year];
    if (!season) continue;
    let sessions;
    try { sessions = await sessionsOfYear(year); } catch (e) { errors.push(`${year}: ${e.message}`); continue; }
    const meetings = matchMeetings(season.races, sessions);
    for (const race of season.races.slice().reverse()) {
      if (made >= budget) return { made, errors };
      const file = path.join(dir, `${year}-${race.r}.json`);
      if (fs.existsSync(file)) continue;
      const m = meetings.get(race.r);
      if (!m?.sessions.r || !sessionDone(m.sessions.r, now, 45)) continue;
      try {
        const story = await buildStory(race, m, year);
        if (story) { writeJson(file, story); made++; log('Yaris hikayesi yazildi:', year, race.r); }
      } catch (e) {
        errors.push(`${year}-${race.r}: ${e.message}`);
      }
    }
  }
  return { made, errors };
}
