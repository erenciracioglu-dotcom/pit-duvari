// Bugun F1 tarihinde: bu tarihte kosulan yarislar ve dogan pilotlar
import { h, add, todayKey } from '../core/util.js';
import { L, driverName, teamName, gpName, fmtDate } from '../core/i18n.js';
import { teamColor } from '../core/colors.js';
import { vhead, card, footer, icon, flag, loading } from '../core/ui.js';
import { loadAll } from '../core/hist.js';
import { raceHref } from './common.js';

export async function render(root, ctx) {
  const { ref, meta } = ctx;
  const md = ctx.params[0] && /^\d{2}-\d{2}$/.test(ctx.params[0]) ? ctx.params[0] : todayKey().slice(5);
  const [mm, dd] = md.split('-').map(Number);
  const shift = (n) => { const d = new Date(Date.UTC(2024, mm - 1, dd + n)); return `${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`; };
  const label = fmtDate(`2024-${md}`, { day: 'numeric', month: 'long' });
  add(root, vhead({ title: L(`${label}: F1 tarihinde bugün`, `On this day: ${label}`), sub: L('Bu tarihte koşulan şampiyona yarışları ve bu tarihte doğan pilotlar.', 'Championship races held and drivers born on this date.'),
    actions: h('div', { class: 'row' }, h('a', { class: 'btn sm ghost', href: `#bugun/${shift(-1)}` }, icon('chevL'), L('Önceki gün', 'Previous day')), h('a', { class: 'btn sm ghost', href: `#bugun/${shift(1)}` }, L('Sonraki gün', 'Next day'), icon('chevR'))) }));
  const body = h('div', {}, loading());
  root.appendChild(body);
  const all = await loadAll();
  const races = all.races.map((r, i) => ({ r, i })).filter(({ r }) => r[3]?.slice(5) === md).sort((a, b) => b.r[1] - a.r[1]);
  const nowY = new Date().getFullYear();
  const raceRows = races.map(({ r, i }) => {
    const w = (all.byRace.get(i) || []).find((x) => x[3] === 1);
    const t = w ? all.te[w[2]] : null;
    return h('a', { class: 'li', href: raceHref(r[1], r[2]) },
      h('div', { style: { width: '64px', flex: 'none' } }, h('div', { class: 'strong num' }, r[1]), h('div', { class: 'li-s' }, L(`${nowY - r[1]} yıl önce`, `${nowY - r[1]} years ago`))),
      h('div', { style: { minWidth: 0 } }, h('div', { class: 'li-t' }, gpName(ref, all.gp[r[4]])), w ? h('div', { class: 'li-s row', style: { gap: '6px' } }, h('span', { class: 'tdot', style: { background: teamColor(t) } }), L(`Kazanan: ${driverName(ref, all.dr[w[1]])} (${teamName(ref, t)})`, `Winner: ${driverName(ref, all.dr[w[1]])} (${teamName(ref, t)})`)) : null));
  });
  const born = Object.entries(ref.drivers).filter(([, d]) => d.dob?.slice(5) === md).sort((a, b) => (b[1].s?.[1] || 0) - (a[1].s?.[1] || 0) || (b[1].s?.[0] || 0) - (a[1].s?.[0] || 0)).slice(0, 20);
  const bornRows = born.map(([id, d]) => h('a', { class: 'li', href: `#surucu/${id}` }, flag(ref, d.nat),
    h('div', { style: { minWidth: 0 } }, h('div', { class: 'li-t' }, d.n), h('div', { class: 'li-s' }, L(`${d.dob.slice(0, 4)} doğumlu; ${d.s?.[0] || 0} yarış, ${d.s?.[1] || 0} galibiyet${d.s?.[5] ? `, ${d.s[5]} şampiyonluk` : ''}`, `Born ${d.dob.slice(0, 4)}; ${d.s?.[0] || 0} starts, ${d.s?.[1] || 0} wins${d.s?.[5] ? `, ${d.s[5]} titles` : ''}`)))));
  body.replaceChildren(h('div', { class: 'grid g2' },
    card(L(`Bu tarihte koşulan yarışlar (${races.length})`, `Races on this date (${races.length})`), races.length ? h('div', { class: 'list' }, raceRows) : h('p', { class: 'muted', style: { margin: 0 } }, L('Bu tarihte hiç şampiyona yarışı koşulmamış.', 'No championship race was ever held on this date.'))),
    card(L(`Bu tarihte doğanlar (${born.length})`, `Born on this date (${born.length})`), born.length ? h('div', { class: 'list' }, bornRows) : h('p', { class: 'muted', style: { margin: 0 } }, L('Bu tarihte doğan F1 pilotu yok.', 'No F1 driver was born on this date.')))));
  add(root, footer(meta));
}
