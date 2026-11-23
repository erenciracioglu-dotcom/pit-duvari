// Yarisin hikayesi: tur tur siralama, lidere fark, tur sureleri, lastik stratejisi, olaylar, pitler
import { h, clear, msToLap } from '../core/util.js';
import { L, driverName, tyreName, nf } from '../core/i18n.js';
import * as data from '../core/data.js';
import { teamColor } from '../core/colors.js';
import { card, empty, dchip, seg } from '../core/ui.js';
import { lineChart, chartCard, showTip, hideTip } from '../core/charts.js';
import { TYRE } from '../core/names.js';

// Tur sonu zamanlarindan siralama ve lidere farki hesaplar
export function computeLaps(story) {
  const nos = Object.keys(story.lap);
  const N = story.laps;
  const pos = {}, gap = {};
  for (const no of nos) { pos[no] = Array(N + 1).fill(null); gap[no] = Array(N + 1).fill(null); }
  for (let lap = 1; lap <= N; lap++) {
    const ends = nos.map((no) => ({ no, e: story.lap[no][lap - 1]?.[5] })).filter((x) => x.e != null).sort((a, b) => a.e - b.e);
    ends.forEach((x, i) => { pos[x.no][lap] = i + 1; gap[x.no][lap] = Math.round((x.e - ends[0].e) * 1000) / 1000; });
  }
  return { nos, N, pos, gap };
}

export function driverMeta(story, ref, race) {
  // numara -> { d, t, code, color, dash }
  const out = {};
  const seenTeam = new Map();
  const order = (race?.res || []).map((x) => String(x.no));
  const nos = Object.keys(story.drv).sort((a, b) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99));
  for (const no of nos) {
    const v = story.drv[no];
    const t = v.t || (race?.res || []).find((x) => String(x.no) === no)?.t;
    const n = seenTeam.get(t) || 0;
    seenTeam.set(t, n + 1);
    out[no] = { d: v.d, t, code: v.c || (v.d ? driverName(ref, v.d, 'code') : no), color: t ? teamColor(t) : v.col || '#888', dash: n > 0 };
  }
  return out;
}

export async function storyView(ctx, season, race) {
  const { ref, profile } = ctx;
  let story;
  try { story = await data.story(season.year, race.r); } catch {
    return empty(L('Hikâye henüz hazır değil', 'Story not ready yet'), L('Yarış verisi işlendiğinde burada tur tur analiz görünecek.', 'The lap-by-lap analysis appears here once the race data is processed.'));
  }
  const dm = driverMeta(story, ref, race);
  const { nos, N, pos, gap } = computeLaps(story);
  // start (0. tur): grid sirasi
  for (const x of race.res || []) { const no = String(x.no); if (pos[no] && x.g) pos[no][0] = x.g; }
  const finishOrder = (race.res || []).map((x) => String(x.no)).filter((no) => dm[no]);
  const ordered = [...finishOrder, ...nos.filter((n) => !finishOrder.includes(n))];
  const favNos = ordered.filter((no) => profile.favDrivers.includes(dm[no]?.d));
  const highlight = [...new Set([...ordered.slice(0, 3), ...favNos])];
  const labels = Array.from({ length: N + 1 }, (_, i) => i);
  const scLaps = new Set();
  for (const [, a, b] of story.sc || []) for (let l = a || 1; l <= (b || N); l++) scLaps.add(l);

  const wrap = h('div', { class: 'stack' });
  // ozet karolari
  const stops = story.pits?.length || 0;
  const fl = story.fl;
  const totalOt = Object.values(story.ot || {}).reduce((a, b) => a + b, 0);
  wrap.appendChild(h('div', { class: 'stats' },
    tile(N, L('tur', 'laps')),
    tile(stops, L('pit stop', 'pit stops')),
    tile((story.sc || []).filter((x) => x[0] === 'SC').length, L('güvenlik aracı', 'safety cars')),
    tile((story.sc || []).filter((x) => x[0] === 'VSC').length, L('sanal güvenlik aracı', 'virtual SC')),
    totalOt ? tile(totalOt, L('sollama', 'overtakes')) : null,
    fl ? tile(msToLap(fl.dur * 1000), L(`en hızlı tur: ${dm[fl.no]?.code || fl.no}, ${fl.lap}. tur`, `fastest lap: ${dm[fl.no]?.code || fl.no}, lap ${fl.lap}`)) : null,
    story.wx ? tile(`${Math.round(story.wx.track[1])}°`, L(`pist sıcaklığı (hava ${Math.round(story.wx.air[1])}°)${story.wx.rain ? ', yağmur' : ''}`, `track temp (air ${Math.round(story.wx.air[1])}°)${story.wx.rain ? ', rain' : ''}`)) : null));

  // siralama grafigi
  const posSeries = ordered.map((no) => ({ id: no, label: dm[no].code, short: dm[no].code, color: dm[no].color, dash: dm[no].dash, values: pos[no] }));
  const posChart = lineChart({
    series: posSeries, labels, height: 420, invert: true, yFmt: (v) => v, xFmt: (l, i, axis) => (axis ? l : L(`${l}. tur`, `Lap ${l}`)),
    tipTitle: (i) => (i === 0 ? L('Start', 'Start') : L(`${i}. tur${scLaps.has(i) ? ' (güvenlik aracı)' : ''}`, `Lap ${i}${scLaps.has(i) ? ' (safety car)' : ''}`)), tipValue: (sr, v) => `P${v}`, highlight, ariaLabel: L('Tur tur sıralama grafiği', 'Lap-by-lap position chart')
  });
  wrap.appendChild(chartCard(L('Tur tur sıralama', 'Position by lap'), posChart, () => posTable(ordered, dm, pos, N),
    { note: L('Çizgilerin üstünde gezin; aynı takımın ikinci pilotu kesik çizgiyle. Lejanttaki adlara dokunarak çizgileri aç/kapat.', 'Hover the lines; a team’s second driver is dashed. Tap names in the legend to toggle lines.') }));

  // lidere fark
  const top = ordered.slice(0, 10);
  const gapChart = lineChart({
    series: top.map((no) => ({ id: no, label: dm[no].code, color: dm[no].color, dash: dm[no].dash, values: gap[no].map((v) => (v == null ? null : Math.min(v, 120))) })),
    labels, height: 300, yFmt: (v) => `${v}s`, xFmt: (l, i, axis) => (axis ? l : L(`${l}. tur`, `Lap ${l}`)), sortTip: 'asc', tipValue: (sr, v) => (v === 0 ? L('lider', 'leader') : `+${nf(v, 1)} s`)
  });
  wrap.appendChild(chartCard(L('Lidere fark (ilk 10)', 'Gap to leader (top 10)'), gapChart, () => gapTable(top, dm, gap, N), { note: L('120 saniyenin üstündeki farklar grafikte kesilir; tabloda tam değerler var.', 'Gaps above 120 s are clipped on the chart; the table has full values.') }));

  // tur sureleri (secilebilir)
  wrap.appendChild(lapTimesCard(story, dm, ordered, highlight, scLaps));

  // lastik stratejisi
  wrap.appendChild(stintCard(story, dm, ordered));

  // olaylar
  if (story.ev?.length) wrap.appendChild(eventsCard(story, dm, ref));

  // pit stoplar
  if (story.pits?.length) wrap.appendChild(pitsCard(story, dm, ref));

  wrap.appendChild(h('p', { class: 'dim t-small' }, L('Kaynak: OpenF1 zamanlama verisi. Sıralamalar tur sonu geçiş zamanlarından hesaplanır; resmi sonuç tablosu cezaları da içerir.', 'Source: OpenF1 timing. Positions are computed from lap-end crossing times; the official result includes penalties.')));
  return wrap;
}

const tile = (v, k) => h('div', { class: 'stat' }, h('div', { class: 'v' }, String(v)), h('div', { class: 'k' }, k));

function posTable(ordered, dm, pos, N) {
  const step = N > 40 ? 5 : N > 20 ? 2 : 1;
  const laps = []; for (let l = 1; l <= N; l += step) laps.push(l); if (laps[laps.length - 1] !== N) laps.push(N);
  return h('table', { class: 'tbl compact' }, h('thead', {}, h('tr', {}, h('th', { class: 'sticky' }, L('Pilot', 'Driver')), laps.map((l) => h('th', { class: 'n' }, l)))),
    h('tbody', {}, ordered.map((no) => h('tr', {}, h('td', { class: 'sticky strong' }, h('span', { class: 'row', style: { gap: '6px' } }, h('span', { class: 'tdot', style: { background: dm[no].color } }), dm[no].code)), laps.map((l) => h('td', { class: 'n' }, pos[no][l] ?? '–'))))));
}

function gapTable(top, dm, gap, N) {
  const step = N > 40 ? 5 : 2;
  const laps = []; for (let l = 1; l <= N; l += step) laps.push(l); if (laps[laps.length - 1] !== N) laps.push(N);
  return h('table', { class: 'tbl compact' }, h('thead', {}, h('tr', {}, h('th', { class: 'sticky' }, L('Pilot', 'Driver')), laps.map((l) => h('th', { class: 'n' }, l)))),
    h('tbody', {}, top.map((no) => h('tr', {}, h('td', { class: 'sticky strong' }, dm[no].code), laps.map((l) => h('td', { class: 'n' }, gap[no][l] == null ? '–' : gap[no][l] === 0 ? '0' : nf(gap[no][l], 1)))))));
}

function lapTimesCard(story, dm, ordered, highlight, scLaps) {
  const sel = new Set(highlight.slice(0, 4));
  const box = h('div', {});
  const picker = h('div', { class: 'row wrap', style: { gap: '6px', marginBottom: '12px' } });
  const N = story.laps;
  const labels = Array.from({ length: N }, (_, i) => i + 1);
  const draw = () => {
    clear(picker);
    for (const no of ordered) picker.appendChild(h('button', { type: 'button', class: ['btn sm', sel.has(no) ? '' : 'ghost'], style: sel.has(no) ? { borderColor: dm[no].color } : {}, onClick: () => { sel.has(no) ? sel.delete(no) : sel.add(no); draw(); } }, h('span', { class: 'tdot', style: { background: dm[no].color } }), dm[no].code));
    const all = [];
    const series = [...sel].map((no) => {
      const vals = story.lap[no].map((r, i) => (r[0] && !r[4] && !story.lap[no][i + 1]?.[4] && !scLaps.has(i + 1) ? r[0] : null));
      all.push(...vals.filter(Boolean));
      return { id: no, label: dm[no].code, color: dm[no].color, dash: dm[no].dash, values: vals };
    });
    all.sort((a, b) => a - b);
    const lo = all[0], hi = all[Math.floor(all.length * 0.96)] || all[all.length - 1];
    clear(box).appendChild(series.length ? lineChart({ series, labels, height: 300, yMin: lo ? Math.floor(lo - 0.3) : undefined, yMax: hi ? Math.ceil(hi + 0.5) : undefined, yFmt: (v) => msToLap(v * 1000).replace(/\.\d+$/, ''), sortTip: 'asc', tipValue: (sr, v) => msToLap(v * 1000), xFmt: (l, i, axis) => (axis ? l : L(`${l}. tur`, `Lap ${l}`)), endLabels: true })
      : h('p', { class: 'muted' }, L('Karşılaştırmak için pilot seç.', 'Pick drivers to compare.')));
  };
  draw();
  return card(L('Tur süreleri', 'Lap times'), h('div', {}, picker, box, h('p', { class: 'foot-note' }, L('Pit giriş-çıkış turları ve güvenlik aracı turları çıkarıldı.', 'In/out laps and safety-car laps are removed.'))));
}

function stintCard(story, dm, ordered) {
  const N = story.laps;
  const byNo = new Map();
  for (const st of story.st || []) { if (!byNo.has(st[0])) byNo.set(st[0], []); byNo.get(st[0]).push(st); }
  const pitByNo = new Map();
  for (const p of story.pits || []) { if (!pitByNo.has(p[0])) pitByNo.set(p[0], []); pitByNo.get(p[0]).push(p[1]); }
  const scBands = (story.sc || []).map(([k, a, b]) => h('div', { style: { position: 'absolute', top: 0, bottom: 0, left: `${((a - 1) / N) * 100}%`, width: `${(((b || N) - a + 1) / N) * 100}%`, background: k === 'RED' ? 'rgba(255,93,93,0.12)' : 'rgba(242,193,78,0.10)' } }));
  const rows = ordered.filter((no) => byNo.has(no)).map((no) => h('div', { class: 'sr' },
    h('span', { class: 'code' }, h('span', { class: 'tdot', style: { background: dm[no].color } }), dm[no].code),
    h('div', { class: 'track-bar' }, scBands.map((b) => b.cloneNode(true)),
      byNo.get(no).map(([, n, a, b, comp, age]) => {
        const T = TYRE[comp] || TYRE.UNKNOWN;
        const el = h('div', { class: 'seg-t', style: { left: `${((a - 1) / N) * 100}%`, width: `${((b - a + 1) / N) * 100}%`, background: T.c }, tabindex: 0 });
        const tipFn = (ev) => showTip(ev.clientX, ev.clientY, h('div', {}, h('div', { class: 'tt' }, `${dm[no].code}: ${tyreName(comp)}`), h('div', {}, L(`${a}–${b}. turlar (${b - a + 1} tur)`, `Laps ${a}–${b} (${b - a + 1} laps)`)), age ? h('div', { class: 'dim' }, L(`${age} turluk lastikle başladı`, `Started on ${age}-lap-old tyres`)) : null));
        el.addEventListener('pointermove', tipFn); el.addEventListener('pointerleave', hideTip);
        el.addEventListener('focus', (e) => { const r = el.getBoundingClientRect(); tipFn({ clientX: r.left, clientY: r.bottom }); }); el.addEventListener('blur', hideTip);
        return el;
      }))));
  const legend = h('div', { class: 'legend' }, Object.entries(TYRE).filter(([k]) => (story.st || []).some((x) => x[4] === k)).map(([k, T]) => h('span', { class: 'row', style: { gap: '6px' } }, h('span', { class: 'tyre', style: { borderColor: T.c } }, T.k), tyreName(k))),
    (story.sc || []).length ? h('span', { class: 'row', style: { gap: '6px' } }, h('span', { style: { width: '14px', height: '10px', background: 'rgba(242,193,78,0.25)', borderRadius: '2px' } }), L('güvenlik aracı', 'safety car')) : null);
  return card(L('Lastik stratejisi', 'Tyre strategy'), h('div', {},
    h('div', { class: 'stints' }, rows, h('div', { class: 'scale' }, h('span'), h('div', { class: 'row' }, h('span', {}, '1'), h('span', { class: 'sp' }), h('span', {}, String(Math.round(N / 2))), h('span', { class: 'sp' }), h('span', {}, String(N))))),
    legend));
}

const EV = () => ({ sc: ['SC', 'bad'], vsc: ['VSC', ''], red: [L('Kırmızı', 'Red'), 'bad'], green: [L('Yeşil', 'Green'), 'pb'], chequered: [L('Bayrak', 'Flag'), ''], pen: [L('Ceza', 'Penalty'), 'bad'], inv: [L('İnceleme', 'Inquiry'), ''], info: [L('Bilgi', 'Info'), ''] });
function eventsCard(story, dm) {
  const items = story.ev.filter((e) => e[1] !== 'chequered').slice(0, 60);
  return card(L('Yarış kontrol olayları', 'Race control'), h('div', { class: 'list' }, items.map(([lap, kind, msg, , no]) => h('div', { class: 'li', style: { alignItems: 'flex-start' } },
    h('span', { class: 'num dim', style: { width: '44px', flex: 'none' } }, lap ? L(`${lap}. tur`, `L${lap}`) : ''),
    h('span', { class: ['badge', EV()[kind]?.[1]], style: { flex: 'none' } }, EV()[kind]?.[0] || kind),
    h('span', { class: 't-small', style: { minWidth: 0 } }, prettyMsg(msg), no && dm[no] ? h('span', { class: 'dim' }, ` (${dm[no].code})`) : null)))),
  { actions: h('span', { class: 'dim t-small' }, L('Mesajlar FIA dilinde (İngilizce)', 'Messages as issued by the FIA')) });
}
const prettyMsg = (m) => m.replace(/^FIA STEWARDS: /, '').toLowerCase().replace(/(^|\. )([a-z])/g, (a, b, c) => b + c.toUpperCase()).replace(/\b(car|cars) (\d+)/g, (a) => a).replace(/\(([a-z]{3})\)/g, (a, b) => `(${b.toUpperCase()})`);

function pitsCard(story, dm, ref) {
  const rows = story.pits.filter((p) => p[2] || p[3]).sort((a, b) => (a[3] ?? a[2] ?? 99) - (b[3] ?? b[2] ?? 99));
  const hasStop = rows.some((p) => p[3]);
  return card(L('Pit stoplar', 'Pit stops'), h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl compact' },
    h('thead', {}, h('tr', {}, h('th', {}, L('Pilot', 'Driver')), h('th', { class: 'n' }, L('Tur', 'Lap')), hasStop ? h('th', { class: 'n' }, L('Duruş', 'Stop')) : null, h('th', { class: 'n' }, L('Pit yolu', 'Pit lane')))),
    h('tbody', {}, rows.slice(0, 40).map(([no, lap, lane, stop], i) => h('tr', {},
      h('td', {}, dm[no]?.d ? dchip(ref, dm[no].d, { t: dm[no].t, short: true }) : no),
      h('td', { class: 'n' }, lap), hasStop ? h('td', { class: ['n', i === 0 && 'best strong'] }, stop ? `${nf(stop, 1)} s` : '–') : null, h('td', { class: 'n' }, lane ? `${nf(lane, 1)} s` : '–')))))),
  { actions: h('span', { class: 'dim t-small' }, hasStop ? L('Mor: en hızlı duruş', 'Purple: quickest stop') : '') });
}
