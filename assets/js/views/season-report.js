// Sezon karnesi: sampiyon, sayilar, liderler, takim ici duellolar ve her pilota karne notu
import { h, add, fmtPts } from '../core/util.js';
import { L, driverName, teamName, gpName, ordinalTr } from '../core/i18n.js';
import * as data from '../core/data.js';
import { teamColor } from '../core/colors.js';
import { vhead, card, dchip, tchip, footer, flag, spoilerActive } from '../core/ui.js';
import { barList, lineChart, chartCard } from '../core/charts.js';
import { teammateDuels } from '../core/hist.js';
import { seasonSelect, raceEndMs, raceHref } from './common.js';

const GRADE = (s) => (s >= 0.85 ? 'A+' : s >= 0.75 ? 'A' : s >= 0.65 ? 'B+' : s >= 0.55 ? 'B' : s >= 0.45 ? 'C+' : s >= 0.35 ? 'C' : 'D');

export async function render(root, ctx) {
  const { ref, meta, cur } = ctx;
  const year = Number(ctx.params[0]) || meta.currentSeason;
  const season = year === meta.currentSeason ? cur : await data.season(year);
  let races = season.races.filter((r) => r.res?.length);
  const lastR = races[races.length - 1];
  let hiddenNote = null;
  if (lastR && spoilerActive(data.raceKey(year, lastR.r), raceEndMs(lastR))) { races = races.slice(0, -1); hiddenNote = L('Spoiler kalkanı açık: son yarış karneye katılmadı.', 'Spoiler shield on: the latest race is left out.'); }
  const years = []; for (let y = meta.currentSeason; y >= meta.firstSeason; y--) years.push(y);
  const done = races.length === season.races.length;
  add(root, vhead({ title: L(`${year} sezon karnesi`, `${year} season report`),
    sub: done ? L(`${races.length} yarışın tamamı koşuldu.`, `All ${races.length} races run.`) : L(`${season.races.length} yarışın ${races.length} tanesinden sonraki ara karne.`, `Interim report after ${races.length} of ${season.races.length} races.`),
    actions: seasonSelect(years, year, (y) => { location.hash = `#karne/${y}`; }) }));
  if (hiddenNote) root.appendChild(h('p', { class: 'muted t-small' }, hiddenNote));
  if (!races.length) { root.appendChild(h('p', { class: 'muted' }, L('Bu sezonda henüz yarış yok.', 'No races yet this season.'))); return; }

  const upto = races[races.length - 1].r;
  const st = data.standingsAfter(season, upto);
  const D = new Map();
  const get = (d) => { if (!D.has(d)) D.set(d, { d, starts: 0, fin: 0, wins: 0, pods: 0, poles: 0, pf: 0, fl: 0, dnf: 0, gain: 0, best: 99 }); return D.get(d); };
  const winners = new Set(), poleSitters = new Set();
  let dnfTotal = 0;
  for (const r of races) {
    for (const x of r.res) {
      const o = get(x.d);
      if (x.p === 'DNS') continue;
      o.starts++;
      if (x.pn) { o.fin++; o.best = Math.min(o.best, x.pn); if (x.g) o.gain += x.g - x.pn; } else { o.dnf++; dnfTotal++; }
      if (x.pn === 1) { o.wins++; winners.add(x.d); }
      if (x.pn && x.pn <= 3) o.pods++;
      if (x.pole) { o.poles++; poleSitters.add(x.d); }
      if (x.pts) o.pf++;
      if (x.fl) o.fl++;
    }
    const pole = r.q?.[0]?.d;
    if (pole && !r.res.some((x) => x.pole)) { get(pole).poles++; poleSitters.add(pole); }
  }
  const champ = st.d[0];
  const decider = season.races.find((r) => r.decD);
  const tOf = (d) => data.teamOf(season, d, upto);

  // ust bolum
  const hero = h('section', { class: 'board', style: { gap: '10px' } }, h('div', { class: 'info' },
    h('div', { class: 'when' }, season.champion?.d && done ? L('Dünya şampiyonu', 'World champion') : L('Şampiyona lideri', 'Championship leader')),
    h('h2', { class: 't-display', style: { fontSize: 'clamp(2.4rem, 8vw, 4.4rem)', marginTop: '10px' } }, driverName(ref, champ[0])),
    h('div', { class: 'circ row wrap' }, flag(ref, ref.drivers[champ[0]]?.nat), teamName(ref, tOf(champ[0])), h('span', { class: 'dim' }, `${fmtPts(champ[2])} ${L('puan', 'pts')}`), st.d[1] ? h('span', { class: 'dim' }, L(`en yakın rakibi ${driverName(ref, st.d[1][0])}, ${fmtPts(champ[2] - st.d[1][2])} puan geride`, `${fmtPts(champ[2] - st.d[1][2])} pts clear of ${driverName(ref, st.d[1][0])}`)) : null),
    decider ? h('p', { class: 'circ' }, L('Şampiyonluk ', 'Title decided at the '), h('a', { href: raceHref(year, decider.r) }, gpName(ref, decider.gp)), L(' yarışında kesinleşti.', '.')) : null));
  const stats = h('div', { class: 'stats' },
    tile(races.length, L('yarış', 'races')), tile(winners.size, L('farklı kazanan', 'different winners')), tile(poleSitters.size, L('farklı pole', 'different pole-sitters')),
    tile(dnfTotal, L('bitirilemeyen yarış', 'retirements')), tile(races.filter((r) => r.spr?.length).length, 'sprint'));
  add(root, hero, stats);

  // liderler
  const list = [...D.values()];
  const top = (key, n = 6) => list.filter((o) => o[key] > 0).sort((a, b) => b[key] - a[key]).slice(0, n).map((o) => ({ label: driverName(ref, o.d), value: o[key], href: `#surucu/${o.d}`, color: teamColor(tOf(o.d)) }));
  const grid = h('div', { class: 'grid g3 mt' });
  grid.append(
    card(L('Galibiyet', 'Wins'), barList(top('wins'))), card(L('Pole', 'Poles'), barList(top('poles'))), card(L('Podyum', 'Podiums'), barList(top('pods'))),
    card(L('Puan alınan yarış', 'Points finishes'), barList(top('pf'))), card(L('Toplam kazanılan pozisyon', 'Positions gained'), barList(top('gain'))), card(L('Bitiremedi', 'Retirements'), barList(top('dnf'))));
  root.appendChild(grid);

  // karne notlari
  const duels = teammateDuels({ ...season, races });
  const mateIdx = new Map();
  for (const p of duels) {
    const n = p.qA + p.qB + p.rA + p.rB || 1;
    mateIdx.set(p.a, { v: (p.qA + p.rA) / n, txt: [p.qA, p.qB, p.rA, p.rB], mate: p.b });
    mateIdx.set(p.b, { v: (p.qB + p.rB) / n, txt: [p.qB, p.qA, p.rB, p.rA], mate: p.a });
  }
  const ranked = st.d.filter(([d]) => (D.get(d)?.starts || 0) >= Math.min(5, races.length));
  const nDrv = ranked.length;
  const rows = ranked.map(([d, pos, pts], i) => {
    const o = D.get(d) || get(d);
    const pPct = nDrv > 1 ? 1 - i / (nDrv - 1) : 1;
    const mt = mateIdx.get(d);
    const rel = o.starts ? o.fin / o.starts : 0;
    const peak = o.best === 1 ? 1 : o.best <= 3 ? 0.8 : o.best <= 5 ? 0.6 : o.best <= 10 ? 0.4 : 0.2;
    const score = 0.4 * pPct + 0.35 * (mt ? mt.v : 0.5) + 0.1 * rel + 0.15 * peak;
    let note;
    if (i === 0) note = L(`${o.wins} galibiyet, ${o.pods} podyum.`, `${o.wins} wins, ${o.pods} podiums.`);
    else if (mt && mt.v >= 0.7) note = L(`Takım arkadaşı ${driverName(ref, mt.mate, 'last')} karşısında sıralamada ${mt.txt[0]}–${mt.txt[1]}, yarışta ${mt.txt[2]}–${mt.txt[3]}.`, `Beat ${driverName(ref, mt.mate, 'last')} ${mt.txt[0]}–${mt.txt[1]} in qualifying, ${mt.txt[2]}–${mt.txt[3]} in races.`);
    else if (o.wins) note = L(`${o.wins} galibiyet, ${o.pods} podyum.`, `${o.wins} wins, ${o.pods} podiums.`);
    else if (rel < 0.75 && o.dnf >= 3) note = L(`${o.dnf} yarışı bitiremedi.`, `${o.dnf} retirements.`);
    else if (mt && mt.v <= 0.3) note = L(`Takım arkadaşının gerisinde kaldı (sıralamada ${mt.txt[0]}–${mt.txt[1]}).`, `Behind his teammate (${mt.txt[0]}–${mt.txt[1]} in qualifying).`);
    else note = L(`En iyi sonucu ${o.best < 99 ? o.best + '.' : '–'}, ${o.pf} yarışta puan aldı.`, `Best result ${o.best < 99 ? ordinalTr(o.best) : '–'}, points in ${o.pf} races.`);
    return { d, pos, pts, score, grade: GRADE(score), note };
  });
  const gradeColor = (g) => (g.startsWith('A') ? 'var(--pb)' : g.startsWith('B') ? 'var(--ink)' : g.startsWith('C') ? 'var(--norm)' : 'var(--bad)');
  root.appendChild(h('div', { class: 'mt' }, card(L('Karne notları', 'Report card grades'), h('div', {},
    h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl' },
      h('thead', {}, h('tr', {}, h('th', { class: 'n' }, L('Sıra', 'Pos')), h('th', {}, L('Pilot', 'Driver')), h('th', { class: 'n' }, L('Puan', 'Pts')), h('th', { class: 'n' }, L('Not', 'Grade')), h('th', { class: 'hide-sm' }, L('Neden', 'Why')))),
      h('tbody', {}, rows.map((x) => h('tr', {}, h('td', { class: 'p' }, x.pos), h('td', {}, dchip(ref, x.d, { t: tOf(x.d) })), h('td', { class: 'n' }, fmtPts(x.pts)),
        h('td', { class: 'n' }, h('span', { class: 'cond strong', style: { fontSize: '1.25rem', color: gradeColor(x.grade) } }, x.grade)), h('td', { class: 'hide-sm muted t-small' }, x.note)))))),
    h('p', { class: 'foot-note' }, L('Not; şampiyonadaki sıra (%40), takım arkadaşına karşı sıralama ve yarış sonuçları (%35), en iyi sonuç (%15) ve yarış bitirme oranından (%10) hesaplanır. Eğlencelik bir ölçüdür.', 'Grades weigh championship rank (40%), head-to-head against the teammate (35%), best result (15%) and finishing rate (10%). Just for fun.'))))));

  // takim ici
  if (duels.length) root.appendChild(h('div', { class: 'mt' }, card(L('Takım içi düellolar', 'Teammate battles'), h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl compact' },
    h('thead', {}, h('tr', {}, h('th', {}, L('Takım', 'Team')), h('th', {}, L('Pilotlar', 'Drivers')), h('th', { class: 'n' }, L('Sıralama', 'Quali')), h('th', { class: 'n' }, L('Yarış', 'Race')), h('th', { class: 'n' }, L('Puan', 'Points')))),
    h('tbody', {}, duels.map((p) => h('tr', {}, h('td', {}, tchip(ref, p.t)), h('td', { class: 't-small' }, `${driverName(ref, p.a, 'last')} – ${driverName(ref, p.b, 'last')}`), h('td', { class: 'n' }, `${p.qA}–${p.qB}`), h('td', { class: 'n' }, `${p.rA}–${p.rB}`), h('td', { class: 'n' }, `${fmtPts(p.pA)}–${fmtPts(p.pB)}`)))))))));

  // ilk 5'in puan yarisi
  if (races.length > 2) {
    const prog = data.pointsProgression({ ...season, races }, 'd');
    const ids = st.d.slice(0, 5).map((x) => x[0]);
    const seen = new Map();
    const series = ids.map((id) => { const t = tOf(id); const n = seen.get(t) || 0; seen.set(t, n + 1); return { id, label: driverName(ref, id, 'code'), color: teamColor(t), dash: n > 0, values: prog.rows.find((r) => r.id === id)?.pts || [] }; });
    root.appendChild(h('div', { class: 'mt' }, chartCard(L('İlk beşin puan yarışı', 'Top five points race'), lineChart({ series, labels: prog.races.map((r) => r.r), height: 300, yFmt: fmtPts, xFmt: (l, i, axis) => (axis ? l : gpName(ref, prog.races[i].gp)) }),
      () => h('table', { class: 'tbl compact' }, h('tbody', {}, series.map((s) => h('tr', {}, h('td', { class: 'strong' }, s.label), s.values.map((v) => h('td', { class: 'n' }, v == null ? '–' : fmtPts(v))))))))));
  }
  add(root, footer(meta));
}

const tile = (v, k) => h('div', { class: 'stat' }, h('div', { class: 'v' }, String(v)), h('div', { class: 'k' }, k));
