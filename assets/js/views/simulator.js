// "Ya soyle biterse": kalan yarislari kullanici bitirir; ya da herhangi bir sezonu baska puan sistemiyle hesaplar.
import { h, clear, add, fmtPts, rng } from '../core/util.js';
import { L, driverName, teamName, gpName } from '../core/i18n.js';
import * as data from '../core/data.js';
import * as store from '../core/store.js';
import { teamColor } from '../core/colors.js';
import { vhead, card, dchip, footer, tabs, toast, spoilerActive, empty } from '../core/ui.js';
import { seasonSelect, raceEndMs } from './common.js';

const RACE_PTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
const SPRINT_PTS = [8, 7, 6, 5, 4, 3, 2, 1];
const SYSTEMS = () => [
  { id: '2010', label: L('2010 sonrası (25-18-15…)', 'Since 2010 (25-18-15…)'), pts: RACE_PTS },
  { id: '2003', label: '2003–2009 (10-8-6-5-4-3-2-1)', pts: [10, 8, 6, 5, 4, 3, 2, 1] },
  { id: '1991', label: '1991–2002 (10-6-4-3-2-1)', pts: [10, 6, 4, 3, 2, 1] },
  { id: '1961', label: '1961–1990 (9-6-4-3-2-1)', pts: [9, 6, 4, 3, 2, 1] },
  { id: 'motogp', label: L('MotoGP usulü (25-20-16… 15 kişiye)', 'MotoGP style (25-20-16… top 15)'), pts: [25, 20, 16, 13, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1] },
  { id: 'wins', label: L('Yalnızca galibiyet sayılır', 'Wins only'), pts: [1] },
  { id: 'podium', label: L('Podyum: 3-2-1', 'Podium: 3-2-1'), pts: [3, 2, 1] }
];

export async function render(root, ctx) {
  const { meta, cur } = ctx;
  const remaining = cur.races.filter((r) => !r.res?.length);
  const mode = ctx.params[0] === 'puan' ? 'puan' : remaining.length ? 'kalan' : 'puan';
  add(root, vhead({ title: L('Ya şöyle biterse', 'What if'), sub: L('Kalan yarışların sonuçlarını sen gir ve şampiyonanın nasıl biteceğini gör; ya da herhangi bir sezonu başka bir puan sistemiyle yeniden hesapla.', 'Enter the remaining results and see how the championship ends, or recalculate any season with another points system.') }),
    tabs([remaining.length ? { key: 'kalan', label: L(`Kalan ${remaining.length} yarış`, `Remaining ${remaining.length} races`), href: '#simulator' } : null, { key: 'puan', label: L('Puan sistemi makinesi', 'Points system machine'), href: `#simulator/puan/${ctx.params[1] || meta.currentSeason}` }].filter(Boolean), mode));
  if (mode === 'kalan') {
    const last = data.lastRace([cur]);
    if (last && spoilerActive(data.raceKey(cur.year, last.race.r), raceEndMs(last.race))) {
      add(root, empty(L('Spoiler kalkanı açık', 'Spoiler shield is on'), L('Simülatör güncel puan durumunu kullanıyor; son yarışın sonucunu açınca burada başlayabilirsin.', 'The simulator uses the current standings; reveal the last race to start here.'), h('a', { class: 'btn', href: `#yaris/${cur.year}/${last.race.r}` }, L('Son yarışa git', 'Go to the last race'))));
    } else await remainingView(root, ctx, remaining);
  }
  else await systemView(root, ctx, Number(ctx.params[1]) || meta.currentSeason);
  add(root, footer(meta));
}

async function remainingView(root, ctx, remaining) {
  const { ref, cur } = ctx;
  const year = cur.year;
  const lineup = data.lineup(ref, cur);
  const drivers = [...lineup.entries()].flatMap(([t, ds]) => ds.map((d) => ({ d, t })));
  const tOf = new Map(drivers.map((x) => [x.d, x.t]));
  const base = data.latestStandings(cur);
  const p = store.get();
  const saved = p.sim?.[year] || {};
  const defOrder = base.d.map((x) => x[0]).filter((d) => tOf.has(d));
  const picks = {};
  for (const r of remaining) {
    picks[`${r.r}`] = (saved[`${r.r}`] || defOrder.slice(0, 10)).slice(0, 10);
    if (r.sprint) picks[`${r.r}s`] = (saved[`${r.r}s`] || defOrder.slice(0, 8)).slice(0, 8);
  }
  const result = h('div', {});
  const persist = () => store.update((x) => { x.sim[year] = picks; });

  const compute = () => {
    const dPts = new Map(base.d.map(([d, , pts]) => [d, pts]));
    const cPts = new Map(base.c.map(([t, , pts]) => [t, pts]));
    for (const [k, order] of Object.entries(picks)) {
      const table = k.endsWith('s') ? SPRINT_PTS : RACE_PTS;
      order.forEach((d, i) => {
        if (!d) return;
        const pts = table[i] || 0;
        dPts.set(d, (dPts.get(d) || 0) + pts);
        const t = tOf.get(d);
        if (t) cPts.set(t, (cPts.get(t) || 0) + pts);
      });
    }
    const rank = (m) => [...m.entries()].sort((a, b) => b[1] - a[1]);
    return { d: rank(dPts), c: rank(cPts) };
  };

  const renderResult = () => {
    const res = compute();
    const before = new Map(base.d.map(([d, pos]) => [d, pos]));
    const beforeC = new Map(base.c.map(([t, pos]) => [t, pos]));
    clear(result).append(h('div', { class: 'grid g2' },
      card(L('Senin senaryonda pilotlar', 'Drivers in your scenario'), h('div', { class: 'tower' }, res.d.slice(0, 10).map(([d, pts], i) => {
        const mv = (before.get(d) || 99) - (i + 1);
        return h('div', { class: 'tw' }, h('span', { class: 'pos' }, i + 1), h('span', { class: 'bar', style: { background: teamColor(tOf.get(d)) } }),
          h('span', { class: 'who' }, h('span', { class: 'code' }, driverName(ref, d, 'code')), h('span', { class: 'nm' }, driverName(ref, d, 'last'))),
          h('span', { class: 'val' }, h('strong', {}, fmtPts(pts)), ' ', mv ? h('span', { class: mv > 0 ? 'pb' : 'bad' }, mv > 0 ? `▲${mv}` : `▼${-mv}`) : null));
      })), { flush: true }),
      card(L('Senin senaryonda takımlar', 'Constructors in your scenario'), h('div', { class: 'tower' }, res.c.slice(0, 11).map(([t, pts], i) => {
        const mv = (beforeC.get(t) || 99) - (i + 1);
        return h('div', { class: 'tw' }, h('span', { class: 'pos' }, i + 1), h('span', { class: 'bar', style: { background: teamColor(t) } }),
          h('span', { class: 'who' }, h('span', { class: 'nm', style: { color: 'var(--ink)', fontWeight: 650 } }, teamName(ref, t))),
          h('span', { class: 'val' }, h('strong', {}, fmtPts(pts)), ' ', mv ? h('span', { class: mv > 0 ? 'pb' : 'bad' }, mv > 0 ? `▲${mv}` : `▼${-mv}`) : null));
      })), { flush: true })));
  };

  const raceCards = remaining.map((r) => {
    const block = (key, n, label) => {
      const order = picks[key];
      const box = h('div', { class: 'sim-grid' });
      const draw = () => {
        clear(box);
        for (let i = 0; i < n; i++) {
          const sel = h('select', { 'aria-label': `${label} ${i + 1}`, onChange: (e) => {
            const v = e.target.value;
            const j = order.indexOf(v);
            if (j >= 0 && j !== i) order[j] = order[i];
            order[i] = v;
            persist(); draw(); renderResult();
          } }, h('option', { value: '' }, '–'), drivers.map((x) => h('option', { value: x.d, selected: order[i] === x.d }, `${driverName(ref, x.d)} (${teamName(ref, x.t)})`)));
          sel.style.borderLeft = `4px solid ${teamColor(tOf.get(order[i]))}`;
          box.appendChild(h('div', { class: 'sim-row' }, h('span', { class: 'pos' }, i + 1), sel));
        }
      };
      draw();
      return h('div', {}, h('div', { class: 't-label', style: { margin: '6px 0 8px' } }, label), box);
    };
    return card(gpName(ref, r.gp), h('div', { class: 'stack' }, r.sprint ? block(`${r.r}s`, 8, L('Sprint (ilk 8 puan alır)', 'Sprint (top 8 score)')) : null, block(`${r.r}`, 10, L('Yarış (ilk 10 puan alır)', 'Race (top 10 score)'))),
      { actions: h('div', { class: 'row' },
        h('button', { class: 'btn sm ghost', type: 'button', onClick: () => { const rand = rng(Date.now()); const w = defOrder.map((d, i) => ({ d, k: rand() * (1 + i * 0.35) })).sort((a, b) => a.k - b.k).map((x) => x.d); picks[`${r.r}`] = w.slice(0, 10); if (r.sprint) picks[`${r.r}s`] = w.slice(0, 8); persist(); window.dispatchEvent(new Event('pd:rerender')); } }, L('Zar at', 'Randomise'))) });
  });
  add(root, h('p', { class: 'muted' }, L('Varsayılan senaryo, sıralamanın bugünkü haliyle bitmesi. Seçimlerin bu cihazda saklanır.', 'The default scenario keeps today’s order. Your picks are saved on this device.')),
    h('div', { class: 'row wrap', style: { marginBottom: '14px' } }, h('button', { class: 'btn sm', type: 'button', onClick: () => { store.update((x) => { delete x.sim[year]; }); toast(L('Senaryo sıfırlandı.', 'Scenario reset.')); window.dispatchEvent(new Event('pd:rerender')); } }, L('Sıfırla', 'Reset'))),
    h('div', { class: 'grid g-5-7' }, h('div', { class: 'stack' }, raceCards), result));
  renderResult();
}

async function systemView(root, ctx, year) {
  const { ref, meta } = ctx;
  const season = year === meta.currentSeason ? ctx.cur : await data.season(year);
  const systems = SYSTEMS();
  let sys = systems[0];
  let sprints = true;
  const out = h('div', {});
  const years = []; for (let y = meta.currentSeason; y >= meta.firstSeason; y--) years.push(y);
  const draw = () => {
    const pts = new Map();
    for (const r of season.races) {
      for (const x of r.res || []) if (x.pn && x.pn <= sys.pts.length) pts.set(x.d, (pts.get(x.d) || 0) + sys.pts[x.pn - 1]);
      if (sprints && sys.id === '2010') for (const x of r.spr || []) if (x.pts) pts.set(x.d, (pts.get(x.d) || 0) + x.pts);
    }
    const ranked = [...pts.entries()].sort((a, b) => b[1] - a[1]);
    const actual = new Map((season.final?.d || []).map(([d, pos, p]) => [d, { pos, p }]));
    const champ = ranked[0]?.[0];
    const realChamp = (season.final?.d || []).find((x) => x[3])?.[0] || season.final?.d?.[0]?.[0];
    clear(out).append(
      h('p', { class: champ === realChamp ? 'muted' : 'strong', style: { marginTop: 0 } }, champ === realChamp
        ? L(`Bu sistemle de şampiyon değişmiyor: ${driverName(ref, champ)}.`, `Same champion under this system: ${driverName(ref, champ)}.`)
        : L(`Bu sistemle şampiyon ${driverName(ref, champ)} olurdu; gerçekte ${driverName(ref, realChamp)} kazandı.`, `Under this system ${driverName(ref, champ)} would be champion; in reality ${driverName(ref, realChamp)} won.`)),
      h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl' },
        h('thead', {}, h('tr', {}, h('th', { class: 'n' }, L('Sıra', 'Pos')), h('th', {}, L('Pilot', 'Driver')), h('th', { class: 'n' }, L('Puan', 'Pts')), h('th', { class: 'n' }, L('Gerçek sıra', 'Actual')), h('th', { class: 'n' }, ''))),
        h('tbody', {}, ranked.slice(0, 20).map(([d, p], i) => { const a = actual.get(d); const mv = a?.pos ? a.pos - (i + 1) : 0; return h('tr', {},
          h('td', { class: 'p' }, i + 1), h('td', {}, dchip(ref, d, { t: data.teamOf(season, d) })), h('td', { class: 'n strong' }, fmtPts(p)),
          h('td', { class: 'n muted' }, a?.pos ? `${a.pos}. (${fmtPts(a.p)})` : '–'), h('td', { class: 'n' }, mv ? h('span', { class: mv > 0 ? 'pb' : 'bad' }, mv > 0 ? `▲${mv}` : `▼${-mv}`) : '')); })))),
      h('p', { class: 'foot-note' }, L('Yalnızca yarış sonuçları kullanılır; eski dönemlerdeki "en iyi N sonuç sayılır" kuralı ve en hızlı tur puanları hesaba katılmaz.', 'Only race results are used; historic dropped-scores rules and fastest-lap points are ignored.')));
  };
  const sysSel = h('select', { 'aria-label': L('Puan sistemi', 'Points system'), onChange: (e) => { sys = systems.find((x) => x.id === e.target.value); draw(); } }, systems.map((x) => h('option', { value: x.id }, x.label)));
  add(root, h('div', { class: 'filters' }, seasonSelect(years, year, (y) => { location.hash = `#simulator/puan/${y}`; }), sysSel,
    season.races.some((r) => r.spr?.length) ? h('label', { class: 'switch' }, h('input', { type: 'checkbox', checked: sprints, onChange: (e) => { sprints = e.target.checked; draw(); } }), L('Sprint puanlarını say (2010 sistemi)', 'Count sprint points (2010 system)')) : null),
  card(L(`${year} sezonu, başka kurallarla`, `${year} season, other rules`), out));
  draw();
}
