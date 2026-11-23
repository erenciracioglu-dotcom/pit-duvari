// Yaris haftasi sayfasi: sonuc, siralama, sprint, hikaye, tekrar, pist ve hava, rapor
import { h, clear, fmtPts, lapToMs, msToLap, add } from '../core/util.js';
import { L, gpName, fmtDay, fmtTime, driverName, teamName, circuitName, nf, ordinalTr, fmtDate, sessionLabel } from '../core/i18n.js';
import * as data from '../core/data.js';
import { teamColor } from '../core/colors.js';
import { vhead, tabs, card, dchip, flag, icon, spoiler, empty, footer, loading } from '../core/ui.js';
import { raceHref, raceEndMs, resultValue, gained, trackSvg, sessionList, weekendRange, tzNote, placeLine } from './common.js';

async function seasonOf(ctx, year) {
  if (year === ctx.meta.currentSeason) return ctx.cur;
  if (year === ctx.meta.nextSeason) return ctx.next;
  return data.season(year);
}

export async function render(root, ctx) {
  const { ref, meta } = ctx;
  let year, round, tab;
  if (ctx.key === 'analiz') {
    const st = (meta.stories || []).map((k) => k.split('-').map(Number)).sort((a, b) => a[0] - b[0] || a[1] - b[1]).pop();
    if (!st) { add(root, vhead({ title: L('Yarış analizi', 'Race analysis') }), empty(L('Henüz analiz yok', 'No analysis yet'), L('İlk yarış hikâyesi birkaç saat içinde hazırlanacak.', 'The first race story will be ready within hours.'))); return; }
    [year, round] = st;
    tab = ctx.params[0] || 'hikaye';
  } else {
    year = Number(ctx.params[0]);
    round = Number(ctx.params[1]);
    tab = ctx.params[2];
  }
  const season = await seasonOf(ctx, year).catch(() => null);
  const race = season?.races.find((r) => r.r === round);
  if (!race) { add(root, vhead({ title: L('Yarış bulunamadı', 'Race not found') }), empty(L('Bu yarış bulunamadı', 'This race was not found'), null, h('a', { class: 'btn', href: '#takvim' }, L('Takvime dön', 'Back to calendar')))); return; }

  const key = data.raceKey(year, round);
  const hasRes = !!race.res?.length;
  const hasStory = (meta.stories || []).includes(key);
  const hasReport = (meta.reports || []).includes(key);
  tab ||= hasRes ? 'sonuc' : 'hafta-sonu';
  const end = raceEndMs(race);
  const items = [
    hasRes ? { key: 'sonuc', label: L('Sonuç', 'Result') } : { key: 'hafta-sonu', label: L('Hafta sonu', 'Weekend') },
    race.q?.length ? { key: 'siralama', label: L('Sıralama turları', 'Qualifying') } : null,
    race.spr?.length || race.sq?.length ? { key: 'sprint', label: 'Sprint' } : null,
    hasStory ? { key: 'hikaye', label: L('Yarışın hikâyesi', 'Race story') } : null,
    hasStory ? { key: 'tekrar', label: L('Pist tekrarı', 'Track replay') } : null,
    { key: 'pist', label: L('Pist ve hava', 'Circuit & weather') },
    hasRes ? { key: 'rapor', label: L('Rapor', 'Report') } : null
  ].filter(Boolean).map((t) => ({ ...t, href: raceHref(year, round, t.key) }));

  const idx = season.races.indexOf(race);
  const prev = season.races[idx - 1], next = season.races[idx + 1];
  const nav = h('div', { class: 'row' },
    prev ? h('a', { class: 'btn sm ghost', href: raceHref(year, prev.r), title: gpName(ref, prev.gp) }, icon('chevL'), h('span', { class: 'ellip', style: { maxWidth: '120px' } }, gpName(ref, prev.gp))) : null,
    next ? h('a', { class: 'btn sm ghost', href: raceHref(year, next.r), title: gpName(ref, next.gp) }, h('span', { class: 'ellip', style: { maxWidth: '120px' } }, gpName(ref, next.gp)), icon('chevR')) : null);
  const c = ref.circuits[race.c];
  add(root, vhead({
    crumbs: [{ href: `#takvim/${year}`, label: L(`${year} takvimi`, `${year} calendar`) }, { label: L(`${round}. yarış`, `Round ${round}`) }],
    title: gpName(ref, race.gp),
    sub: h('span', { class: 'row wrap', style: { gap: '6px 14px' } }, flag(ref, c?.nat), h('span', {}, circuitName(ref, race.c)), h('span', { class: 'dim' }, weekendRange(race), year < new Date().getFullYear() ? ` ${year}` : ''), race.sprint ? h('span', { class: 'badge' }, 'Sprint') : null, race.src === 'openf1' ? h('span', { class: 'badge' }, L('ön sonuç', 'provisional')) : null),
    actions: nav
  }), tabs(items, tab));

  const body = h('div', {});
  root.appendChild(body);
  const wrap = (el) => spoiler(key, end, el);
  switch (tab) {
    case 'sonuc': body.appendChild(wrap(resultsCard(ctx, season, race))); break;
    case 'siralama': body.appendChild(wrap(qualiCard(ctx, race, race.q, L('Sıralama turları', 'Qualifying')))); break;
    case 'sprint': body.append(...[race.spr?.length ? wrap(resultsCard(ctx, season, race, race.spr, L('Sprint sonucu', 'Sprint result'))) : null, race.sq?.length ? h('div', { class: 'mt' }, wrap(qualiCard(ctx, race, race.sq, L('Sprint sıralaması', 'Sprint qualifying')))) : null].filter(Boolean)); break;
    case 'hikaye': { body.appendChild(loading()); const m = await import('./race-story.js'); const el = await m.storyView(ctx, season, race); clear(body).appendChild(wrap(el)); break; }
    case 'tekrar': { body.appendChild(loading()); const m = await import('./race-replay.js'); const el = await m.replayView(ctx, season, race); clear(body).appendChild(wrap(el)); break; }
    case 'pist': body.appendChild(await circuitTab(ctx, season, race)); break;
    case 'rapor': body.appendChild(wrap(await reportTab(ctx, season, race, hasReport))); break;
    default: body.appendChild(await weekendTab(ctx, season, race));
  }
  root.appendChild(footer(meta));
}

function resultsCard(ctx, season, race, rows = race.res, title = L('Yarış sonucu', 'Race result')) {
  const { ref, profile } = ctx;
  const fav = new Set(profile.favDrivers);
  const winnerLaps = rows[0]?.l;
  const tbl = h('table', { class: 'tbl' },
    h('thead', {}, h('tr', {}, h('th', { class: 'n' }, L('Sıra', 'Pos')), h('th', {}, L('Pilot', 'Driver')), h('th', { class: 'hide-sm' }, L('Takım', 'Team')), h('th', { class: 'n hide-sm' }, L('Tur', 'Laps')), h('th', { class: 'n' }, L('Süre / fark', 'Time / gap')), h('th', { class: 'n' }, L('Puan', 'Pts')), h('th', { class: 'n' }, L('Grid', 'Grid')), h('th', {}, ''))),
    h('tbody', {}, rows.map((x) => h('tr', { class: fav.has(x.d) ? 'fav' : null },
      h('td', { class: 'p' }, x.pn ?? h('span', { class: 'dim', style: { fontSize: '0.8rem' } }, x.p)),
      h('td', {}, dchip(ref, x.d, { t: x.t })),
      h('td', { class: 'hide-sm muted' }, teamName(ref, x.t)),
      h('td', { class: 'n hide-sm' }, x.l ?? ''),
      h('td', { class: ['n', x.pn == null && 'dim'] }, resultValue(x)),
      h('td', { class: 'n strong' }, x.pts ? fmtPts(x.pts) : ''),
      h('td', { class: 'n' }, x.g ? h('span', {}, x.g, ' ', gained(x)) : x.gt ? h('span', { class: 'dim', title: L('Pit çıkışından başladı', 'Started from pit lane') }, L('Pit', 'PL')) : ''),
      h('td', {}, h('span', { class: 'row', style: { gap: '4px' } }, x.pole ? h('span', { class: 'badge', title: 'Pole' }, 'P') : null, x.fl ? h('span', { class: 'badge best', title: L('En hızlı tur', 'Fastest lap') }, L('EHT', 'FL')) : null, x.dotd ? h('span', { class: 'badge', title: L('Günün pilotu', 'Driver of the day') }, '★') : null, x.pen ? h('span', { class: 'badge bad', title: L('Zaman cezası', 'Time penalty') }, L(`+${parseFloat(x.pen)} sn ceza`, `+${parseFloat(x.pen)}s pen.`)) : null))))));
  const facts = [];
  if (rows === race.res) {
    if (race.fl) facts.push(h('span', {}, h('span', { class: 'badge best' }, L('En hızlı tur', 'Fastest lap')), ' ', driverName(ref, race.fl.d), ` ${race.fl.tm}`, race.fl.lap ? L(` (${race.fl.lap}. tur)`, ` (lap ${race.fl.lap})`) : ''));
    if (race.dotd?.length) facts.push(h('span', {}, h('span', { class: 'badge' }, L('Günün pilotu', 'Driver of the day')), ' ', race.dotd.map((x) => `${driverName(ref, x.d, 'last')} %${x.pct}`).join(', ')));
    const mover = rows.filter((x) => x.pn && x.g).map((x) => ({ x, d: x.g - x.pn })).sort((a, b) => b.d - a.d)[0];
    if (mover?.d > 0) facts.push(h('span', {}, h('span', { class: 'badge pb' }, L('En çok yükselen', 'Biggest climber')), ' ', driverName(ref, mover.x.d), ` +${mover.d}`));
  }
  return h('div', { class: 'stack' },
    h('section', { class: 'card flush' }, h('header', {}, h('h2', {}, title), h('span', { class: 'sp' }), winnerLaps ? h('span', { class: 'dim t-small' }, L(`${winnerLaps} tur`, `${winnerLaps} laps`)) : null), h('div', { class: 'tbl-wrap' }, tbl)),
    facts.length ? h('div', { class: 'row wrap muted t-small', style: { gap: '8px 18px' } }, facts) : null,
    race.res && rows === race.res ? podiumTiles(ctx, race) : null);
}

function podiumTiles(ctx, race) {
  const { ref } = ctx;
  const top = race.res.filter((x) => x.pn && x.pn <= 3).sort((a, b) => a.pn - b.pn);
  if (top.length < 3) return null;
  return h('div', { class: 'stats' }, top.map((x) => h('a', { class: 'stat', href: `#surucu/${x.d}`, style: { textDecoration: 'none', borderTop: `3px solid ${teamColor(x.t)}` } },
    h('div', { class: 'v' }, ordinalTr(x.pn)), h('div', { class: 'strong', style: { marginTop: '6px' } }, driverName(ref, x.d)), h('div', { class: 'k' }, teamName(ref, x.t)))));
}

function qualiCard(ctx, race, rows, title) {
  const { ref, profile } = ctx;
  const fav = new Set(profile.favDrivers);
  const best = {};
  for (const k of ['q1', 'q2', 'q3', 'tm']) {
    const v = rows.map((x) => lapToMs(x[k])).filter(Boolean);
    if (v.length) best[k] = Math.min(...v);
  }
  const pole = lapToMs(rows[0]?.q3 || rows[0]?.q2 || rows[0]?.q1 || rows[0]?.tm);
  const cell = (x, k) => {
    const ms = lapToMs(x[k]);
    if (!ms) return h('td', { class: 'n dim' }, '');
    return h('td', { class: ['n', ms === best[k] && 'best strong'] }, x[k]);
  };
  const cols = ['q1', 'q2', 'q3'].filter((k) => best[k]);
  if (!cols.length && best.tm) cols.push('tm');
  return h('section', { class: 'card flush' }, h('header', {}, h('h2', {}, title)),
    h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl' },
      h('thead', {}, h('tr', {}, h('th', { class: 'n' }, L('Sıra', 'Pos')), h('th', {}, L('Pilot', 'Driver')), cols.map((k) => h('th', { class: 'n' }, k === 'tm' ? L('Süre', 'Time') : k.toUpperCase())), h('th', { class: 'n' }, L('Fark', 'Gap')))),
      h('tbody', {}, rows.map((x) => {
        const bestOwn = lapToMs(x.q3 || x.q2 || x.q1 || x.tm);
        return h('tr', { class: fav.has(x.d) ? 'fav' : null },
          h('td', { class: 'p' }, x.pn ?? h('span', { class: 'dim', style: { fontSize: '0.8rem' } }, x.p)),
          h('td', {}, dchip(ref, x.d, { t: x.t })),
          cols.map((k) => cell(x, k)),
          h('td', { class: 'n muted' }, x.pn === 1 || !bestOwn || !pole ? '' : msToLap(bestOwn - pole, { plus: true })));
      })))),
    h('p', { class: 'foot-note', style: { padding: '0 16px 14px' } }, L('Mor: o turdaki en hızlı zaman. Fark, her pilotun en son ulaştığı turdaki zamanından hesaplanır.', 'Purple: fastest time of that segment. Gap uses each driver’s time in the last segment they reached.')));
}

async function weekendTab(ctx, season, race) {
  const { ref } = ctx;
  const geo = await data.geo().catch(() => ({}));
  const wrap = h('div', { class: 'grid g-7-5' });
  const left = h('div', { class: 'stack' });
  const right = h('div', { class: 'stack' });
  wrap.append(left, right);
  left.appendChild(card(L('Program', 'Schedule'), h('div', {}, h('div', { class: 'sessions', style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '8px' } }, sessionList(race)), h('div', { class: 'mt' }, tzNote()),
    season.provisional ? h('p', { class: 'foot-note' }, L('Seans saatleri FIA tarafından açıklanınca burada görünecek.', 'Session times will appear once the FIA publishes them.')) : null)));
  if (race.q?.length) left.appendChild(qualiCard(ctx, race, race.q, L('Sıralama turları', 'Qualifying')));
  left.appendChild(await weatherCard(ctx, race));
  right.appendChild(circuitCard(ctx, race, geo[race.c]));
  right.appendChild(await previousCard(ctx, season, race));
  right.appendChild(card(L('Tahminini yap', 'Make your prediction'), h('div', {},
    h('p', { class: 'muted', style: { marginTop: 0 } }, L('Pole, podyum ve en hızlı turu tahmin et; sonuç gelince puanını gör.', 'Predict pole, podium and fastest lap; see your score after the race.')),
    h('a', { class: 'btn pri', href: '#tahmin' }, icon('target'), L('Tahmin oyunu', 'Predictions')))));
  return wrap;
}

function circuitCard(ctx, race, g) {
  const { ref } = ctx;
  const c = ref.circuits[race.c] || {};
  const facts = [
    [L('Tur uzunluğu', 'Lap length'), race.len || c.len ? `${nf(race.len || c.len, 3)} km` : '–'],
    [L('Viraj', 'Turns'), race.turns || c.turns || '–'],
    [L('Tur sayısı', 'Laps'), race.laps || '–'],
    [L('Yarış mesafesi', 'Distance'), race.dist ? `${nf(race.dist, 1)} km` : '–'],
    [L('Yön', 'Direction'), (race.dir || c.dir) === 'ANTI_CLOCKWISE' ? L('Saat yönünün tersi', 'Anticlockwise') : L('Saat yönü', 'Clockwise')],
    [L('Tür', 'Type'), { STREET: L('Sokak pisti', 'Street circuit'), RACE: L('Yarış pisti', 'Race circuit'), ROAD: L('Yol pisti', 'Road course') }[race.type || c.type] || '–'],
    [L('Düzenlenen yarış', 'Races held'), c.races || '–']
  ];
  return card(L('Pist', 'Circuit'), h('div', {},
    g ? h('div', { style: { maxWidth: '360px', margin: '0 auto 12px' } }, trackOutline(g)) : null,
    h('div', { class: 'strong' }, circuitName(ref, race.c)), h('div', { class: 'muted t-small' }, placeLine(ref, race.c)),
    h('dl', { class: 'kv mt' }, facts.flatMap(([k, v]) => [h('dt', {}, k), h('dd', { class: 'num' }, String(v))]))), { more: { href: `#pist/${race.c}`, label: L('Pist rehberi', 'Circuit guide') } });
}

export function trackOutline(g) {
  const el = trackSvg(g, null);
  el.style.width = '100%';
  el.style.height = 'auto';
  el.querySelector('path').setAttribute('style', 'fill:none;stroke:var(--accent);stroke-width:3;vector-effect:non-scaling-stroke;stroke-linejoin:round');
  return el;
}

async function previousCard(ctx, season, race) {
  const { ref } = ctx;
  let prevRace = null, prevYear = null;
  for (let y = season.year - 1; y >= Math.max(1950, season.year - 6) && !prevRace; y--) {
    try {
      const s = await data.season(y);
      prevRace = s.races.find((r) => r.gp === race.gp && r.res?.length) || s.races.find((r) => r.c === race.c && r.res?.length);
      if (prevRace) prevYear = y;
    } catch { /* yok */ }
  }
  if (!prevRace) return card(L('Geçmiş', 'History'), h('p', { class: 'muted', style: { margin: 0 } }, L('Bu yarış yakın geçmişte düzenlenmedi.', 'This race was not held recently.')));
  const pod = prevRace.res.filter((x) => x.pn && x.pn <= 3).sort((a, b) => a.pn - b.pn);
  return card(L(`${prevYear} podyumu`, `${prevYear} podium`), h('div', { class: 'list' }, pod.map((x) => h('div', { class: 'li' }, h('span', { class: 'cond strong', style: { width: '26px', fontSize: '1.2rem' } }, x.pn), dchip(ref, x.d, { t: x.t }), h('span', { class: 'sp' }), h('span', { class: 'muted num t-small' }, resultValue(x))))),
  { more: { href: raceHref(prevYear, prevRace.r), label: L('O yarış', 'That race') } });
}

// ---- hava durumu (Open-Meteo) ----
const WMO = (c) => (c === 0 ? ['☀️', L('Açık', 'Clear')] : c <= 2 ? ['🌤️', L('Az bulutlu', 'Partly cloudy')] : c === 3 ? ['☁️', L('Bulutlu', 'Cloudy')] : c <= 48 ? ['🌫️', L('Sisli', 'Fog')]
  : c <= 57 ? ['🌦️', L('Çisenti', 'Drizzle')] : c <= 67 ? ['🌧️', L('Yağmurlu', 'Rain')] : c <= 77 ? ['🌨️', L('Kar', 'Snow')] : c <= 82 ? ['🌦️', L('Sağanak', 'Showers')] : ['⛈️', L('Fırtına', 'Thunderstorm')]);

async function weatherCard(ctx, race) {
  const { ref } = ctx;
  const c = ref.circuits[race.c];
  const ss = data.sessionsOf(race);
  if (!c || !ss.length) return card(L('Hava durumu', 'Weather'), h('p', { class: 'muted', style: { margin: 0 } }, '–'));
  const first = ss[0].start, last = ss[ss.length - 1].start;
  const daysAhead = (first - Date.now()) / 86400000;
  if (daysAhead > 15) return card(L('Hava durumu', 'Weather'), h('p', { class: 'muted', style: { margin: 0 } }, L('Tahmin, yarış haftasına 15 gün kala burada açılır.', 'The forecast opens here 15 days before the weekend.')));
  if (last < Date.now() - 86400000) return card(L('Hava durumu', 'Weather'), h('p', { class: 'muted', style: { margin: 0 } }, L('Yarışın hava verisi "Yarışın hikâyesi" bölümünde.', 'Race-day weather is in the race story.')));
  const start = new Date(first).toISOString().slice(0, 10), endD = new Date(last).toISOString().slice(0, 10);
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${c.lat}&longitude=${c.lng}&hourly=temperature_2m,precipitation_probability,weather_code,wind_speed_10m&start_date=${start}&end_date=${endD}&timezone=UTC`;
    const w = await (await fetch(url)).json();
    const times = w.hourly.time.map((t) => Date.parse(t + ':00Z'));
    const rows = ss.filter((x) => x.timed).map((x) => {
      let i = times.findIndex((t) => t >= x.start - 1800000);
      if (i < 0) i = times.length - 1;
      const [ic, txt] = WMO(w.hourly.weather_code[i]);
      return h('div', { class: 'li' },
        h('span', { style: { fontSize: '1.4rem', width: '28px' } }, ic),
        h('div', {}, h('div', { class: 'li-t' }, sessionLabel(x.k)), h('div', { class: 'li-s' }, `${fmtDay(x.start)} ${fmtTime(x.start)}, ${txt}`)),
        h('div', { class: 'r num' }, h('div', { class: 'strong' }, `${Math.round(w.hourly.temperature_2m[i])}°C`), h('div', { class: 'li-s' }, `${L('yağış', 'rain')} %${w.hourly.precipitation_probability[i] ?? 0}`)));
    });
    return card(L('Hava tahmini', 'Forecast'), h('div', {}, h('div', { class: 'list' }, rows), h('p', { class: 'foot-note' }, L('Kaynak: Open-Meteo, pistin konumu için saatlik tahmin.', 'Source: Open-Meteo hourly forecast for the circuit location.'))));
  } catch {
    return card(L('Hava tahmini', 'Forecast'), h('p', { class: 'muted', style: { margin: 0 } }, L('Hava tahmini şu an alınamadı.', 'The forecast is unavailable right now.')));
  }
}

async function circuitTab(ctx, season, race) {
  const geo = await data.geo().catch(() => ({}));
  const wrap = h('div', { class: 'grid g2' });
  wrap.append(circuitCard(ctx, race, geo[race.c]), h('div', { class: 'stack' }, await weatherCard(ctx, race), await winnersHere(ctx, race)));
  return wrap;
}

async function winnersHere(ctx, race) {
  const { ref } = ctx;
  try {
    const all = await data.allResults();
    const ci = all.ci.indexOf(race.c);
    const rIdx = new Set(all.races.map((r, i) => (r[5] === ci ? i : -1)).filter((i) => i >= 0));
    const wins = all.res.filter((x) => rIdx.has(x[0]) && x[3] === 1).map((x) => ({ year: all.races[x[0]][1], round: all.races[x[0]][2], d: all.dr[x[1]], t: all.te[x[2]] })).sort((a, b) => b.year - a.year);
    const count = new Map();
    for (const w of wins) count.set(w.d, (count.get(w.d) || 0) + 1);
    const kings = [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
    return card(L('Bu pistte kazananlar', 'Winners here'), h('div', {},
      kings.length ? h('p', { class: 'muted', style: { marginTop: 0 } }, L('En çok kazananlar: ', 'Most wins: '), kings.map(([d, n]) => `${driverName(ref, d)} (${n})`).join(', ')) : null,
      h('div', { class: 'list' }, wins.slice(0, 8).map((w) => h('a', { class: 'li', href: raceHref(w.year, w.round) }, h('span', { class: 'num dim', style: { width: '44px' } }, w.year), dchip(ref, w.d, { t: w.t, link: false }))))));
  } catch {
    return card(L('Bu pistte kazananlar', 'Winners here'), h('p', { class: 'muted', style: { margin: 0 } }, '–'));
  }
}

async function reportTab(ctx, season, race, hasReport) {
  const { ref } = ctx;
  const box = h('div', { class: 'stack' });
  if (hasReport) {
    try {
      const rp = await data.report(season.year, race.r);
      box.appendChild(h('article', { class: 'card', style: { maxWidth: '72ch' } },
        h('h2', { class: 't-h2' }, rp.title),
        ...(rp.body || []).map((p) => h('p', { style: { lineHeight: 1.65 } }, p)),
        h('p', { class: 'foot-note' }, L(`Bu rapor yarış verisinden Claude tarafından yazıldı (${fmtDate(rp.written)}).`, `Written by Claude from race data (${fmtDate(rp.written)}).`))));
    } catch { /* yok */ }
  }
  let story = null;
  if ((ctx.meta.stories || []).includes(data.raceKey(season.year, race.r))) story = await data.story(season.year, race.r).catch(() => null);
  box.appendChild(card(L('Otomatik özet', 'Automatic summary'), h('div', { style: { maxWidth: '72ch' } }, autoSummary(ref, season, race, story).map((p) => h('p', { style: { margin: '0 0 10px', lineHeight: 1.6 } }, p)))));
  return box;
}

export function autoSummary(ref, season, race, story) {
  const res = race.res || [];
  const out = [];
  const nm = (d) => driverName(ref, d);
  const w = res[0];
  if (!w) return [L('Bu yarışın sonucu henüz yok.', 'No result yet.')];
  const fromPole = w.g === 1;
  out.push(L(`${gpName(ref, race.gp)} yarışını ${nm(w.d)} (${teamName(ref, w.t)}) kazandı${fromPole ? '; yarışa pole pozisyonundan başlamıştı.' : w.g ? `; yarışa ${w.g}. sıradan başlamıştı.` : '.'}`,
    `${nm(w.d)} (${teamName(ref, w.t)}) won the ${gpName(ref, race.gp)}${fromPole ? ' from pole.' : w.g ? ` from ${ordinalTr(w.g)} on the grid.` : '.'}`));
  const p2 = res[1], p3 = res[2];
  if (p2 && p3) out.push(L(`Podyumun diğer basamaklarında ${nm(p2.d)} ${p2.gap ? `(${p2.gap} sn geride)` : ''} ve ${nm(p3.d)} vardı.`, `${nm(p2.d)} ${p2.gap ? `(${p2.gap}s back)` : ''} and ${nm(p3.d)} completed the podium.`));
  const dnf = res.filter((x) => x.pn == null && x.p !== 'DNS');
  if (dnf.length) out.push(L(`${dnf.length} pilot yarışı bitiremedi: ${dnf.map((x) => `${driverName(ref, x.d, 'last')}${x.st ? ` (${(x.st && x.st !== 'Retired') ? x.st : 'bıraktı'})` : ''}`).join(', ')}.`, `${dnf.length} retirements: ${dnf.map((x) => `${driverName(ref, x.d, 'last')}${x.st ? ` (${x.st})` : ''}`).join(', ')}.`));
  const mover = res.filter((x) => x.pn && x.g).map((x) => ({ x, d: x.g - x.pn })).sort((a, b) => b.d - a.d)[0];
  if (mover?.d >= 3) out.push(L(`Günün en çok yükseleni ${nm(mover.x.d)} oldu: ${mover.x.g}. sıradan başlayıp ${mover.x.pn}. bitirdi.`, `Biggest climber: ${nm(mover.x.d)}, from ${ordinalTr(mover.x.g)} to ${ordinalTr(mover.x.pn)}.`));
  if (story?.sc?.length) {
    const parts = story.sc.map(([k, a, b]) => `${k === 'SC' ? L('güvenlik aracı', 'safety car') : k === 'VSC' ? L('sanal güvenlik aracı', 'virtual safety car') : L('kırmızı bayrak', 'red flag')} (${a}${b && b !== a ? '–' + b : ''}. ${L('turlar', 'laps')})`);
    out.push(L(`Yarışta ${parts.join(', ')} vardı.`, `The race saw ${parts.join(', ')}.`));
  }
  if (race.fl) out.push(L(`En hızlı turu ${nm(race.fl.d)} attı: ${race.fl.tm}.`, `Fastest lap: ${nm(race.fl.d)}, ${race.fl.tm}.`));
  const st = data.standingsAfter(season, race.r);
  if (st.d?.length >= 2) out.push(L(`Bu yarıştan sonra şampiyonada ${nm(st.d[0][0])} ${fmtPts(st.d[0][2])} puanla önde; ${nm(st.d[1][0])} ${fmtPts(st.d[0][2] - st.d[1][2])} puan geride.`, `After this race ${nm(st.d[0][0])} leads on ${fmtPts(st.d[0][2])} pts, ${fmtPts(st.d[0][2] - st.d[1][2])} ahead of ${nm(st.d[1][0])}.`));
  return out;
}
