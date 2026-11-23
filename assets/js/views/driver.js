// Pilot sayfasi: kariyer istatistikleri, sezon sezon, takim arkadaslari, bu sezonun sonuclari
import { h, fmtPts, add } from '../core/util.js';
import { L, driverName, teamName, gpName, countryName, fmtDate, nf, ordinalTr } from '../core/i18n.js';
import * as data from '../core/data.js';
import { teamColor } from '../core/colors.js';
import { vhead, card, dchip, tchip, flag, footer, empty, icon } from '../core/ui.js';
import { lineChart, chartCard } from '../core/charts.js';
import { raceHref } from './common.js';

export function cellStyle(pn, p) {
  if (pn === 1) return { background: 'var(--accent)', color: 'var(--accent-ink)' };
  if (pn && pn <= 3) return { background: 'var(--bg-4)', color: 'var(--ink)' };
  if (pn && pn <= 10) return { background: 'var(--bg-3)', color: 'var(--ink)' };
  if (pn) return { color: 'var(--ink-3)' };
  return { color: 'var(--bad)', fontSize: '0.7rem' };
}

export async function render(root, ctx) {
  const { ref, meta, cur } = ctx;
  const id = ctx.params[0];
  const d = ref.drivers[id];
  if (!d) { add(root, vhead({ title: L('Pilot bulunamadı', 'Driver not found') }), empty(L('Bu pilot kayıtlarda yok', 'No such driver'))); return; }
  const [starts, wins, pods, poles, fls, titles, points] = d.s || [];
  const age = d.dob ? Math.floor(((d.dod ? Date.parse(d.dod) : Date.now()) - Date.parse(d.dob)) / (365.2425 * 86400000)) : null;
  const curTeam = data.teamOf(cur, id);
  const inCur = cur.races.some((r) => (r.res || r.q || []).some((x) => x.d === id)) || (ref.lineup || []).some((x) => x.d === id);
  add(root, vhead({
    crumbs: [{ href: '#arsiv', label: L('Pilotlar', 'Drivers') }, { label: d.n }],
    title: d.n,
    sub: h('span', { class: 'row wrap', style: { gap: '6px 14px' } }, flag(ref, d.nat, 'lg'), countryName(ref, d.nat),
      d.no ? h('span', { class: 'badge' }, `#${d.no}`) : null,
      d.dob ? h('span', { class: 'dim' }, L(`${fmtDate(d.dob)} doğumlu${d.pob ? `, ${d.pob}` : ''}${d.dod ? ` (${fmtDate(d.dod)}, ${age} yaşında öldü)` : age ? ` (${age} yaşında)` : ''}`, `Born ${fmtDate(d.dob)}${d.pob ? `, ${d.pob}` : ''}${d.dod ? ` (died ${fmtDate(d.dod)}, aged ${age})` : age ? ` (age ${age})` : ''}`)) : null,
      inCur && curTeam ? tchip(ref, curTeam) : null),
    actions: h('a', { class: 'btn', href: `#kafa-kafaya/${id}` }, icon('versus'), L('Başka pilotla karşılaştır', 'Compare with another driver'))
  }));

  root.appendChild(h('div', { class: 'stats' },
    stat(titles || 0, L('dünya şampiyonluğu', 'world titles')), stat(starts || 0, L('yarış', 'starts')), stat(wins || 0, L('galibiyet', 'wins')),
    stat(pods || 0, L('podyum', 'podiums')), stat(poles || 0, 'pole'), stat(fls || 0, L('en hızlı tur', 'fastest laps')),
    stat(fmtPts(points || 0), L('puan', 'points')), starts ? stat(`%${nf((100 * (wins || 0)) / starts, 1)}`, L('galibiyet oranı', 'win rate')) : null));

  if (inCur) root.appendChild(h('div', { class: 'mt' }, seasonStrip(ctx, cur, id)));

  let all;
  try { all = await data.allResults(); } catch { root.appendChild(footer(meta)); return; }
  const di = all.dr.indexOf(id);
  const rows = all.res.filter((x) => x[1] === di);
  const byYear = new Map();
  for (const x of rows) {
    const y = all.races[x[0]][1];
    if (!byYear.has(y)) byYear.set(y, { y, teams: new Set(), starts: 0, wins: 0, pods: 0, poles: 0, pts: 0, best: 99 });
    const o = byYear.get(y);
    o.teams.add(all.te[x[2]]);
    if (!(x[6] & 16)) o.starts++;
    if (x[3] === 1) o.wins++;
    if (x[3] && x[3] <= 3) o.pods++;
    if (x[6] & 1) o.poles++;
    o.pts += x[5] / 2;
    if (x[3]) o.best = Math.min(o.best, x[3]);
  }
  const years = [...byYear.values()].sort((a, b) => b.y - a.y);
  const champPos = (y) => all.sd?.[y]?.find((r) => r[0] === di);
  const tbl = h('table', { class: 'tbl compact' },
    h('thead', {}, h('tr', {}, h('th', {}, L('Sezon', 'Season')), h('th', {}, L('Takım', 'Team')), h('th', { class: 'n' }, L('Sıra', 'Pos')), h('th', { class: 'n' }, L('Puan', 'Pts')), h('th', { class: 'n' }, L('Yarış', 'Starts')), h('th', { class: 'n' }, L('Gal.', 'Wins')), h('th', { class: 'n hide-sm' }, L('Podyum', 'Pod.')), h('th', { class: 'n hide-sm' }, 'Pole'))),
    h('tbody', {}, years.map((o) => { const cp = champPos(o.y); return h('tr', {},
      h('td', {}, h('a', { href: `#arsiv/${o.y}` }, o.y)),
      h('td', {}, h('span', { class: 'row wrap', style: { gap: '4px 10px' } }, [...o.teams].map((t) => tchip(ref, t)))),
      h('td', { class: 'n strong' }, cp?.[1] ? (cp[3] ? h('span', { class: 'badge acc' }, '1') : cp[1]) : '–'),
      h('td', { class: 'n' }, cp ? fmtPts(cp[2]) : fmtPts(o.pts)),
      h('td', { class: 'n' }, o.starts), h('td', { class: 'n' }, o.wins || ''), h('td', { class: 'n hide-sm' }, o.pods || ''), h('td', { class: 'n hide-sm' }, o.poles || '')); })));
  const grid = h('div', { class: 'grid g-7-5 mt' });
  grid.appendChild(card(L('Sezon sezon', 'Season by season'), h('div', { class: 'tbl-wrap' }, tbl)));
  const side = h('div', { class: 'stack' });
  grid.appendChild(side);

  // ilkler
  const firstStart = rows.find((x) => !(x[6] & 16));
  const firstWin = rows.find((x) => x[3] === 1);
  const lastWin = [...rows].reverse().find((x) => x[3] === 1);
  const raceTxt = (x) => { const r = all.races[x[0]]; return h('a', { href: raceHref(r[1], r[2]) }, `${r[1]} ${gpName(ref, all.gp[r[4]])}`); };
  side.appendChild(card(L('Dönüm noktaları', 'Milestones'), h('dl', { class: 'kv' },
    firstStart ? [h('dt', {}, L('İlk yarış', 'Debut')), h('dd', {}, raceTxt(firstStart))] : null,
    firstWin ? [h('dt', {}, L('İlk galibiyet', 'First win')), h('dd', {}, raceTxt(firstWin))] : null,
    lastWin && lastWin !== firstWin ? [h('dt', {}, L('Son galibiyet', 'Latest win')), h('dd', {}, raceTxt(lastWin))] : null,
    [h('dt', {}, L('En iyi şampiyona', 'Best championship')), h('dd', {}, d.s?.[11] ? ordinalTr(d.s[11]) : '–')])));

  // takim arkadaslari
  const mates = new Map();
  const byRace = new Map();
  for (const x of all.res) { if (!byRace.has(x[0])) byRace.set(x[0], []); byRace.get(x[0]).push(x); }
  for (const x of rows) {
    for (const y of byRace.get(x[0]) || []) {
      if (y[1] === di || y[2] !== x[2]) continue;
      const m = mates.get(y[1]) || { races: 0, ahead: 0, behind: 0 };
      m.races++;
      const a = x[3] || 999, b = y[3] || 999;
      if (a < b) m.ahead++; else if (b < a) m.behind++;
      mates.set(y[1], m);
    }
  }
  const mateList = [...mates.entries()].sort((a, b) => b[1].races - a[1].races).slice(0, 10);
  if (mateList.length) side.appendChild(card(L('Takım arkadaşları', 'Teammates'), h('div', { class: 'list' }, mateList.map(([mi, m]) => h('a', { class: 'li', href: `#kafa-kafaya/${id}/${all.dr[mi]}` },
    h('span', { class: 'li-t ellip' }, driverName(ref, all.dr[mi])), h('span', { class: 'sp' }),
    h('span', { class: 'num t-small', title: L('Önde bitirme / geride bitirme', 'Finished ahead / behind') }, h('strong', { class: m.ahead >= m.behind ? 'pb' : 'bad' }, m.ahead), ' – ', m.behind, h('span', { class: 'dim' }, L(` (${m.races} yarış)`, ` (${m.races})`))))))));

  root.appendChild(grid);

  // sampiyona sirasi grafigi
  const ys = years.map((o) => o.y).reverse();
  if (ys.length > 2) {
    const ch = lineChart({ series: [{ id, label: d.a || d.l, color: teamColor(curTeam || [...years[0].teams][0]), values: ys.map((y) => champPos(y)?.[1] || null) }], labels: ys, height: 220, invert: true, endLabels: false, legend: false, yFmt: (v) => v, tipValue: (sr, v) => ordinalTr(v) });
    root.appendChild(h('div', { class: 'mt' }, chartCard(L('Şampiyonadaki sırası', 'Championship position'), ch, () => h('table', { class: 'tbl compact' }, h('tbody', {}, ys.map((y) => h('tr', {}, h('td', {}, y), h('td', { class: 'n' }, champPos(y)?.[1] || '–'))))))));
  }
  root.appendChild(footer(meta));
}

const stat = (v, k) => h('div', { class: 'stat' }, h('div', { class: 'v' }, String(v)), h('div', { class: 'k' }, k));

export function seasonStrip(ctx, season, id) {
  const { ref } = ctx;
  const st = data.latestStandings(season);
  const me = st.d.find((x) => x[0] === id);
  const cells = season.races.map((r) => {
    const x = r.res?.find((y) => y.d === id);
    const label = x ? (x.pn ?? x.p) : r.res ? '' : '·';
    return h('a', { class: 'cellres', href: raceHref(season.year, r.r), title: `${gpName(ref, r.gp)}${x ? `: ${x.pn ? ordinalTr(x.pn) : x.p}` : ''}`, style: x ? cellStyle(x.pn, x.p) : { color: 'var(--ink-3)' } }, label);
  });
  return card(L(`${season.year} sezonu`, `${season.year} season`), h('div', {},
    me ? h('p', { class: 'muted', style: { marginTop: 0 } }, L(`Şampiyonada ${me[1]}. sırada, ${fmtPts(me[2])} puan.`, `${ordinalTr(me[1])} in the championship on ${fmtPts(me[2])} pts.`)) : null,
    h('div', { class: 'row wrap', style: { gap: '4px' } }, cells)));
}
void teamName; void dchip;
