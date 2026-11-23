// OpenF1 (https://openf1.org): 2023'ten bugune ucretsiz seans verisi. Ucretsiz katmanda dakikada ~30 istek siniri var.
import { http } from './util.mjs';

const BASE = 'https://api.openf1.org/v1/';
let calls = 0;

export async function of1(q) {
  calls++;
  return http(BASE + q, { gap: 2100, timeout: 45000, retries: 4 });
}
export const of1Calls = () => calls;

const sessionCache = new Map();
export async function sessionsOfYear(year) {
  if (!sessionCache.has(year)) sessionCache.set(year, await of1(`sessions?year=${year}`));
  return sessionCache.get(year);
}

const KIND = { 'Practice 1': 'fp1', 'Practice 2': 'fp2', 'Practice 3': 'fp3', 'Sprint Qualifying': 'sq', 'Sprint Shootout': 'sq', Sprint: 'spr', Qualifying: 'q', Race: 'r' };

// F1DB yarislarini OpenF1 hafta sonlariyla eslestirir (yaris baslangici 6 saat icinde)
export function matchMeetings(races, sessions) {
  const byMeeting = new Map();
  for (const s of sessions) {
    if (s.is_cancelled) continue;
    const k = KIND[s.session_name];
    if (!k) continue;
    let m = byMeeting.get(s.meeting_key);
    if (!m) byMeeting.set(s.meeting_key, (m = { meeting_key: s.meeting_key, sessions: {} }));
    m.sessions[k] = s;
  }
  const out = new Map();
  for (const race of races) {
    const rt = race.s?.r && race.s.r.includes('T') ? Date.parse(race.s.r) : Date.parse(race.date + 'T12:00:00Z');
    let best = null, bestD = Infinity;
    for (const m of byMeeting.values()) {
      const rs = m.sessions.r;
      if (!rs) continue;
      const d = Math.abs(Date.parse(rs.date_start) - rt);
      if (d < bestD) { bestD = d; best = m; }
    }
    if (best && bestD < 18 * 3600000) out.set(race.r, best);
  }
  return out;
}

export const sessionDone = (s, now = Date.now(), graceMin = 35) => !!s && Date.parse(s.date_end || s.date_start) + graceMin * 60000 < now;
