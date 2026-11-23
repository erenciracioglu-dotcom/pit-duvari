// F1DB tablolarindan sitenin okudugu kompakt dosyalari uretir:
//   ref.json            suruculer, takimlar, pistler, ulkeler, GP adlari
//   season/<yil>.json   her sezonun takvimi, sonuclari, siralama, sprint, puan durumu (tur tur)
//   hist/all-results.json  tum yaris sonuclari (kafa kafaya, rekorlar, bilgi yarismasi icin)
//   hist/records.json   hazir rekor listeleri
import { groupBy, utcIso } from './util.mjs';

const NONSTART = new Set(['DNS', 'DNQ', 'DNPQ', 'DNP', 'WD']);
const DSQ = new Set(['DSQ', 'EX']);

function sessionTime(date, time) {
  if (!date) return null;
  return time ? utcIso(date, time) : date; // saat yoksa yalnizca tarih
}

function sessionsOf(race) {
  const s = {};
  const put = (k, d, t) => { const v = sessionTime(d, t); if (v) s[k] = v; };
  put('fp1', race.freePractice1Date, race.freePractice1Time);
  put('fp2', race.freePractice2Date, race.freePractice2Time);
  put('fp3', race.freePractice3Date, race.freePractice3Time);
  put('fp4', race.freePractice4Date, race.freePractice4Time);
  put('sq', race.sprintQualifyingDate, race.sprintQualifyingTime);
  put('spr', race.sprintRaceDate, race.sprintRaceTime);
  put('q', race.qualifyingDate, race.qualifyingTime);
  put('r', race.date, race.time);
  return s;
}

export function resultRow(x) {
  const o = { p: x.positionText, d: x.driverId, t: x.constructorId };
  if (x.positionNumber != null) o.pn = x.positionNumber;
  if (x.driverNumber) o.no = String(x.driverNumber);
  if (x.gridPositionNumber != null) o.g = x.gridPositionNumber;
  else if (x.gridPositionText) o.gt = x.gridPositionText;
  if (x.laps != null) o.l = x.laps;
  if (x.positionNumber === 1 && x.time) o.tm = x.time;
  else if (x.gap) o.gap = x.gap;
  if (x.gapLaps) o.gl = x.gapLaps;
  if (x.reasonRetired) o.st = x.reasonRetired;
  if (x.points) o.pts = x.points;
  if (x.polePosition) o.pole = 1;
  if (x.fastestLap) o.fl = 1;
  if (x.driverOfTheDay) o.dotd = 1;
  if (x.grandSlam) o.gs = 1;
  if (x.pitStops != null) o.ps = x.pitStops;
  if (x.timePenalty) o.pen = x.timePenalty;
  if (x.sharedCar) o.sh = 1;
  return o;
}

export function qualiRow(x) {
  const o = { p: x.positionText, d: x.driverId, t: x.constructorId };
  if (x.positionNumber != null) o.pn = x.positionNumber;
  if (x.driverNumber) o.no = String(x.driverNumber);
  if (x.q1) o.q1 = x.q1;
  if (x.q2) o.q2 = x.q2;
  if (x.q3) o.q3 = x.q3;
  if (!x.q1 && x.time) o.tm = x.time;
  if (x.gap) o.gap = x.gap;
  if (x.laps != null) o.l = x.laps;
  return o;
}

const byOrder = (a, b) => (a.positionDisplayOrder ?? 999) - (b.positionDisplayOrder ?? 999);

export function buildHistory(load) {
  const races = load('races').slice().sort((a, b) => a.year - b.year || a.round - b.round);
  const by = (name) => groupBy(load(name), 'raceId');
  const RR = by('races-race-results');
  const QR = by('races-qualifying-results');
  const SR = by('races-sprint-race-results');
  const SQR = by('races-sprint-qualifying-results');
  const DS = by('races-driver-standings');
  const CS = by('races-constructor-standings');
  const FL = by('races-fastest-laps');
  const DOTD = by('races-driver-of-the-day-results');
  const PITS = by('races-pit-stops');
  const SDS = groupBy(load('seasons-driver-standings'), 'year');
  const SCS = groupBy(load('seasons-constructor-standings'), 'year');
  const SED = groupBy(load('seasons-entrants-drivers'), 'year');

  const seasons = {};
  for (const race of races) {
    const y = race.year;
    const S = (seasons[y] ||= { year: y, races: [] });
    const o = {
      r: race.round, id: race.id, gp: race.grandPrixId, c: race.circuitId, name: race.officialName,
      date: race.date, time: race.time || null,
      laps: race.laps ?? race.scheduledLaps ?? null, dist: race.distance ?? race.scheduledDistance ?? null,
      len: race.courseLength, turns: race.turns, type: race.circuitType, dir: race.direction,
      sprint: !!race.sprintRaceDate,
      s: sessionsOf(race)
    };
    if (race.driversChampionshipDecider) o.decD = 1;
    if (race.constructorsChampionshipDecider) o.decC = 1;
    const rr = (RR.get(race.id) || []).sort(byOrder);
    if (rr.length) o.res = rr.map(resultRow);
    const qr = (QR.get(race.id) || []).sort(byOrder);
    if (qr.length) o.q = qr.map(qualiRow);
    const sr = (SR.get(race.id) || []).sort(byOrder);
    if (sr.length) o.spr = sr.map(resultRow);
    const sqr = (SQR.get(race.id) || []).sort(byOrder);
    if (sqr.length) o.sq = sqr.map(qualiRow);
    const fl = (FL.get(race.id) || []).find((x) => x.positionNumber === 1);
    if (fl) o.fl = { d: fl.driverId, t: fl.constructorId, lap: fl.lap, tm: fl.time };
    const dotd = (DOTD.get(race.id) || []).sort(byOrder).slice(0, 3);
    if (dotd.length) o.dotd = dotd.map((x) => ({ d: x.driverId, pct: x.percentage }));
    const pits = PITS.get(race.id) || [];
    if (pits.length) o.pits = pits.map((x) => [x.driverId, x.stop, x.lap, x.timeMillis]);
    const ds = (DS.get(race.id) || []).sort(byOrder);
    if (ds.length) o.sd = ds.map((x) => [x.driverId, x.positionNumber, x.points]);
    const cs = (CS.get(race.id) || []).sort(byOrder);
    if (cs.length) o.sc = cs.map((x) => [x.constructorId, x.positionNumber, x.points]);
    o.status = o.res ? 'done' : 'upcoming';
    S.races.push(o);
  }

  for (const [y, S] of Object.entries(seasons)) {
    const sds = (SDS.get(Number(y)) || []).sort(byOrder);
    const scs = (SCS.get(Number(y)) || []).sort(byOrder);
    S.final = {
      d: sds.map((x) => [x.driverId, x.positionNumber, x.points, x.championshipWon ? 1 : 0]),
      c: scs.map((x) => [x.constructorId, x.positionNumber, x.points, x.championshipWon ? 1 : 0])
    };
    const champD = sds.find((x) => x.championshipWon);
    const champC = scs.find((x) => x.championshipWon);
    if (champD || champC) S.champion = { d: champD?.driverId || null, c: champC?.constructorId || null };
    const teams = new Map();
    for (const e of SED.get(Number(y)) || []) {
      if (e.testDriver) continue;
      let t = teams.get(e.constructorId);
      if (!t) teams.set(e.constructorId, (t = { t: e.constructorId, e: e.engineManufacturerId, d: [] }));
      if (!t.d.some((x) => x.d === e.driverId)) t.d.push({ d: e.driverId, r: e.roundsText });
    }
    S.teams = [...teams.values()];
  }
  return seasons;
}

export function buildRef(load, { geoIds = new Set(), seasons }) {
  const countriesAll = load('countries');
  const usedCountries = new Set();
  const drivers = {};
  for (const d of load('drivers')) {
    drivers[d.id] = {
      n: d.name, f: d.firstName, l: d.lastName, a: d.abbreviation, no: d.permanentNumber || undefined,
      nat: d.nationalityCountryId, dob: d.dateOfBirth, dod: d.dateOfDeath || undefined, pob: d.placeOfBirth || undefined,
      s: [d.totalRaceStarts, d.totalRaceWins, d.totalPodiums, d.totalPolePositions, d.totalFastestLaps, d.totalChampionshipWins,
        d.totalChampionshipPoints, d.totalRaceEntries, d.totalSprintRaceWins, d.totalDriverOfTheDay, d.totalGrandSlams, d.bestChampionshipPosition]
    };
    usedCountries.add(d.nationalityCountryId);
  }
  const constructors = {};
  for (const c of load('constructors')) {
    constructors[c.id] = {
      n: c.name, fn: c.fullName, nat: c.countryId,
      s: [c.totalRaceStarts, c.totalRaceWins, c.totalPodiums, c.totalPolePositions, c.totalFastestLaps, c.totalChampionshipWins,
        c.totalChampionshipPoints, c.total1And2Finishes, c.totalSprintRaceWins]
    };
    usedCountries.add(c.countryId);
  }
  const circuits = {};
  for (const c of load('circuits')) {
    circuits[c.id] = {
      n: c.name, fn: c.fullName, p: c.placeName, nat: c.countryId, lat: c.latitude, lng: c.longitude,
      type: c.type, dir: c.direction, len: c.length, turns: c.turns, races: c.totalRacesHeld, geo: geoIds.has(c.id) ? 1 : undefined
    };
    usedCountries.add(c.countryId);
  }
  const gps = {};
  for (const g of load('grands-prix')) {
    gps[g.id] = { n: g.fullName, s: g.shortName, nat: g.countryId, races: g.totalRacesHeld };
    usedCountries.add(g.countryId);
  }
  const countries = {};
  for (const c of countriesAll) if (usedCountries.has(c.id)) countries[c.id] = { n: c.name, a2: c.alpha2Code, a3: c.alpha3Code };
  // ilk ve son sezon (surucu/takim sayfalari icin)
  const dSpan = {}; const cSpan = {};
  for (const S of Object.values(seasons)) {
    for (const t of S.teams || []) {
      const cs = (cSpan[t.t] ||= [S.year, S.year]);
      cs[0] = Math.min(cs[0], S.year); cs[1] = Math.max(cs[1], S.year);
      for (const d of t.d) {
        const ds = (dSpan[d.d] ||= [S.year, S.year]);
        ds[0] = Math.min(ds[0], S.year); ds[1] = Math.max(ds[1], S.year);
      }
    }
  }
  for (const [id, v] of Object.entries(dSpan)) if (drivers[id]) drivers[id].y = v;
  for (const [id, v] of Object.entries(cSpan)) if (constructors[id]) constructors[id].y = v;
  return { drivers, constructors, circuits, gps, countries };
}

export function buildAllResults(load) {
  const races = load('races').slice().sort((a, b) => a.year - b.year || a.round - b.round);
  const gp = [], ci = [], dr = [], te = [];
  const gm = new Map(), cm = new Map(), dm = new Map(), tm = new Map();
  const idx = (m, arr, id) => { let i = m.get(id); if (i === undefined) { i = arr.length; arr.push(id); m.set(id, i); } return i; };
  const raceIdx = new Map();
  const R = races.map((r, i) => { raceIdx.set(r.id, i); return [r.id, r.year, r.round, r.date, idx(gm, gp, r.grandPrixId), idx(cm, ci, r.circuitId)]; });
  const res = [];
  for (const x of load('races-race-results')) {
    const ri = raceIdx.get(x.raceId);
    if (ri === undefined) continue;
    let f = 0;
    if (x.polePosition) f |= 1;
    if (x.fastestLap) f |= 2;
    const pt = x.positionText;
    if (x.positionNumber == null) {
      if (DSQ.has(pt)) f |= 8; else if (NONSTART.has(pt)) f |= 16; else f |= 4;
    }
    if (x.driverOfTheDay) f |= 32;
    if (x.grandSlam) f |= 64;
    res.push([ri, idx(dm, dr, x.driverId), idx(tm, te, x.constructorId), x.positionNumber || 0, x.gridPositionNumber || 0,
      Math.round((x.points || 0) * 2), f, x.laps || 0]);
  }
  res.sort((a, b) => a[0] - b[0] || (a[3] || 999) - (b[3] || 999));
  // siralama turu sonuclari (takim arkadasi siralama duellosu icin)
  const q = [];
  for (const x of load('races-qualifying-results')) {
    const ri = raceIdx.get(x.raceId);
    if (ri === undefined || x.positionNumber == null) continue;
    q.push([ri, idx(dm, dr, x.driverId), idx(tm, te, x.constructorId), x.positionNumber]);
  }
  q.sort((a, b) => a[0] - b[0] || a[3] - b[3]);
  // sezon sonu sampiyona siralamalari
  const sd = {}, sc = {};
  for (const x of load('seasons-driver-standings')) (sd[x.year] ||= []).push([idx(dm, dr, x.driverId), x.positionNumber || 0, x.points, x.championshipWon ? 1 : 0]);
  for (const x of load('seasons-constructor-standings')) (sc[x.year] ||= []).push([idx(tm, te, x.constructorId), x.positionNumber || 0, x.points, x.championshipWon ? 1 : 0]);
  for (const o of [sd, sc]) for (const y of Object.keys(o)) o[y].sort((a, b) => (a[1] || 999) - (b[1] || 999));
  return { v: 1, races: R, gp, ci, dr, te, res, q, sd, sc, cols: { res: ['race', 'driver', 'team', 'pos', 'grid', 'pts2', 'flags', 'laps'], q: ['race', 'driver', 'team', 'pos'], sd: ['driver', 'pos', 'pts', 'champion'] } };
}

const top = (arr, n = 15) => arr.slice(0, n);

export function buildRecords(load, all) {
  const drivers = load('drivers');
  const cons = load('constructors');
  const dByid = new Map(drivers.map((d) => [d.id, d]));
  const sortBy = (list, f) => list.filter((x) => f(x) > 0).sort((a, b) => f(b) - f(a));
  const D = {
    titles: top(sortBy(drivers, (d) => d.totalChampionshipWins).map((d) => [d.id, d.totalChampionshipWins])),
    wins: top(sortBy(drivers, (d) => d.totalRaceWins).map((d) => [d.id, d.totalRaceWins])),
    poles: top(sortBy(drivers, (d) => d.totalPolePositions).map((d) => [d.id, d.totalPolePositions])),
    podiums: top(sortBy(drivers, (d) => d.totalPodiums).map((d) => [d.id, d.totalPodiums])),
    fastestLaps: top(sortBy(drivers, (d) => d.totalFastestLaps).map((d) => [d.id, d.totalFastestLaps])),
    starts: top(sortBy(drivers, (d) => d.totalRaceStarts).map((d) => [d.id, d.totalRaceStarts])),
    points: top(sortBy(drivers, (d) => d.totalChampionshipPoints).map((d) => [d.id, d.totalChampionshipPoints])),
    grandSlams: top(sortBy(drivers, (d) => d.totalGrandSlams).map((d) => [d.id, d.totalGrandSlams])),
    winRate: top(drivers.filter((d) => d.totalRaceStarts >= 40 && d.totalRaceWins > 0)
      .map((d) => [d.id, Math.round((1000 * d.totalRaceWins) / d.totalRaceStarts) / 10, d.totalRaceWins, d.totalRaceStarts])
      .sort((a, b) => b[1] - a[1]))
  };
  const T = {
    titles: top(sortBy(cons, (c) => c.totalChampionshipWins).map((c) => [c.id, c.totalChampionshipWins])),
    wins: top(sortBy(cons, (c) => c.totalRaceWins).map((c) => [c.id, c.totalRaceWins])),
    poles: top(sortBy(cons, (c) => c.totalPolePositions).map((c) => [c.id, c.totalPolePositions])),
    podiums: top(sortBy(cons, (c) => c.totalPodiums).map((c) => [c.id, c.totalPodiums])),
    oneTwos: top(sortBy(cons, (c) => c.total1And2Finishes).map((c) => [c.id, c.total1And2Finishes])),
    starts: top(sortBy(cons, (c) => c.totalRaceStarts).map((c) => [c.id, c.totalRaceStarts]))
  };

  // Sonuclardan hesaplananlar
  const { races, dr, te, ci, res } = all;
  const winsBySeason = new Map(); const polesBySeason = new Map(); const tWinsBySeason = new Map();
  const racesInSeason = new Map();
  for (const r of races) racesInSeason.set(r[1], (racesInSeason.get(r[1]) || 0) + 1);
  const circuitWins = new Map();
  const firstWinAge = new Map(); const lastWinAge = new Map(); const debutAge = new Map();
  const winnerByRace = new Map();
  const age = (dob, date) => (dob ? (Date.parse(date) - Date.parse(dob)) / 86400000 : null);
  for (const x of res) {
    const [ri, di, ti, pos, , , f] = x;
    const race = races[ri];
    const year = race[1];
    const did = dr[di];
    const d = dByid.get(did);
    if (!(f & 16) && !debutAge.has(did) && d?.dateOfBirth) debutAge.set(did, [age(d.dateOfBirth, race[3]), ri]);
    if (f & 1) { const k = `${did}|${year}`; polesBySeason.set(k, (polesBySeason.get(k) || 0) + 1); }
    if (pos === 1) {
      if (!winnerByRace.has(ri)) winnerByRace.set(ri, did);
      const k = `${did}|${year}`; winsBySeason.set(k, (winsBySeason.get(k) || 0) + 1);
      const tk = `${te[ti]}|${year}`; tWinsBySeason.set(tk, (tWinsBySeason.get(tk) || 0) + 1);
      const ck = `${did}|${ci[race[5]]}`; circuitWins.set(ck, (circuitWins.get(ck) || 0) + 1);
      if (d?.dateOfBirth) {
        const a = age(d.dateOfBirth, race[3]);
        if (!firstWinAge.has(did)) firstWinAge.set(did, [a, ri]);
        lastWinAge.set(did, [a, ri]);
      }
    }
  }
  const seasonList = (m) => [...m.entries()].map(([k, v]) => { const [id, y] = k.split('|'); return [id, Number(y), v, racesInSeason.get(Number(y))]; })
    .sort((a, b) => b[2] - a[2] || b[2] / b[3] - a[2] / a[3] || a[1] - b[1]);
  D.seasonWins = top(seasonList(winsBySeason));
  D.seasonPoles = top(seasonList(polesBySeason));
  T.seasonWins = top(seasonList(tWinsBySeason));
  D.circuitWins = top([...circuitWins.entries()].map(([k, v]) => { const [id, c] = k.split('|'); return [id, c, v]; }).sort((a, b) => b[2] - a[2]));
  const ageList = (m, asc) => [...m.entries()].map(([id, [a, ri]]) => [id, Math.round(a), races[ri][0]])
    .sort((a, b) => (asc ? a[1] - b[1] : b[1] - a[1]));
  D.youngestWinner = top(ageList(firstWinAge, true), 10);
  D.oldestWinner = top(ageList(lastWinAge, false), 10);
  D.youngestStarter = top(ageList(debutAge, true), 10);
  // ust uste galibiyet serisi (sampiyona yarislari sirasiyla; 1950-60 Indianapolis 500 haric)
  const indyIdx = all.gp.indexOf('indianapolis');
  const seqPos = new Map();
  races.forEach((r, i) => { if (r[4] !== indyIdx) seqPos.set(i, seqPos.size); });
  const streaks = [];
  let cur = null, n = 0, from = 0;
  const order = [...winnerByRace.keys()].filter((ri) => seqPos.has(ri)).sort((a, b) => a - b);
  let prevRi = null;
  for (const ri of order) {
    const w = winnerByRace.get(ri);
    const consecutive = prevRi !== null && seqPos.get(ri) === seqPos.get(prevRi) + 1;
    if (w === cur && consecutive) n++;
    else { if (cur) streaks.push([cur, n, races[from][0], races[prevRi][0]]); cur = w; n = 1; from = ri; }
    prevRi = ri;
  }
  if (cur) streaks.push([cur, n, races[from][0], races[prevRi][0]]);
  const bestStreak = new Map();
  for (const s of streaks) if (!bestStreak.has(s[0]) || bestStreak.get(s[0])[1] < s[1]) bestStreak.set(s[0], s);
  D.winStreak = top([...bestStreak.values()].filter((s) => s[1] >= 3).sort((a, b) => b[1] - a[1]));
  return { d: D, t: T };
}
