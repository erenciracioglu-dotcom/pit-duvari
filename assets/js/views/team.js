// Takim sayfasi
import { h, fmtPts, add } from '../core/util.js';
import { L, driverName, teamName, countryName, nf } from '../core/i18n.js';
import * as data from '../core/data.js';
import { teamColor } from '../core/colors.js';
import { vhead, card, dchip, flag, footer, empty, icon } from '../core/ui.js';
import { seasonStrip } from './driver.js';

export async function render(root, ctx) {
  const { ref, meta, cur } = ctx;
  const id = ctx.params[0];
  const t = ref.constructors[id];
  if (!t) { add(root, vhead({ title: L('Takım bulunamadı', 'Team not found') }), empty(L('Bu takım kayıtlarda yok', 'No such team'))); return; }
  const [starts, wins, pods, poles, fls, titles, points, oneTwos] = t.s || [];
  const col = teamColor(id);
  add(root, vhead({
    crumbs: [{ href: '#puan/' + meta.currentSeason + '/takimlar', label: L('Takımlar', 'Teams') }, { label: t.n }],
    title: h('span', { class: 'row', style: { gap: '14px' } }, h('span', { style: { width: '10px', alignSelf: 'stretch', background: col, borderRadius: '3px' } }), t.n),
    sub: h('span', { class: 'row wrap', style: { gap: '6px 14px' } }, flag(ref, t.nat), countryName(ref, t.nat), t.y ? h('span', { class: 'dim' }, `${t.y[0]}–${t.y[1]}`) : null, t.fn && t.fn !== t.n ? h('span', { class: 'dim' }, t.fn) : null)
  }));
  root.appendChild(h('div', { class: 'stats' },
    stat(titles || 0, L('takımlar şampiyonluğu', 'constructors’ titles')), stat(starts || 0, L('yarış', 'races')), stat(wins || 0, L('galibiyet', 'wins')),
    stat(pods || 0, L('podyum', 'podiums')), stat(poles || 0, 'pole'), stat(oneTwos || 0, L('1-2 bitiriş', '1-2 finishes')), stat(fmtPts(points || 0), L('puan', 'points'))));

  const lineup = data.lineup(ref, cur).get(id) || [];
  if (lineup.length) root.appendChild(h('div', { class: 'grid g2 mt' }, lineup.map((d) => seasonStrip(ctx, cur, d))));
  if (lineup.length === 2) root.appendChild(h('div', { class: 'mt' }, h('a', { class: 'btn', href: `#kafa-kafaya/${lineup[0]}/${lineup[1]}` }, icon('versus'), L('Takım içi düello', 'Teammate duel'))));

  let all;
  try { all = await data.allResults(); } catch { root.appendChild(footer(meta)); return; }
  const ti = all.te.indexOf(id);
  const byYear = new Map();
  const drvWins = new Map();
  for (const x of all.res) {
    if (x[2] !== ti) continue;
    const y = all.races[x[0]][1];
    if (!byYear.has(y)) byYear.set(y, { y, drivers: new Set(), wins: 0, pods: 0 });
    const o = byYear.get(y);
    o.drivers.add(all.dr[x[1]]);
    if (x[3] === 1) { o.wins++; drvWins.set(x[1], (drvWins.get(x[1]) || 0) + 1); }
    if (x[3] && x[3] <= 3) o.pods++;
  }
  const years = [...byYear.values()].sort((a, b) => b.y - a.y);
  const pos = (y) => all.sc?.[y]?.find((r) => r[0] === ti);
  const grid = h('div', { class: 'grid g-7-5 mt' });
  grid.appendChild(card(L('Sezon sezon', 'Season by season'), h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl compact' },
    h('thead', {}, h('tr', {}, h('th', {}, L('Sezon', 'Season')), h('th', { class: 'n' }, L('Sıra', 'Pos')), h('th', { class: 'n' }, L('Puan', 'Pts')), h('th', { class: 'n' }, L('Gal.', 'Wins')), h('th', {}, L('Pilotlar', 'Drivers')))),
    h('tbody', {}, years.map((o) => { const p = pos(o.y); return h('tr', {}, h('td', {}, h('a', { href: `#arsiv/${o.y}` }, o.y)), h('td', { class: 'n strong' }, p?.[1] ? (p[3] ? h('span', { class: 'badge acc' }, '1') : p[1]) : '–'), h('td', { class: 'n' }, p ? fmtPts(p[2]) : ''), h('td', { class: 'n' }, o.wins || ''),
      h('td', { class: 't-small muted' }, [...o.drivers].map((d) => driverName(ref, d, 'last')).join(', '))); }))))));
  const top = [...drvWins.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  if (top.length) grid.appendChild(card(L('En çok kazandıranlar', 'Most wins for the team'), h('div', { class: 'list' }, top.map(([di, n]) => h('div', { class: 'li' }, dchip(ref, all.dr[di], { t: id }), h('span', { class: 'sp' }), h('strong', { class: 'num' }, n))))));
  add(root, grid, footer(meta));
  void teamName; void nf; void fls;
}
const stat = (v, k) => h('div', { class: 'stat' }, h('div', { class: 'v' }, String(v)), h('div', { class: 'k' }, k));
