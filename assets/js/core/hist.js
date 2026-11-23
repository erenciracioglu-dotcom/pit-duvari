// Tum zamanlarin sonuc tablosu (all-results.json) uzerinde yardimcilar
import * as data from './data.js';

const push = (m, k, v) => { let a = m.get(k); if (!a) m.set(k, (a = [])); a.push(v); };

export async function loadAll() {
  const all = await data.allResults();
  if (!all._ix) {
    all._ix = true;
    all.byDriver = new Map();
    all.byRace = new Map();
    all.qByRace = new Map();
    for (const x of all.res) { push(all.byDriver, x[1], x); push(all.byRace, x[0], x); }
    for (const q of all.q || []) push(all.qByRace, q[0], q);
    all.dIdx = new Map(all.dr.map((d, i) => [d, i]));
    all.tIdx = new Map(all.te.map((t, i) => [t, i]));
    all.cIdx = new Map(all.ci.map((c, i) => [c, i]));
  }
  return all;
}

export const raceInfo = (all, ri) => { const r = all.races[ri]; return { id: r[0], year: r[1], round: r[2], date: r[3], gp: all.gp[r[4]], c: all.ci[r[5]] }; };
export const started = (x) => !(x[6] & 16);
export const classified = (x) => x[3] > 0;

// Iki pilotun karsilastirmasi
export function h2h(all, a, b) {
  const ai = all.dIdx.get(a), bi = all.dIdx.get(b);
  const out = { common: 0, aheadA: 0, aheadB: 0, ptsA: 0, ptsB: 0, mates: { races: 0, aheadA: 0, aheadB: 0, qA: 0, qB: 0, ptsA: 0, ptsB: 0, seasons: new Set() }, qA: 0, qB: 0, qCommon: 0 };
  if (ai == null || bi == null) return out;
  const rowsA = new Map((all.byDriver.get(ai) || []).map((x) => [x[0], x]));
  for (const y of all.byDriver.get(bi) || []) {
    const x = rowsA.get(y[0]);
    if (!x || !started(x) || !started(y)) continue;
    out.common++;
    const pa = x[3] || 999, pb = y[3] || 999;
    if (pa < pb) out.aheadA++; else if (pb < pa) out.aheadB++;
    out.ptsA += x[5] / 2; out.ptsB += y[5] / 2;
    if (x[2] === y[2]) {
      const m = out.mates;
      m.races++; m.seasons.add(all.races[x[0]][1]);
      if (pa < pb) m.aheadA++; else if (pb < pa) m.aheadB++;
      m.ptsA += x[5] / 2; m.ptsB += y[5] / 2;
    }
  }
  // siralama turlari
  for (const [ri, qs] of all.qByRace) {
    const qa = qs.find((q) => q[1] === ai), qb = qs.find((q) => q[1] === bi);
    if (!qa || !qb) continue;
    out.qCommon++;
    if (qa[3] < qb[3]) out.qA++; else out.qB++;
    if (qa[2] === qb[2]) { if (qa[3] < qb[3]) out.mates.qA++; else out.mates.qB++; }
  }
  return out;
}

// Bir sezonun takim ici duellolari (sezon dosyasindan)
export function teammateDuels(season) {
  const pairs = new Map();
  for (const r of season.races) {
    const byTeam = new Map();
    for (const x of r.res || []) push(byTeam, x.t, x);
    const qpos = new Map((r.q || []).map((q) => [q.d, q.pn || 99]));
    for (const [t, xs] of byTeam) {
      if (xs.length !== 2) continue;
      const [x, y] = xs.slice().sort((p, q) => (p.d < q.d ? -1 : 1));
      const key = `${t}|${x.d}|${y.d}`;
      if (!pairs.has(key)) pairs.set(key, { t, a: x.d, b: y.d, races: 0, rA: 0, rB: 0, qA: 0, qB: 0, pA: 0, pB: 0 });
      const p = pairs.get(key);
      p.races++;
      const pa = x.pn || 999, pb = y.pn || 999;
      if (pa < pb) p.rA++; else if (pb < pa) p.rB++;
      const qa = qpos.get(x.d), qb = qpos.get(y.d);
      if (qa && qb) { if (qa < qb) p.qA++; else p.qB++; }
      p.pA += x.pts || 0; p.pB += y.pts || 0;
    }
    for (const x of r.spr || []) {
      for (const p of pairs.values()) { if (p.a === x.d) p.pA += x.pts || 0; if (p.b === x.d) p.pB += x.pts || 0; }
    }
  }
  return [...pairs.values()].filter((p) => p.races >= 3).sort((p, q) => q.races - p.races);
}

export const ageText = (days, L) => {
  const y = Math.floor(days / 365.2425);
  const d = Math.round(days - y * 365.2425);
  return L(`${y} yıl ${d} gün`, `${y}y ${d}d`);
};
