// Tarayicidan OpenF1: istekler sirayla ve aralikli gider (ucretsiz katman hiz siniri).
const BASE = 'https://api.openf1.org/v1/';
const GAP = 450;
let last = 0;
let chain = Promise.resolve();
const cache = new Map();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class OpenF1Error extends Error {
  constructor(msg, status) { super(msg); this.status = status; }
}

function run(q) {
  return (chain = chain.then(async () => {
    for (let i = 0; i < 4; i++) {
      const wait = last + GAP - Date.now();
      if (wait > 0) await sleep(wait);
      last = Date.now();
      let res;
      try { res = await fetch(BASE + q); } catch { throw new OpenF1Error('OpenF1’e ulaşılamadı. İnternet bağlantını kontrol et.', 0); }
      if (res.status === 429) { await sleep(2500 * (i + 1)); continue; }
      if (res.status === 401 || res.status === 403) throw new OpenF1Error('Bu seans şu an canlı; OpenF1 ücretsiz verisi seans bittikten yarım saat sonra açılır.', res.status);
      if (res.status === 404) return [];
      if (!res.ok) throw new OpenF1Error(`OpenF1 hata verdi (${res.status}).`, res.status);
      return res.json();
    }
    throw new OpenF1Error('OpenF1 şu an yoğun; biraz sonra yeniden dene.', 429);
  }));
}

export function of1(q) {
  if (cache.has(q)) return cache.get(q);
  const p = run(q);
  cache.set(q, p);
  p.catch(() => cache.delete(q));
  return p;
}

const KIND = { 'Practice 1': 'fp1', 'Practice 2': 'fp2', 'Practice 3': 'fp3', 'Sprint Qualifying': 'sq', 'Sprint Shootout': 'sq', Sprint: 'spr', Qualifying: 'q', Race: 'r' };

// F1DB yarisini OpenF1 hafta sonuyla eslestir: { kind: session }
export async function meetingSessions(year, race) {
  const all = await of1(`sessions?year=${year}`);
  const rt = race.s?.r?.includes('T') ? Date.parse(race.s.r) : Date.parse(race.date + 'T12:00:00Z');
  const byM = new Map();
  for (const s of all) {
    if (s.is_cancelled || !KIND[s.session_name]) continue;
    if (!byM.has(s.meeting_key)) byM.set(s.meeting_key, {});
    byM.get(s.meeting_key)[KIND[s.session_name]] = s;
  }
  let best = null, bestD = Infinity;
  for (const m of byM.values()) {
    if (!m.r) continue;
    const d = Math.abs(Date.parse(m.r.date_start) - rt);
    if (d < bestD) { bestD = d; best = m; }
  }
  return bestD < 18 * 3600000 ? best : null;
}
