// Pist rehberi: takvimdeki pistler, tum pistler, pist detayi
import { h, add, debounce, clear } from '../core/util.js';
import { L, countryName, nf, fmtDay, driverName, teamName } from '../core/i18n.js';
import * as data from '../core/data.js';

import { vhead, card, flag, footer, empty, dchip, tchip } from '../core/ui.js';
import { trackSvg, raceHref, placeLine } from './common.js';
import { trackOutline } from './race.js';
import { loadAll } from '../core/hist.js';

const TYPE = () => ({ STREET: L('Sokak pisti', 'Street circuit'), RACE: L('Yarış pisti', 'Race circuit'), ROAD: L('Yol pisti', 'Road course') });

export async function render(root, ctx) {
  if (ctx.key === 'pist' && ctx.params[0]) return detail(root, ctx, ctx.params[0]);
  return index(root, ctx);
}

async function index(root, ctx) {
  const { ref, meta, seasons } = ctx;
  const geo = await data.geo().catch(() => ({}));
  const now = Date.now();
  const upcoming = [];
  const seen = new Set();
  for (const S of seasons) for (const r of S.races) {
    if (seen.has(r.c)) continue;
    if (r.res?.length && S === seasons[0] && seasons.length > 1 && seasons[1].races.some((x) => x.c === r.c)) continue;
    seen.add(r.c);
    upcoming.push({ S, r });
  }
  const cards = upcoming.map(({ S, r }) => {
    const c = ref.circuits[r.c] || {};
    const isPast = !!r.res?.length;
    return h('a', { class: 'card', href: `#pist/${r.c}`, style: { textDecoration: 'none', display: 'grid', gridTemplateColumns: '90px 1fr', gap: '14px', alignItems: 'center' } },
      h('div', { class: 'mini', style: { width: '90px', height: '70px' } }, geo[r.c] ? styleTrack(trackSvg(geo[r.c])) : null),
      h('div', { style: { minWidth: 0 } }, h('div', { class: 'strong row', style: { gap: '8px' } }, flag(ref, c.nat), h('span', { class: 'ellip' }, c.n || r.c)),
        h('div', { class: 'muted t-small ellip' }, placeLine(ref, r.c)),
        h('div', { class: 'dim t-small' }, `${nf(c.len, 3)} km, ${c.turns || '–'} ${L('viraj', 'turns')}; `, isPast ? L(`${S.year} yarışı koşuldu`, `${S.year} race done`) : L(`yarış ${fmtDay(r.date, { weekday: false })} ${S.year}`, `race ${fmtDay(r.date, { weekday: false })} ${S.year}`))));
  });
  const all = Object.entries(ref.circuits).sort((a, b) => (b[1].races || 0) - (a[1].races || 0));
  const listEl = h('div', { class: 'list' });
  const draw = (q = '') => {
    clear(listEl);
    const ql = q.toLocaleLowerCase();
    for (const [id, c] of all.filter(([, c]) => !ql || `${c.fn} ${c.p} ${countryName(ref, c.nat)}`.toLocaleLowerCase().includes(ql)).slice(0, 80)) {
      listEl.appendChild(h('a', { class: 'li', href: `#pist/${id}` }, flag(ref, c.nat), h('div', { style: { minWidth: 0 } }, h('div', { class: 'li-t ellip' }, c.fn), h('div', { class: 'li-s' }, `${c.p}, ${countryName(ref, c.nat)}`)), h('span', { class: 'r muted num t-small' }, L(`${c.races} yarış`, `${c.races} races`))));
    }
  };
  draw();
  add(root, vhead({ title: L('Pistler', 'Circuits'), sub: L('Takvimdeki pistlerin krokileri, özellikleri ve geçmiş kazananları.', 'Layouts, facts and past winners of the circuits on the calendar.') }),
    h('div', { class: 'grid g3' }, cards),
    h('section', { class: 'mt-l' }, h('div', { class: 'card-h' }, h('h2', { class: 't-h2' }, L(`Tüm pistler (${all.length})`, `All circuits (${all.length})`)), h('span', { class: 'sp' }),
      h('input', { type: 'search', placeholder: L('Pist ya da ülke ara', 'Search circuit or country'), 'aria-label': L('Pist ara', 'Search circuits'), onInput: debounce((e) => draw(e.target.value), 150) })),
    card(null, listEl)), footer(meta));
}

function styleTrack(svg) {
  if (!svg) return null;
  svg.style.width = '100%'; svg.style.height = '100%';
  svg.querySelector('path').setAttribute('style', 'fill:none;stroke:var(--ink-2);stroke-width:2.2;vector-effect:non-scaling-stroke;stroke-linejoin:round');
  return svg;
}

async function detail(root, ctx, id) {
  const { ref, meta, seasons } = ctx;
  const c = ref.circuits[id];
  if (!c) { add(root, vhead({ title: L('Pist bulunamadı', 'Circuit not found') }), empty(L('Bu pist kayıtlarda yok', 'No such circuit'))); return; }
  const geo = await data.geo().catch(() => ({}));
  const next = seasons.flatMap((S) => S.races.map((r) => ({ S, r }))).find(({ r }) => r.c === id && !r.res?.length);
  add(root, vhead({ crumbs: [{ href: '#pistler', label: L('Pistler', 'Circuits') }, { label: c.n }], title: c.fn,
    sub: h('span', { class: 'row wrap', style: { gap: '6px 12px' } }, flag(ref, c.nat), `${c.p}, ${countryName(ref, c.nat)}`, next ? h('a', { class: 'badge acc', href: raceHref(next.S.year, next.r.r), style: { textDecoration: 'none' } }, L(`Sıradaki yarış: ${fmtDay(next.r.date)}`, `Next race: ${fmtDay(next.r.date)}`)) : null) }));
  const facts = h('dl', { class: 'kv' },
    h('dt', {}, L('Tur uzunluğu', 'Lap length')), h('dd', {}, c.len ? `${nf(c.len, 3)} km` : '–'),
    h('dt', {}, L('Viraj', 'Turns')), h('dd', {}, c.turns || '–'),
    h('dt', {}, L('Yön', 'Direction')), h('dd', {}, c.dir === 'ANTI_CLOCKWISE' ? L('Saat yönünün tersi', 'Anticlockwise') : L('Saat yönü', 'Clockwise')),
    h('dt', {}, L('Tür', 'Type')), h('dd', {}, TYPE()[c.type] || '–'),
    h('dt', {}, L('F1 yarışı', 'F1 races')), h('dd', {}, c.races || '–'),
    h('dt', {}, L('Konum', 'Location')), h('dd', {}, h('a', { href: `https://www.openstreetmap.org/?mlat=${c.lat}&mlon=${c.lng}#map=14/${c.lat}/${c.lng}`, target: '_blank', rel: 'noopener' }, `${nf(c.lat, 4)}, ${nf(c.lng, 4)}`)));
  const grid = h('div', { class: 'grid g2' });
  grid.append(card(L('Kroki', 'Layout'), h('div', {}, geo[id] ? h('div', { style: { maxWidth: '520px', margin: '0 auto' } }, trackOutline(geo[id])) : h('p', { class: 'muted' }, L('Bu pist için kroki yok.', 'No layout for this circuit.')), h('div', { class: 'mt' }, facts))));
  const side = h('div', { class: 'stack' });
  grid.appendChild(side);
  add(root, grid);
  try {
    const all = await loadAll();
    const ci = all.cIdx.get(id);
    const races = all.races.map((r, i) => ({ r, i })).filter(({ r }) => r[5] === ci).reverse();
    const winners = races.map(({ r, i }) => { const w = (all.byRace.get(i) || []).find((x) => x[3] === 1); return w ? { year: r[1], round: r[2], gp: all.gp[r[4]], d: all.dr[w[1]], t: all.te[w[2]] } : null; }).filter(Boolean);
    const cnt = (key) => { const m = new Map(); for (const w of winners) m.set(w[key], (m.get(w[key]) || 0) + 1); return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5); };
    side.append(
      card(L('En çok kazananlar', 'Most wins here'), h('div', { class: 'grid g2', style: { gap: '18px' } },
        h('div', { class: 'list' }, cnt('d').map(([d, n]) => h('div', { class: 'li' }, dchip(ref, d, { t: null, name: true }), h('span', { class: 'sp' }), h('strong', {}, n)))),
        h('div', { class: 'list' }, cnt('t').map(([t, n]) => h('div', { class: 'li' }, tchip(ref, t), h('span', { class: 'sp' }), h('strong', {}, n)))))),
      card(L('Kazananlar', 'Winners'), h('div', { class: 'list' }, winners.slice(0, 25).map((w) => h('a', { class: 'li', href: raceHref(w.year, w.round) },
        h('span', { class: 'num dim', style: { width: '42px' } }, w.year), h('span', { class: 'li-t ellip' }, driverName(ref, w.d)), h('span', { class: 'sp' }), h('span', { class: 'muted t-small' }, teamName(ref, w.t)))))));
  } catch { /* gecmis yuklenemedi */ }
  add(root, footer(meta));
}
