#!/usr/bin/env node
// Pit Duvari veri hatti. Kullanim:
//   node scripts/build.mjs                 tum veriyi data/ altina uretir
//   node scripts/build.mjs --out=_site/data --stories-budget=8
//   node scripts/build.mjs --no-stories --no-news   (hizli)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { args, log, readJson, writeJson, copyDir, http } from './lib/util.mjs';
import { latestF1dbRelease, downloadF1db, dropRaw, tableLoader } from './lib/f1db.mjs';
import { buildHistory, buildRef, buildAllResults, buildRecords } from './lib/hist.mjs';
import { buildGeo } from './lib/geo.mjs';
import { applyOverlay, buildNextSeason } from './lib/current.mjs';
import { buildStories } from './lib/stories.mjs';
import { buildNews } from './lib/news.mjs';
import { buildIcs } from './lib/ics.mjs';
import { of1Calls } from './lib/openf1.mjs';

const A = args();
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = path.join(ROOT, '.cache');
const OUT = path.resolve(ROOT, A.out || 'data');
const STATIC = path.join(ROOT, 'scripts', 'static');
const STORIES = path.join(ROOT, 'data', 'stories');
const REPORTS = path.join(ROOT, 'data', 'reports');
const LIVE = 'https://erenciracioglu-dotcom.github.io/pit-duvari/data/';
const now = A.now ? Date.parse(A.now) : Date.now();
const tStart = Date.now();

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const meta = { v: 1, generated: new Date(now).toISOString(), sources: {} };

  // 1) F1DB: gecmis + guncel sezon
  let rel;
  try {
    rel = await latestF1dbRelease({ token: process.env.GITHUB_TOKEN });
  } catch (e) {
    const prev = readJson(path.join(CACHE, 'f1db-last.json'));
    if (!prev) throw e;
    log('F1DB surum bilgisi alinamadi, onbellekteki surum:', prev.tag, e.message);
    rel = { ...prev, stale: true };
  }
  meta.f1db = { tag: rel.tag, published: rel.published, stale: !!rel.stale };
  const HIST_V = 2; // hist ciktisinin bicimi degisince artir (onbellegi gecersiz kilar)
  const H = path.join(CACHE, 'hist', `${rel.tag}-p${HIST_V}`);
  let seasons = {};
  let ref;
  if (fs.existsSync(path.join(H, 'done.json')) && !A.rebuild) {
    log('F1DB', rel.tag, 'onbellekten');
    ref = readJson(path.join(H, 'ref.json'));
    for (const file of fs.readdirSync(path.join(H, 'season'))) seasons[parseInt(file, 10)] = readJson(path.join(H, 'season', file));
  } else {
    if (rel.stale) throw new Error('F1DB islenmis onbellegi yok ve surum bilgisi alinamadi');
    const dataDir = await downloadF1db(rel, CACHE);
    log('F1DB', rel.tag, 'isleniyor');
    const load = tableLoader(dataDir);
    seasons = buildHistory(load);
    const geo = await buildGeo(CACHE, load('circuits').map((c) => c.id));
    ref = buildRef(load, { geoIds: new Set(Object.keys(geo)), seasons });
    const all = buildAllResults(load);
    const records = buildRecords(load, all);
    fs.rmSync(path.join(CACHE, 'hist'), { recursive: true, force: true });
    writeJson(path.join(H, 'ref.json'), ref);
    for (const [y, s] of Object.entries(seasons)) writeJson(path.join(H, 'season', `${y}.json`), s);
    writeJson(path.join(H, 'hist', 'all-results.json'), all);
    writeJson(path.join(H, 'hist', 'records.json'), records);
    writeJson(path.join(H, 'circuits-geo.json'), geo);
    writeJson(path.join(H, 'done.json'), { tag: rel.tag, at: new Date().toISOString() });
    writeJson(path.join(CACHE, 'f1db-last.json'), { tag: rel.tag, published: rel.published });
    if (!A['keep-raw']) dropRaw(CACHE);
  }
  copyDir(path.join(H, 'season'), path.join(OUT, 'season'));
  copyDir(path.join(H, 'hist'), path.join(OUT, 'hist'));
  fs.copyFileSync(path.join(H, 'circuits-geo.json'), path.join(OUT, 'circuits-geo.json'));

  const years = Object.keys(seasons).map(Number).sort((a, b) => a - b);
  const curYear = years[years.length - 1];
  const cur = seasons[curYear];

  // 2) Guncel sezon: OpenF1 ile tamamla, takim renkleri
  if (!A['no-openf1']) {
    try {
      const ov = await applyOverlay(cur, ref, { now });
      meta.sources.openf1 = { overlaid: ov.overlaid, errors: ov.errors };
      ref.colors = ov.colors;
      ref.lineup = ov.lineup;
      if (ov.overlaid.length) log('OpenF1 ile eklenenler:', ov.overlaid.join(', '));
      if (ov.errors.length) log('OpenF1 uyarilari:', ov.errors.join(' | '));
    } catch (e) {
      meta.sources.openf1 = { error: e.message };
      log('OpenF1 hata:', e.message);
    }
  }
  if (!ref.lineup || !ref.lineup.length) {
    const last = [...cur.races].reverse().find((r) => r.res);
    ref.lineup = (last?.res || []).map((x) => ({ no: x.no, d: x.d, t: x.t, code: ref.drivers[x.d]?.a }));
  }
  ref.colors ||= {};

  // 3) Gelecek sezon takvimi
  let next = seasons[curYear + 1] || null;
  if (!next) next = await buildNextSeason(curYear + 1, STATIC, ref, { now });
  writeJson(path.join(OUT, 'season', `${curYear}.json`), cur);
  if (next) writeJson(path.join(OUT, 'season', `${curYear + 1}.json`), next);
  writeJson(path.join(OUT, 'ref.json'), ref);

  // 4) Yaris hikayeleri (OpenF1, 2023+)
  if (!A['no-stories']) {
    const budget = Number(A['stories-budget'] ?? 6);
    const storyYears = [];
    for (let y = curYear; y >= 2023; y--) storyYears.push(y);
    const r = await buildStories({ seasons, years: storyYears, dir: STORIES, budget, now });
    meta.sources.stories = r;
  }
  if (path.resolve(STORIES) !== path.resolve(path.join(OUT, 'stories'))) copyDir(STORIES, path.join(OUT, 'stories'));
  if (path.resolve(REPORTS) !== path.resolve(path.join(OUT, 'reports'))) copyDir(REPORTS, path.join(OUT, 'reports'));
  const listDir = (d) => (fs.existsSync(d) ? fs.readdirSync(d).filter((x) => x.endsWith('.json')).map((x) => x.replace('.json', '')).sort() : []);
  meta.stories = listDir(STORIES);
  meta.reports = listDir(REPORTS);

  // 5) Haberler
  const newsCache = path.join(CACHE, 'news.json');
  let previous = readJson(newsCache)?.items || [];
  if (!previous.length) {
    try { previous = (await http(LIVE + 'news.json', { timeout: 15000, retries: 1 }))?.items || []; } catch { /* ilk calisma */ }
  }
  if (!A['no-news']) {
    const news = await buildNews({ previous, ref, lineup: ref.lineup, now });
    writeJson(path.join(OUT, 'news.json'), { generated: meta.generated, items: news.items, sources: news.sources });
    writeJson(newsCache, { items: news.items });
    meta.sources.news = news.status;
    log('Haberler:', news.items.length, 'oge');
  } else if (previous.length) {
    writeJson(path.join(OUT, 'news.json'), { generated: meta.generated, items: previous, sources: [] });
  }

  // 6) Takvim aboneligi
  fs.mkdirSync(path.join(OUT, 'calendar'), { recursive: true });
  fs.writeFileSync(path.join(OUT, 'calendar', 'f1-yarislar.ics'), buildIcs([cur, next], ref, { onlyRaces: true, now: new Date(now) }));
  fs.writeFileSync(path.join(OUT, 'calendar', 'f1-tum-seanslar.ics'), buildIcs([cur, next], ref, { now: new Date(now) }));

  // 7) Ozet
  meta.currentSeason = curYear;
  meta.nextSeason = next ? curYear + 1 : null;
  meta.firstSeason = years[0];
  meta.openf1Calls = of1Calls();
  meta.buildSeconds = Math.round((Date.now() - tStart) / 1000);
  writeJson(path.join(OUT, 'meta.json'), meta, true);
  log('Bitti:', `${meta.buildSeconds} sn`, `OpenF1 istegi: ${meta.openf1Calls}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
