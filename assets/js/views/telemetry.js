// Telemetri duellosu: iki pilotun turunu hiz, gaz, fren, vites ve zaman farkiyla ust uste koyar.
import { h, s, clear, add, msToLap } from '../core/util.js';
import { L, gpName, sessionLabel, nf } from '../core/i18n.js';
import * as data from '../core/data.js';
import { vhead, card, empty, footer, loading, errorBox } from '../core/ui.js';
import { teleChart } from '../core/charts.js';
import { of1, meetingSessions } from '../core/openf1.js';

const KINDS = ['q', 'r', 'sq', 'spr', 'fp3', 'fp2', 'fp1'];

export async function render(root, ctx) {
  const { ref, meta } = ctx;
  const p = ctx.params;
  const years = []; for (let y = meta.currentSeason; y >= 2023; y--) years.push(y);
  const state = { year: Number(p[0]) || null, round: Number(p[1]) || null, kind: p[2] || 'q', a: p[3] || null, b: p[4] || null };
  // varsayilan: son yaris
  if (!state.year) {
    const last = data.lastRace(ctx.seasons);
    state.year = last?.season.year || meta.currentSeason;
    state.round = last?.race.r || 1;
  }
  const head = vhead({ title: L('Telemetri düellosu', 'Telemetry duel'), sub: L('İki pilotun turunu metre metre karşılaştır: hız, gaz, fren, vites ve aradaki zaman farkı. Veri OpenF1’den doğrudan gelir (2023 ve sonrası).', 'Compare two drivers’ laps metre by metre: speed, throttle, brake, gear and the time gap. Data comes straight from OpenF1 (2023 onwards).') });
  const form = h('div', { class: 'filters' });
  const out = h('div', {});
  add(root, head, form, out, footer(meta));

  let season = await data.season(state.year).catch(() => ctx.cur);
  let drivers = [];

  const go = () => { location.hash = `#telemetri/${state.year}/${state.round}/${state.kind}/${state.a || ''}/${state.b || ''}`.replace(/\/+$/, ''); };

  async function buildForm() {
    clear(form);
    const done = season.races.filter((r) => r.res?.length || data.raceState(r) !== 'upcoming');
    if (!done.some((r) => r.r === state.round)) state.round = done[done.length - 1]?.r || 1;
    const race = season.races.find((r) => r.r === state.round);
    form.append(
      h('select', { 'aria-label': L('Sezon', 'Season'), onChange: async (e) => { state.year = Number(e.target.value); season = await data.season(state.year); state.round = null; state.a = state.b = null; go(); } }, years.map((y) => h('option', { value: y, selected: y === state.year }, y))),
      h('select', { 'aria-label': L('Yarış', 'Race'), onChange: (e) => { state.round = Number(e.target.value); state.a = state.b = null; go(); } }, done.map((r) => h('option', { value: r.r, selected: r.r === state.round }, `${r.r}. ${gpName(ref, r.gp)}`))));
    if (!race) return;
    let ms;
    try { ms = await meetingSessions(state.year, race); } catch (e) { out.replaceChildren(errorBox(e.message)); return; }
    if (!ms) { out.replaceChildren(empty(L('Bu yarış için OpenF1 verisi bulunamadı', 'No OpenF1 data for this race'), null)); return; }
    const kinds = KINDS.filter((k) => ms[k]);
    if (!kinds.includes(state.kind)) state.kind = kinds[0];
    form.append(h('select', { 'aria-label': L('Seans', 'Session'), onChange: (e) => { state.kind = e.target.value; go(); } }, kinds.map((k) => h('option', { value: k, selected: k === state.kind }, sessionLabel(k)))));
    const sess = ms[state.kind];
    out.replaceChildren(loading());
    try { drivers = await of1(`drivers?session_key=${sess.session_key}`); } catch (e) { out.replaceChildren(errorBox(e.message)); return; }
    const order = (race.q || race.res || []).map((x) => x.d);
    const dOf = (od) => (race.res || race.q || []).find((x) => String(x.no) === String(od.driver_number))?.d;
    drivers.sort((x, y) => (order.indexOf(dOf(x)) + 1 || 99) - (order.indexOf(dOf(y)) + 1 || 99));
    const codes = drivers.map((d) => d.name_acronym);
    if (!codes.includes(state.a)) state.a = codes[0];
    if (!codes.includes(state.b) || state.b === state.a) state.b = codes.find((c) => c !== state.a);
    const dsel = (key) => h('select', { 'aria-label': key === 'a' ? L('1. pilot', 'Driver 1') : L('2. pilot', 'Driver 2'), onChange: (e) => { state[key] = e.target.value; go(); } },
      drivers.map((d) => h('option', { value: d.name_acronym, selected: d.name_acronym === state[key] }, `${d.name_acronym} ${d.last_name || ''}`)));
    form.append(dsel('a'), h('span', { class: 'dim' }, 'vs'), dsel('b'));
    await compare(race, sess);
  }

  async function compare(race, sess) {
    const A = drivers.find((d) => d.name_acronym === state.a), B = drivers.find((d) => d.name_acronym === state.b);
    if (!A || !B) return;
    out.replaceChildren(loading());
    try {
      const [la, lb] = await Promise.all([of1(`laps?session_key=${sess.session_key}&driver_number=${A.driver_number}`), of1(`laps?session_key=${sess.session_key}&driver_number=${B.driver_number}`)]);
      const best = (laps) => laps.filter((l) => l.lap_duration && !l.is_pit_out_lap && l.date_start).sort((x, y) => x.lap_duration - y.lap_duration)[0];
      const lapA = best(la), lapB = best(lb);
      if (!lapA || !lapB) { out.replaceChildren(empty(L('Karşılaştırılacak tur yok', 'No lap to compare'), L('Pilotlardan biri bu seansta geçerli bir tur atmamış.', 'One of the drivers set no valid lap in this session.'))); return; }
      const win = (lap) => { const a = new Date(Date.parse(lap.date_start) - 1500).toISOString().replace('Z', ''); const b = new Date(Date.parse(lap.date_start) + lap.lap_duration * 1000 + 1500).toISOString().replace('Z', ''); return `date>=${a}&date<${b}`; };
      const [ca, cb, loc] = await Promise.all([
        of1(`car_data?session_key=${sess.session_key}&driver_number=${A.driver_number}&${win(lapA)}`),
        of1(`car_data?session_key=${sess.session_key}&driver_number=${B.driver_number}&${win(lapB)}`),
        of1(`location?session_key=${sess.session_key}&driver_number=${A.driver_number}&${win(lapA)}`).catch(() => [])
      ]);
      out.replaceChildren(renderDuel(ctx, race, sess, A, B, lapA, lapB, ca, cb, loc));
    } catch (e) {
      out.replaceChildren(errorBox(e.message));
    }
  }

  out.appendChild(loading());
  await buildForm();
}

// mesafe: hizin zamana gore integrali (km/s -> m)
function profile(cd, lap) {
  const t0 = Date.parse(lap.date_start), t1 = t0 + lap.lap_duration * 1000;
  const pts = cd.map((p) => ({ t: Date.parse(p.date), v: p.speed, th: p.throttle, br: p.brake > 0 ? 100 : 0, g: p.n_gear, rpm: p.rpm }))
    .filter((p) => p.t >= t0 - 300 && p.t <= t1 + 300).sort((a, b) => a.t - b.t);
  let d = 0;
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    if (i) d += ((pts[i - 1].v + pts[i].v) / 2 / 3.6) * ((pts[i].t - pts[i - 1].t) / 1000);
    out.push({ ...pts[i], d, s: (pts[i].t - t0) / 1000 });
  }
  return out;
}

function interp(arr, key, x, xKey = 'd') {
  let lo = 0, hi = arr.length - 1;
  if (!arr.length) return null;
  if (x <= arr[0][xKey]) return arr[0][key];
  if (x >= arr[hi][xKey]) return arr[hi][key];
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (arr[m][xKey] < x) lo = m; else hi = m; }
  const a = arr[lo], b = arr[hi];
  const k = (x - a[xKey]) / (b[xKey] - a[xKey] || 1);
  return a[key] + (b[key] - a[key]) * k;
}

function renderDuel(ctx, race, sess, A, B, lapA, lapB, ca, cb, loc) {
  const pa = profile(ca, lapA), pb = profile(cb, lapB);
  const len = pa[pa.length - 1]?.d || 5000;
  const kb = len / (pb[pb.length - 1]?.d || len);
  for (const p of pb) p.d *= kb;
  const colA = '#' + (A.team_colour || 'edf1f5');
  let colB = '#' + (B.team_colour || 'a8b4c1');
  const sameTeam = colA.toLowerCase() === colB.toLowerCase();
  if (sameTeam) colB = '#edf1f5';
  // zaman farki (A - B): pozitifse A yavas
  const step = 10;
  const delta = [];
  for (let x = 0; x <= len; x += step) delta.push([x, Math.round((interp(pa, 's', x) - interp(pb, 's', x)) * 1000) / 1000]);
  const dMax = Math.max(0.2, ...delta.map((d) => Math.abs(d[1])));
  const ser = (p, key) => p.map((q) => [q.d, q[key]]);
  const panels = [
    { key: 'v', label: L('Hız (km/s)', 'Speed (km/h)'), height: 170, min: 0, max: Math.ceil(Math.max(...pa.map((p) => p.v), ...pb.map((p) => p.v)) / 50) * 50, ticks: [0, 100, 200, 300].filter((x) => x <= 360), fmt: (v) => Math.round(v), series: [{ label: A.name_acronym, color: colA, pts: ser(pa, 'v') }, { label: B.name_acronym, color: colB, dash: sameTeam, pts: ser(pb, 'v') }] },
    { key: 'delta', label: L(`Fark: ${A.name_acronym} − ${B.name_acronym} (sn; yukarısı ${A.name_acronym} geride)`, `Gap: ${A.name_acronym} − ${B.name_acronym} (s; up means ${A.name_acronym} behind)`), height: 90, min: -dMax, max: dMax, ticks: [-dMax, 0, dMax].map((v) => Math.round(v * 100) / 100), fmt: (v) => (v > 0 ? '+' : '') + nf(v, 2), series: [{ label: 'Δ', color: 'var(--ink)', pts: delta }] },
    { key: 'th', label: L('Gaz (%)', 'Throttle (%)'), height: 80, min: 0, max: 100, ticks: [0, 100], fmt: (v) => Math.round(v), series: [{ label: A.name_acronym, color: colA, pts: ser(pa, 'th') }, { label: B.name_acronym, color: colB, dash: sameTeam, pts: ser(pb, 'th') }] },
    { key: 'br', label: L('Fren', 'Brake'), height: 46, min: 0, max: 100, ticks: [0, 100], fmt: (v) => (v > 50 ? L('basılı', 'on') : '–'), series: [{ label: A.name_acronym, color: colA, pts: ser(pa, 'br') }, { label: B.name_acronym, color: colB, dash: sameTeam, pts: ser(pb, 'br') }] },
    { key: 'g', label: L('Vites', 'Gear'), height: 70, min: 1, max: 8, ticks: [1, 4, 8], fmt: (v) => Math.round(v), series: [{ label: A.name_acronym, color: colA, pts: ser(pa, 'g') }, { label: B.name_acronym, color: colB, dash: sameTeam, pts: ser(pb, 'g') }] }
  ];
  const mapEl = h('div', {});
  const marker = { set: null };
  const chart = teleChart(panels, { xMax: len, xFmt: (x) => `${nf(x / 1000, 2)} km`, onX: (x) => marker.set?.(x) });
  const stat = (label, a, b, better) => h('div', { class: 'h2h' }, h('div', { class: ['a', better === 'a' && 'pb'] }, a), h('div', { class: 'lbl' }, label), h('div', { class: ['b', better === 'b' && 'pb'] }, b));
  const fullTh = (p) => Math.round((100 * p.filter((q) => q.th >= 98).length) / (p.length || 1));
  const vmax = (p) => Math.max(...p.map((q) => q.v));
  const avg = (p) => (len / 1000) / (p[p.length - 1].s / 3600);
  const summary = h('div', { class: 'stack' },
    h('div', { class: 'h2h' }, h('div', { class: 'a', style: { color: colA } }, A.name_acronym), h('div', { class: 'lbl' }, ''), h('div', { class: 'b', style: { color: colB } }, B.name_acronym)),
    stat(L('Tur süresi', 'Lap time'), msToLap(lapA.lap_duration * 1000), msToLap(lapB.lap_duration * 1000), lapA.lap_duration < lapB.lap_duration ? 'a' : 'b'),
    stat(L('Hangi tur', 'Lap no.'), lapA.lap_number, lapB.lap_number),
    stat(L('En yüksek hız', 'Top speed'), `${vmax(pa)}`, `${vmax(pb)}`, vmax(pa) > vmax(pb) ? 'a' : 'b'),
    stat(L('Ortalama hız', 'Average speed'), nf(avg(pa), 1), nf(avg(pb), 1), avg(pa) > avg(pb) ? 'a' : 'b'),
    stat(L('Tam gaz oranı', 'Full throttle'), `%${fullTh(pa)}`, `%${fullTh(pb)}`),
    stat(L('1. sektör', 'Sector 1'), nf(lapA.duration_sector_1, 3), nf(lapB.duration_sector_1, 3), lapA.duration_sector_1 < lapB.duration_sector_1 ? 'a' : 'b'),
    stat(L('2. sektör', 'Sector 2'), nf(lapA.duration_sector_2, 3), nf(lapB.duration_sector_2, 3), lapA.duration_sector_2 < lapB.duration_sector_2 ? 'a' : 'b'),
    stat(L('3. sektör', 'Sector 3'), nf(lapA.duration_sector_3, 3), nf(lapB.duration_sector_3, 3), lapA.duration_sector_3 < lapB.duration_sector_3 ? 'a' : 'b'));

  // pist ustunde hangi pilotun hizli oldugu (hakimiyet haritasi)
  if (loc.length > 30) {
    const t0 = Date.parse(lapA.date_start);
    const pts = loc.map((p) => ({ x: p.x, y: -p.y, s: (Date.parse(p.date) - t0) / 1000 })).filter((p) => p.s >= 0 && p.s <= lapA.lap_duration);
    for (const p of pts) p.d = interp(pa, 'd', p.s, 's');
    const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
    const minX = Math.min(...xs), minY = Math.min(...ys), w = Math.max(...xs) - minX, hgt = Math.max(...ys) - minY;
    const pad = Math.max(w, hgt) * 0.06;
    const sc = Math.max(w, hgt) / 600;
    const svg = s('svg', { viewBox: `${minX - pad} ${minY - pad} ${w + 2 * pad} ${hgt + 2 * pad}`, style: 'width:100%;height:auto;max-height:420px', role: 'img', 'aria-label': L('Pistte kim hızlı', 'Who is faster where') });
    for (let i = 1; i < pts.length; i++) {
      const d = pts[i].d;
      const va = interp(pa, 'v', d), vb = interp(pb, 'v', d);
      const c = Math.abs(va - vb) < 2 ? 'var(--ink-3)' : va > vb ? colA : colB;
      svg.appendChild(s('line', { x1: pts[i - 1].x, y1: pts[i - 1].y, x2: pts[i].x, y2: pts[i].y, stroke: c, 'stroke-width': 9 * sc, 'stroke-linecap': 'round' }));
    }
    const dot = s('circle', { r: 11 * sc, fill: 'var(--ink)', stroke: 'var(--bg)', 'stroke-width': 3 * sc, visibility: 'hidden' });
    svg.appendChild(dot);
    marker.set = (x) => {
      if (x == null) { dot.setAttribute('visibility', 'hidden'); return; }
      let best = pts[0];
      for (const p of pts) if (Math.abs(p.d - x) < Math.abs(best.d - x)) best = p;
      dot.setAttribute('cx', best.x); dot.setAttribute('cy', best.y); dot.setAttribute('visibility', 'visible');
    };
    mapEl.append(svg, h('div', { class: 'legend' }, h('span', { class: 'row', style: { gap: '6px' } }, h('span', { class: 'sw', style: { background: colA } }), L(`${A.name_acronym} daha hızlı`, `${A.name_acronym} faster`)), h('span', { class: 'row', style: { gap: '6px' } }, h('span', { class: 'sw', style: { background: colB } }), L(`${B.name_acronym} daha hızlı`, `${B.name_acronym} faster`)), h('span', { class: 'row', style: { gap: '6px' } }, h('span', { class: 'sw', style: { background: 'var(--ink-3)' } }), L('fark yok', 'level'))));
  } else mapEl.append(h('p', { class: 'muted' }, L('Bu tur için konum verisi yok.', 'No position data for this lap.')));

  const KIND2 = { 'Practice 1': 'fp1', 'Practice 2': 'fp2', 'Practice 3': 'fp3', 'Sprint Qualifying': 'sq', 'Sprint Shootout': 'sq', Sprint: 'spr', Qualifying: 'q', Race: 'r' };
  const title = `${gpName(ctx.ref, race.gp)} ${sess.year || ''}: ${sessionLabel(KIND2[sess.session_name] || 'q')}`;
  return h('div', { class: 'stack' },
    h('div', { class: 'grid g-7-5' }, card(L('Pistte kim nerede hızlı', 'Who is faster where'), mapEl), card(title, summary)),
    card(L('Metre metre', 'Metre by metre'), h('div', {}, chart, h('p', { class: 'foot-note' }, L('Her pilotun seanstaki en hızlı turu. Mesafe hızdan hesaplanır ve iki tur aynı uzunluğa ölçeklenir; fren verisi açık/kapalıdır.', 'Each driver’s fastest lap of the session. Distance is integrated from speed and both laps are scaled to the same length; brake data is on/off.')))));
}
