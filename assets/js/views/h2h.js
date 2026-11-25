// Kafa kafaya: iki pilotun kariyer karsilastirmasi ve sezonun takim ici duellolari
import { h, s, clear, add, fmtPts } from '../core/util.js';
import { L, driverName, nf } from '../core/i18n.js';
import * as data from '../core/data.js';
import { teamColor, withAlpha } from '../core/colors.js';
import { vhead, card, tchip, footer, loading, seg, spoilerActive } from '../core/ui.js';
import { raceEndMs } from './common.js';
import { loadAll, h2h, teammateDuels } from '../core/hist.js';

function driverInput(ref, value, onPick, label) {
  const listId = 'dl-drivers';
  if (!document.getElementById(listId)) {
    const dl = h('datalist', { id: listId }, Object.entries(ref.drivers).filter(([, d]) => (d.s?.[0] || 0) > 0).sort((a, b) => (b[1].s?.[0] || 0) - (a[1].s?.[0] || 0)).map(([, d]) => h('option', { value: d.n })));
    document.body.appendChild(dl);
  }
  const byName = new Map(Object.entries(ref.drivers).map(([id, d]) => [d.n.toLocaleLowerCase(), id]));
  return h('input', { type: 'search', list: listId, value: ref.drivers[value]?.n || '', 'aria-label': label, placeholder: label, style: { minWidth: '220px' },
    onChange: (e) => { const id = byName.get(e.target.value.trim().toLocaleLowerCase()); if (id) onPick(id); } });
}

export async function render(root, ctx) {
  const { ref, meta, cur, profile } = ctx;
  let [a, b] = ctx.params;
  if (!a || !b) {
    const st = data.latestStandings(cur);
    const favs = profile.favDrivers;
    if (!a) a = favs[0] || st.d[0]?.[0];
    if (!b) {
      const t = data.teamOf(cur, a);
      b = favs.find((d) => d !== a) || (data.lineup(ref, cur).get(t) || []).find((d) => d !== a) || st.d[1]?.[0];
    }
  }
  const go = (x, y) => { location.hash = `#kafa-kafaya/${x}/${y}`; };
  add(root, vhead({ title: L('Kafa kafaya', 'Head to head'), sub: L('İki pilotu kariyerleri, aynı yarışlardaki sonuçları ve takım arkadaşı oldukları dönem üzerinden karşılaştır.', 'Compare two drivers across their careers, the races they shared and their time as teammates.') }),
    h('div', { class: 'filters' }, driverInput(ref, a, (id) => go(id, b), L('1. pilot', 'Driver 1')),
      h('button', { class: 'btn ghost sm', type: 'button', 'aria-label': L('Yer değiştir', 'Swap'), onClick: () => go(b, a) }, '⇄'),
      driverInput(ref, b, (id) => go(a, id), L('2. pilot', 'Driver 2'))));
  const body = h('div', {}, loading());
  root.appendChild(body);
  const all = await loadAll();
  clear(body);
  const A = ref.drivers[a], B = ref.drivers[b];
  if (!A || !B) { body.appendChild(h('p', { class: 'muted' }, L('İki pilot seç.', 'Pick two drivers.'))); return; }
  const tA = lastTeam(all, a), tB = lastTeam(all, b);
  const colA = teamColor(tA), colB = tA === tB ? '#edf1f5' : teamColor(tB);
  const r = h2h(all, a, b);
  const row = (label, va, vb, { fmt = (v) => v, higher = true } = {}) => {
    const na = Number(va) || 0, nb = Number(vb) || 0;
    const tot = na + nb || 1;
    const win = na === nb ? null : (na > nb) === higher ? 'a' : 'b';
    return [h('div', { class: ['a', win === 'a' && 'pb'] }, fmt(va)), h('div', { class: 'lbl' }, label), h('div', { class: ['b', win === 'b' && 'pb'] }, fmt(vb)),
      h('div', { class: 'bars' }, h('div', { style: { width: `${(100 * na) / tot}%`, background: colA } }), h('div', { style: { width: `${(100 * nb) / tot}%`, background: colB } }))];
  };
  const sA = A.s || [], sB = B.s || [];
  const header = h('div', { class: 'h2h', style: { marginBottom: '14px' } },
    h('a', { class: 'a', href: `#surucu/${a}`, style: { color: colA, textDecoration: 'none' } }, A.n), h('div', { class: 'lbl' }, 'vs'), h('a', { class: 'b', href: `#surucu/${b}`, style: { color: colB, textDecoration: 'none' } }, B.n));
  const career = card(L('Kariyer', 'Career'), h('div', {}, header, h('div', { class: 'h2h' },
    row(L('Dünya şampiyonluğu', 'Titles'), sA[5] || 0, sB[5] || 0),
    row(L('Yarış', 'Starts'), sA[0] || 0, sB[0] || 0),
    row(L('Galibiyet', 'Wins'), sA[1] || 0, sB[1] || 0),
    row(L('Podyum', 'Podiums'), sA[2] || 0, sB[2] || 0),
    row('Pole', sA[3] || 0, sB[3] || 0),
    row(L('En hızlı tur', 'Fastest laps'), sA[4] || 0, sB[4] || 0),
    row(L('Galibiyet oranı', 'Win rate'), sA[0] ? (100 * (sA[1] || 0)) / sA[0] : 0, sB[0] ? (100 * (sB[1] || 0)) / sB[0] : 0, { fmt: (v) => `%${nf(v, 1)}` }),
    row(L('Puan', 'Points'), sA[6] || 0, sB[6] || 0, { fmt: (v) => fmtPts(v) }))));
  const m = r.mates;
  const shared = card(L('Aynı yarışlarda', 'In the same races'), r.common ? h('div', {},
    h('p', { class: 'muted', style: { marginTop: 0 } }, L(`İkisinin de start aldığı ${r.common} yarış.`, `${r.common} races where both started.`)),
    h('div', { class: 'h2h' }, row(L('Önde bitirdi', 'Finished ahead'), r.aheadA, r.aheadB), r.qCommon ? row(L('Sıralamada önde', 'Out-qualified'), r.qA, r.qB) : null, row(L('Bu yarışlardaki puan', 'Points in these races'), r.ptsA, r.ptsB, { fmt: fmtPts })))
    : h('p', { class: 'muted', style: { margin: 0 } }, L('Bu iki pilot hiç aynı yarışta start almadı.', 'These two never started the same race.')));
  const mates = m.races ? card(L('Takım arkadaşıyken', 'As teammates'), h('div', {},
    h('p', { class: 'muted', style: { marginTop: 0 } }, L(`${[...m.seasons].sort().join(', ')} sezonlarında ${m.races} yarış.`, `${m.races} races in ${[...m.seasons].sort().join(', ')}.`)),
    h('div', { class: 'h2h' }, row(L('Önde bitirdi', 'Finished ahead'), m.aheadA, m.aheadB), m.qA + m.qB ? row(L('Sıralamada önde', 'Out-qualified'), m.qA, m.qB) : null, row(L('Puan', 'Points'), m.ptsA, m.ptsB, { fmt: fmtPts })))) : null;
  body.appendChild(radarCard(ctx, a, b, A, B, colA, colB));
  body.appendChild(h('div', { class: 'grid g2' }, career, h('div', { class: 'stack' }, shared, mates)));

  // sezonun takim ici duellolari
  const years = [meta.currentSeason, meta.currentSeason - 1, meta.currentSeason - 2];
  const duelBox = h('div', {});
  const renderDuels = async (y) => {
    clear(duelBox).appendChild(loading());
    const season = y === meta.currentSeason ? cur : await data.season(y);
    const duels = teammateDuels(season);
    clear(duelBox).appendChild(h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl' },
      h('thead', {}, h('tr', {}, h('th', {}, L('Takım', 'Team')), h('th', {}, L('Pilotlar', 'Drivers')), h('th', { class: 'n' }, L('Sıralama', 'Quali')), h('th', { class: 'n' }, L('Yarış', 'Race')), h('th', { class: 'n' }, L('Puan', 'Points')), h('th', {}, ''))),
      h('tbody', {}, duels.map((p) => h('tr', {},
        h('td', {}, tchip(ref, p.t)),
        h('td', {}, h('span', { class: 't-small' }, driverName(ref, p.a, 'last'), h('span', { class: 'dim' }, ' – '), driverName(ref, p.b, 'last'))),
        h('td', { class: 'n' }, score(p.qA, p.qB)), h('td', { class: 'n' }, score(p.rA, p.rB)), h('td', { class: 'n' }, `${fmtPts(p.pA)}–${fmtPts(p.pB)}`),
        h('td', {}, h('a', { class: 'btn sm ghost', href: `#kafa-kafaya/${p.a}/${p.b}` }, L('Aç', 'Open')))))))));
  };
  const score = (x, y) => h('span', {}, h('strong', { class: x > y ? 'pb' : null }, x), '–', h('strong', { class: y > x ? 'pb' : null }, y));
  body.appendChild(h('div', { class: 'mt' }, card(L('Takım içi düellolar', 'Teammate battles'), duelBox, { actions: seg(years.map((y) => ({ value: y, label: String(y) })), meta.currentSeason, renderDuels) })));
  await renderDuels(meta.currentSeason);
  root.appendChild(footer(meta));
}

function lastTeam(all, id) {
  const di = all.dIdx.get(id);
  const rows = all.byDriver.get(di) || [];
  return rows.length ? all.te[rows[rows.length - 1][2]] : null;
}

// ---- radar: iki pilotun alti eksende karsilastirmasi ----
// Bu sezon: her eksen gridin en iyisine gore 0-100 (en iyi = 100). Kariyer: start basina oranlar, ikisinden iyisine gore.
function seasonStats(season, upto) {
  const st = new Map();
  const get = (d) => st.get(d) || (st.set(d, { pts: 0, starts: 0, wins: 0, pods: 0, inPts: 0, fin: [], q: [] }), st.get(d));
  for (const r of season.races) {
    if (r.r > upto) break;
    for (const x of r.res || []) {
      const o = get(x.d);
      o.starts++; o.pts += x.pts || 0;
      if (x.pn === 1) o.wins++;
      if (x.pn && x.pn <= 3) o.pods++;
      if (x.pts > 0) o.inPts++;
      o.fin.push(x.pn || 22);
    }
    for (const x of r.spr || []) get(x.d).pts += x.pts || 0;
    for (const x of r.q || []) if (x.pn) get(x.d).q.push(x.pn);
  }
  const avg = (a) => (a.length ? a.reduce((p, c) => p + c, 0) / a.length : null);
  for (const o of st.values()) { o.avgQ = avg(o.q); o.avgF = avg(o.fin); o.ptsRate = o.starts ? o.inPts / o.starts : 0; }
  return st;
}

function radarAxes(mode, ctx, a, b) {
  if (mode === 'season') {
    const { cur } = ctx;
    // spoiler kalkani aciksa son yarisi sayma
    const done = cur.races.filter((r) => r.res?.length);
    const last = done[done.length - 1];
    const upto = last && spoilerActive(data.raceKey(cur.year, last.r), raceEndMs(last)) ? last.r - 1 : Infinity;
    const st = seasonStats(cur, upto);
    const A = st.get(a), B = st.get(b);
    if (!A?.starts || !B?.starts) return null;
    const all = [...st.values()].filter((o) => o.starts >= 3);
    const maxOf = (k) => Math.max(...all.map((o) => o[k] || 0), 1e-9);
    const hi = (k) => (o) => (o[k] || 0) / maxOf(k);
    // pozisyon ortalamalari: kucuk daha iyi; en iyi ortalama 100, 22. sira 0
    const lo = (k) => { const best = Math.min(...all.map((o) => o[k] ?? 99)); return (o) => (o[k] == null ? 0 : Math.max(0, (22 - o[k]) / (22 - best))); };
    const f1 = (v) => nf(v, 1);
    const axes = [
      { k: L('Puan', 'Points'), f: hi('pts'), raw: (o) => fmtPts(o.pts) },
      { k: L('Galibiyet', 'Wins'), f: hi('wins'), raw: (o) => o.wins },
      { k: L('Podyum', 'Podiums'), f: hi('pods'), raw: (o) => o.pods },
      { k: L('Sıralama hızı', 'Qualifying pace'), f: lo('avgQ'), raw: (o) => (o.avgQ == null ? '–' : L(`ort. ${f1(o.avgQ)}. sıra`, `avg P${f1(o.avgQ)}`)) },
      { k: L('Yarış sonucu', 'Race finish'), f: lo('avgF'), raw: (o) => L(`ort. ${f1(o.avgF)}. sıra`, `avg P${f1(o.avgF)}`) },
      { k: L('İstikrar', 'Consistency'), f: hi('ptsRate'), raw: (o) => L(`%${Math.round(o.ptsRate * 100)} puanlı`, `${Math.round(o.ptsRate * 100)}% in points`) }
    ];
    return { axes, A, B, note: L(`${cur.year} sezonu${upto !== Infinity ? ' (spoiler kalkanı: son yarış hariç)' : ''}. Her eksende gridin en iyisi 100 sayılır.`, `${cur.year} season${upto !== Infinity ? ' (spoiler shield: last race excluded)' : ''}. On each axis the best on the grid scores 100.`) };
  }
  const sa = ctx.ref.drivers[a]?.s || [], sb = ctx.ref.drivers[b]?.s || [];
  const mk = (sx) => ({ starts: sx[0] || 0, win: sx[0] ? (sx[1] || 0) / sx[0] : 0, pod: sx[0] ? (sx[2] || 0) / sx[0] : 0, pole: sx[0] ? (sx[3] || 0) / sx[0] : 0, fl: sx[0] ? (sx[4] || 0) / sx[0] : 0, ppr: sx[0] ? (sx[6] || 0) / sx[0] : 0 });
  const A = mk(sa), B = mk(sb);
  if (!A.starts || !B.starts) return null;
  const pair = (k) => (o) => (o[k] || 0) / Math.max(A[k] || 0, B[k] || 0, 1e-9);
  const pct = (k) => (o) => `%${nf(o[k] * 100, 1)}`;
  const axes = [
    { k: L('Deneyim', 'Experience'), f: pair('starts'), raw: (o) => L(`${o.starts} yarış`, `${o.starts} starts`) },
    { k: L('Galibiyet oranı', 'Win rate'), f: pair('win'), raw: pct('win') },
    { k: L('Podyum oranı', 'Podium rate'), f: pair('pod'), raw: pct('pod') },
    { k: L('Pole oranı', 'Pole rate'), f: pair('pole'), raw: pct('pole') },
    { k: L('En hızlı tur oranı', 'Fastest-lap rate'), f: pair('fl'), raw: pct('fl') },
    { k: L('Yarış başına puan', 'Points per start'), f: pair('ppr'), raw: (o) => nf(o.ppr, 2) }
  ];
  return { axes, A, B, note: L('Kariyer: start başına oranlar; her eksende ikisinden iyi olanı 100 sayılır. Farklı dönemlerin puan sistemleri farklıdır.', 'Career: per-start rates; on each axis the better of the two scores 100. Points systems differ between eras.') };
}

function radarSvg(res, A, B, nameA, nameB, colA, colB) {
  const n = res.axes.length, R = 112, cx = 170, cy = 150;
  const pt = (i, v) => { const ang = -Math.PI / 2 + (2 * Math.PI * i) / n; return [cx + Math.cos(ang) * R * v, cy + Math.sin(ang) * R * v]; };
  const poly = (o) => res.axes.map((ax, i) => pt(i, Math.min(1, Math.max(0, ax.f(o)))).map((v) => v.toFixed(1)).join(',')).join(' ');
  const g = s('svg', { class: 'radar', viewBox: '0 0 340 300', role: 'img', 'aria-label': L(`${nameA} ile ${nameB} radar karşılaştırması`, `Radar comparison of ${nameA} and ${nameB}`) });
  for (const lv of [0.25, 0.5, 0.75, 1]) g.appendChild(s('polygon', { class: 'ring', points: res.axes.map((_, i) => pt(i, lv).join(',')).join(' ') }));
  res.axes.forEach((ax, i) => {
    const [x, y] = pt(i, 1);
    g.appendChild(s('line', { class: 'spoke', x1: cx, y1: cy, x2: x, y2: y }));
    const [lx, ly] = pt(i, 1.17);
    const anchor = Math.abs(lx - cx) < 8 ? 'middle' : lx > cx ? 'start' : 'end';
    g.appendChild(s('text', { class: 'axl', x: lx, y: ly + 4, 'text-anchor': anchor }, ax.k));
  });
  const shape = (o, col, cls) => {
    const grp = s('g', { class: cls });
    grp.appendChild(s('polygon', { points: poly(o), fill: withAlpha(col, 0.18), stroke: col, 'stroke-width': 2.2, 'stroke-linejoin': 'round' }));
    res.axes.forEach((ax, i) => { const [x, y] = pt(i, Math.min(1, Math.max(0, ax.f(o)))); grp.appendChild(s('circle', { cx: x, cy: y, r: 3.4, fill: col })); });
    return grp;
  };
  g.append(shape(B, colB, 'rb'), shape(A, colA, 'ra'));
  return g;
}

function radarCard(ctx, a, b, DA, DB, colA, colB) {
  const box = h('div', { class: 'radar-wrap' });
  const inSeason = (id) => ctx.cur.races.some((r) => r.res?.some((x) => x.d === id));
  const canSeason = inSeason(a) && inSeason(b);
  const paint = (mode) => {
    clear(box);
    const res = radarAxes(mode, ctx, a, b);
    if (!res) { box.appendChild(h('p', { class: 'muted', style: { margin: 0 } }, L('Bu karşılaştırma için yeterli veri yok.', 'Not enough data for this comparison.'))); return; }
    const legend = h('div', { class: 'radar-leg' },
      h('span', {}, h('i', { style: { background: colA } }), DA.n), h('span', {}, h('i', { style: { background: colB } }), DB.n));
    const tbl = h('table', { class: 'tbl radar-tbl' },
      h('thead', {}, h('tr', {}, h('th', {}, ''), h('th', { class: 'n', style: { color: colA } }, driverName(ctx.ref, a, 'code')), h('th', { class: 'n', style: { color: colB } }, driverName(ctx.ref, b, 'code')))),
      h('tbody', {}, res.axes.map((ax) => {
        const va = ax.f(res.A), vb = ax.f(res.B);
        return h('tr', {}, h('td', {}, ax.k), h('td', { class: ['n', va > vb + 1e-9 && 'pb'] }, ax.raw(res.A)), h('td', { class: ['n', vb > va + 1e-9 && 'pb'] }, ax.raw(res.B)));
      })));
    box.append(h('div', { class: 'radar-main' }, radarSvg(res, res.A, res.B, DA.n, DB.n, colA, colB), legend), h('div', {}, tbl, h('p', { class: 'foot-note' }, res.note)));
  };
  const first = canSeason ? 'season' : 'career';
  paint(first);
  const opts = canSeason ? [{ value: 'season', label: L('Bu sezon', 'This season') }, { value: 'career', label: L('Kariyer', 'Career') }] : [{ value: 'career', label: L('Kariyer', 'Career') }];
  return h('div', { style: { marginBottom: '16px' } }, card(L('Radar', 'Radar'), box, { actions: opts.length > 1 ? seg(opts, first, paint) : null }));
}
