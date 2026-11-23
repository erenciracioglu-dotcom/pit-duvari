// Kafa kafaya: iki pilotun kariyer karsilastirmasi ve sezonun takim ici duellolari
import { h, clear, add, fmtPts } from '../core/util.js';
import { L, driverName, nf } from '../core/i18n.js';
import * as data from '../core/data.js';
import { teamColor } from '../core/colors.js';
import { vhead, card, tchip, footer, loading, seg } from '../core/ui.js';
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
