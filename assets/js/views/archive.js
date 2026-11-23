// Arsiv: 1950'den bugune sezonlar, sezon ozeti, surucu arama
import { h, clear, fmtPts, debounce, add } from '../core/util.js';
import { L, driverName, teamName, gpName, fmtDay } from '../core/i18n.js';
import * as data from '../core/data.js';
import { teamColor } from '../core/colors.js';
import { vhead, card, dchip, tchip, flag, footer, empty, icon } from '../core/ui.js';
import { raceHref } from './common.js';

export async function render(root, ctx) {
  const year = Number(ctx.params[0]);
  if (year) return seasonView(root, ctx, year);
  return indexView(root, ctx);
}

async function indexView(root, ctx) {
  const { ref, meta } = ctx;
  let all = null;
  try { all = await data.allResults(); } catch { /* sampiyon bilgisi olmadan */ }
  const champOf = (y) => {
    const sd = all?.sd?.[y]?.find((x) => x[3]);
    const sc = all?.sc?.[y]?.find((x) => x[3]);
    return { d: sd ? all.dr[sd[0]] : null, c: sc ? all.te[sc[0]] : null };
  };
  const teamOfChamp = (y, d) => {
    if (!all) return null;
    const di = all.dr.indexOf(d);
    const row = all.res.find((x) => all.races[x[0]][1] === y && x[1] === di);
    return row ? all.te[row[2]] : null;
  };
  // surucu arama
  const results = h('div', { class: 'list' });
  const ids = Object.keys(ref.drivers);
  const search = h('input', { type: 'search', placeholder: L('Pilot ara (ör. Senna, Hamilton)', 'Search a driver (e.g. Senna, Hamilton)'), 'aria-label': L('Pilot ara', 'Search drivers'), style: { width: '100%', maxWidth: '420px' },
    onInput: debounce((e) => {
      const q = e.target.value.trim().toLocaleLowerCase(L('tr-TR', 'en-GB'));
      clear(results);
      if (q.length < 2) return;
      const hits = ids.filter((id) => ref.drivers[id].n.toLocaleLowerCase(L('tr-TR', 'en-GB')).includes(q)).sort((a, b) => (ref.drivers[b].s?.[0] || 0) - (ref.drivers[a].s?.[0] || 0)).slice(0, 12);
      if (!hits.length) results.appendChild(h('p', { class: 'muted' }, L('Bulunamadı.', 'No match.')));
      for (const id of hits) {
        const d = ref.drivers[id];
        results.appendChild(h('a', { class: 'li', href: `#surucu/${id}` }, flag(ref, d.nat), h('div', {}, h('div', { class: 'li-t' }, d.n), h('div', { class: 'li-s' }, `${d.y ? `${d.y[0]}–${d.y[1]}` : ''}, ${d.s?.[0] || 0} ${L('yarış', 'starts')}, ${d.s?.[1] || 0} ${L('galibiyet', 'wins')}`))));
      }
    }, 150) });

  const decades = new Map();
  for (let y = meta.currentSeason; y >= meta.firstSeason; y--) {
    const dk = Math.floor(y / 10) * 10;
    if (!decades.has(dk)) decades.set(dk, []);
    decades.get(dk).push(y);
  }
  const blocks = [...decades.entries()].map(([dk, ys]) => h('section', { class: 'mt-l' },
    h('h2', { class: 't-h2', style: { marginBottom: '10px' } }, L(`${dk}'ler`, `${dk}s`)),
    h('div', { class: 'stats', style: { gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))' } }, ys.map((y) => {
      const ch = champOf(y);
      const t = ch.d ? teamOfChamp(y, ch.d) : null;
      return h('a', { class: 'stat', href: `#arsiv/${y}`, style: { textDecoration: 'none', borderLeft: `4px solid ${t ? teamColor(t) : 'var(--line-2)'}` } },
        h('div', { class: 'v' }, y),
        h('div', { class: 'k', style: { color: 'var(--ink-2)' } }, ch.d ? driverName(ref, ch.d) : y === meta.currentSeason ? L('devam ediyor', 'in progress') : '–'));
    }))));
  add(root, vhead({ title: L('Arşiv', 'Archive'), sub: L(`${meta.currentSeason - meta.firstSeason + 1} sezon, ${all ? all.races.length : 1100}+ yarış. Bir sezona dokun ya da pilot ara.`, `${meta.currentSeason - meta.firstSeason + 1} seasons and ${all ? all.races.length : 1100}+ races. Pick a season or search a driver.`) }),
    search, results, ...blocks, footer(meta));
}

async function seasonView(root, ctx, year) {
  const { ref, meta } = ctx;
  let season;
  try { season = year === meta.currentSeason ? ctx.cur : await data.season(year); } catch { add(root, vhead({ title: String(year) }), empty(L('Sezon bulunamadı', 'Season not found'))); return; }
  const done = season.races.filter((r) => r.res?.length);
  const ch = season.champion;
  const tD = ch?.d ? data.teamOf(season, ch.d) : null;
  const nav = h('div', { class: 'row' },
    year > meta.firstSeason ? h('a', { class: 'btn sm ghost', href: `#arsiv/${year - 1}` }, icon('chevL'), year - 1) : null,
    year < meta.currentSeason ? h('a', { class: 'btn sm ghost', href: `#arsiv/${year + 1}` }, year + 1, icon('chevR')) : null);
  add(root, vhead({ crumbs: [{ href: '#arsiv', label: L('Arşiv', 'Archive') }, { label: String(year) }], title: L(`${year} sezonu`, `${year} season`),
    sub: L(`${season.races.length} yarış${ch?.d ? `; şampiyon ${driverName(ref, ch.d)}` : ''}${ch?.c ? `, takımlarda ${teamName(ref, ch.c)}` : ''}.`, `${season.races.length} races${ch?.d ? `; champion ${driverName(ref, ch.d)}` : ''}${ch?.c ? `, constructors ${teamName(ref, ch.c)}` : ''}.`),
    actions: nav }));

  const champCard = ch?.d ? h('section', { class: 'board', style: { gap: '8px' } }, h('div', { class: 'info' },
    h('div', { class: 'when' }, L('Dünya şampiyonu', 'World champion')),
    h('h2', { class: 't-display', style: { fontSize: 'clamp(2.4rem, 8vw, 4.2rem)', marginTop: '10px' } }, driverName(ref, ch.d)),
    h('div', { class: 'circ row wrap' }, flag(ref, ref.drivers[ch.d]?.nat), tD ? teamName(ref, tD) : '', season.final?.d?.[0] ? h('span', { class: 'dim' }, `${fmtPts(season.final.d[0][2])} ${L('puan', 'pts')}`) : null))) : null;

  const wins = new Map();
  for (const r of done) { const w = r.res[0]; if (w?.pn === 1) wins.set(w.d, (wins.get(w.d) || 0) + 1); }
  const racesCard = card(L('Yarışlar', 'Races'), h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl compact' },
    h('thead', {}, h('tr', {}, h('th', { class: 'n' }, '#'), h('th', {}, L('Grand Prix', 'Grand Prix')), h('th', { class: 'hide-sm' }, L('Tarih', 'Date')), h('th', {}, L('Kazanan', 'Winner')), h('th', { class: 'hide-sm' }, 'Pole'))),
    h('tbody', {}, season.races.map((r) => {
      const w = r.res?.[0];
      const pole = r.res?.find((x) => x.pole) || (r.q?.[0] ? { d: r.q[0].d, t: r.q[0].t } : null);
      return h('tr', {}, h('td', { class: 'n dim' }, r.r),
        h('td', {}, h('a', { href: raceHref(year, r.r) }, gpName(ref, r.gp))),
        h('td', { class: 'hide-sm muted' }, fmtDay(r.date, { weekday: false })),
        h('td', {}, w ? dchip(ref, w.d, { t: w.t }) : h('span', { class: 'dim' }, '–')),
        h('td', { class: 'hide-sm' }, pole ? dchip(ref, pole.d, { t: pole.t, short: true }) : ''));
    })))), { flush: false });

  const dTable = card(L('Pilotlar', 'Drivers'), h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl compact' },
    h('tbody', {}, (season.final?.d || []).slice(0, 25).map(([d, pos, pts, won]) => h('tr', {}, h('td', { class: 'p' }, pos || '–'), h('td', {}, dchip(ref, d, { t: data.teamOf(season, d) }), won ? h('span', { class: 'badge acc', style: { marginLeft: '6px' } }, '1') : null), h('td', { class: 'n' }, wins.get(d) || ''), h('td', { class: 'n strong' }, fmtPts(pts))))))),
  { more: { href: `#puan/${year}`, label: L('Ayrıntılı tablo', 'Full table') } });
  const cTable = season.final?.c?.length ? card(L('Takımlar', 'Constructors'), h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl compact' },
    h('tbody', {}, season.final.c.map(([t, pos, pts]) => h('tr', {}, h('td', { class: 'p' }, pos || '–'), h('td', {}, tchip(ref, t)), h('td', { class: 'n strong' }, fmtPts(pts)))))))) : null;

  add(root, ...[champCard, h('div', { class: 'grid g-7-5' }, racesCard, h('div', { class: 'stack' }, dTable, cTable))].filter(Boolean),
    h('div', { class: 'row wrap mt' }, h('a', { class: 'btn', href: `#karne/${year}` }, icon('report'), L('Sezon karnesi', 'Season report')), h('a', { class: 'btn ghost', href: `#simulator/puan/${year}` }, icon('sliders'), L('Başka puan sistemiyle hesapla', 'Recalculate with another points system'))),
    footer(meta));
}
