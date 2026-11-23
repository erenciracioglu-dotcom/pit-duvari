// Puan durumu: pilotlar / takimlar, tur tur grafik, sampiyonluk matematigi
import { h, clear, fmtPts, add } from '../core/util.js';
import { L, driverName, teamName, gpName, ordinalTr } from '../core/i18n.js';
import * as data from '../core/data.js';
import { teamColor } from '../core/colors.js';
import { vhead, seg, dchip, tchip, card, spoilerActive, footer, icon } from '../core/ui.js';
import { lineChart, chartCard } from '../core/charts.js';
import { raceEndMs, seasonSelect } from './common.js';

const RACE_MAX = 25, SPRINT_MAX = 8;

export async function render(root, ctx) {
  const { ref, meta, profile } = ctx;
  const year = Number(ctx.params[0]) || meta.currentSeason;
  const kind = ctx.params[1] === 'takimlar' ? 'c' : 'd';
  const season = year === meta.currentSeason ? ctx.cur : await data.season(year);
  const done = season.races.filter((r) => r.res?.length);
  let upto = done.length ? done[done.length - 1].r : 0;
  let note = null;
  const lastR = done[done.length - 1];
  if (lastR && spoilerActive(data.raceKey(year, lastR.r), raceEndMs(lastR))) {
    upto = done.length > 1 ? done[done.length - 2].r : 0;
    note = h('div', { class: 'row wrap muted t-small', style: { gap: '8px', marginBottom: '12px' } }, icon('eyeOff'),
      L(`Spoiler kalkanı açık: ${gpName(ref, lastR.gp)} öncesindeki tablo gösteriliyor.`, `Spoiler shield on: showing the table before the ${gpName(ref, lastR.gp)}.`),
      h('a', { href: `#yaris/${year}/${lastR.r}` }, L('Sonucu aç', 'Reveal result')));
  }
  const st = upto ? data.standingsAfter(season, upto) : { d: season.final?.d || [], c: season.final?.c || [] };
  const prevRace = done.filter((r) => r.r < upto).pop();
  const prevSt = prevRace ? data.standingsAfter(season, prevRace.r) : null;
  const years = []; for (let y = meta.currentSeason; y >= meta.firstSeason; y--) years.push(y);

  add(root, vhead({
    title: L(`${year} puan durumu`, `${year} standings`),
    sub: done.length ? L(`${done.length} yarıştan sonra${season.champion?.d && done.length === season.races.length ? '; sezon tamamlandı.' : '.'}`, `After ${done.length} races${season.champion?.d && done.length === season.races.length ? '; season complete.' : '.'}`) : L('Sezon henüz başlamadı.', 'The season has not started.'),
    actions: [seg([{ value: 'd', label: L('Pilotlar', 'Drivers') }, { value: 'c', label: L('Takımlar', 'Constructors') }], kind, (v) => { location.hash = `#puan/${year}${v === 'c' ? '/takimlar' : ''}`; }),
      seasonSelect(years, year, (y) => { location.hash = `#puan/${y}${kind === 'c' ? '/takimlar' : ''}`; })]
  }));
  if (note) root.appendChild(note);

  const list = kind === 'd' ? st.d : st.c;
  const lead = list[0]?.[2] || 0;
  const prevPos = new Map((prevSt?.[kind] || []).map(([id, p]) => [id, p]));
  const champ = kind === 'd' ? season.champion?.d : season.champion?.c;
  const wins = new Map(), pods = new Map(), poles = new Map();
  for (const r of done.filter((r) => r.r <= upto)) {
    for (const x of r.res || []) {
      const k = kind === 'd' ? x.d : x.t;
      if (x.pn === 1) wins.set(k, (wins.get(k) || 0) + 1);
      if (x.pn && x.pn <= 3) pods.set(k, (pods.get(k) || 0) + 1);
      if (x.pole) poles.set(k, (poles.get(k) || 0) + 1);
    }
  }
  const favD = new Set(profile.favDrivers);
  const table = h('table', { class: 'tbl' },
    h('thead', {}, h('tr', {}, h('th', { class: 'n' }, L('Sıra', 'Pos')), h('th', {}, kind === 'd' ? L('Pilot', 'Driver') : L('Takım', 'Team')), kind === 'd' ? h('th', { class: 'hide-sm' }, L('Takım', 'Team')) : null,
      h('th', { class: 'n' }, L('Puan', 'Pts')), h('th', { class: 'n' }, L('Fark', 'Gap')), h('th', { class: 'n' }, L('Gal.', 'Wins')), h('th', { class: 'n hide-sm' }, L('Podyum', 'Pod.')), h('th', { class: 'n hide-sm' }, 'Pole'), h('th', { class: 'n' }, ''))),
    h('tbody', {}, list.map(([id, pos, pts]) => {
      const t = kind === 'd' ? data.teamOf(season, id, upto) : id;
      const pp = prevPos.get(id);
      const mv = pp && pos ? pp - pos : 0;
      const fav = kind === 'd' ? favD.has(id) : profile.favTeam === id;
      return h('tr', { class: fav ? 'fav' : null },
        h('td', { class: 'p' }, pos || '–'),
        h('td', {}, kind === 'd' ? dchip(ref, id, { t, flagOn: true }) : tchip(ref, id), champ === id ? h('span', { class: 'badge acc', style: { marginLeft: '8px' } }, L('Şampiyon', 'Champion')) : null),
        kind === 'd' ? h('td', { class: 'hide-sm muted' }, teamName(ref, t)) : null,
        h('td', { class: 'n strong' }, fmtPts(pts)),
        h('td', { class: 'n muted' }, pos === 1 ? '' : `−${fmtPts(lead - pts)}`),
        h('td', { class: 'n' }, wins.get(id) || ''),
        h('td', { class: 'n hide-sm' }, pods.get(id) || ''),
        h('td', { class: 'n hide-sm' }, poles.get(id) || ''),
        h('td', { class: 'n' }, mv ? h('span', { class: mv > 0 ? 'pb' : 'bad' }, mv > 0 ? `▲${mv}` : `▼${-mv}`) : ''));
    })));
  root.appendChild(h('section', { class: 'card flush' }, h('div', { class: 'tbl-wrap' }, table)));

  // ilerleme grafigi
  if (done.length > 1) {
    const prog = data.pointsProgression({ ...season, races: season.races.filter((r) => r.r <= upto) }, kind);
    const ids = list.slice(0, kind === 'd' ? 10 : 11).map((x) => x[0]);
    const teamSeen = new Map();
    const series = ids.map((id) => {
      const row = prog.rows.find((r) => r.id === id);
      const t = kind === 'd' ? data.teamOf(season, id, upto) : id;
      const n = teamSeen.get(t) || 0; teamSeen.set(t, n + 1);
      return { id, label: kind === 'd' ? driverName(ref, id, 'code') : teamName(ref, id), short: kind === 'd' ? driverName(ref, id, 'code') : teamName(ref, id), color: teamColor(t), dash: kind === 'd' && n > 0, values: row ? row.pts : [] };
    });
    const labels = prog.races.map((r) => r.r);
    const hi = kind === 'd' ? profile.favDrivers.filter((d) => ids.includes(d)) : (profile.favTeam && ids.includes(profile.favTeam) ? [profile.favTeam] : []);
    const chart = lineChart({ series, labels, height: 340, yFmt: (v) => fmtPts(v), xFmt: (l, i, axis) => (axis ? l : gpName(ref, prog.races[i].gp)), tipValue: (sr, v) => `${fmtPts(v)} ${L('puan', 'pts')}`, highlight: hi, ariaLabel: L('Puan ilerlemesi', 'Points progression') });
    root.appendChild(h('div', { class: 'mt' }, chartCard(L('Sezon boyunca puanlar', 'Points through the season'), chart, () => progTable(ref, prog, ids, kind, season))));
  }

  // matematik
  const remaining = season.races.filter((r) => r.r > upto);
  if (remaining.length && list.length > 1 && !season.provisional) root.appendChild(h('div', { class: 'mt' }, mathCard(ctx, season, list, remaining, kind)));
  root.appendChild(footer(meta));
}

function progTable(ref, prog, ids, kind, season) {
  return h('table', { class: 'tbl compact' },
    h('thead', {}, h('tr', {}, h('th', { class: 'sticky' }, ''), prog.races.map((r) => h('th', { class: 'n' }, r.r)))),
    h('tbody', {}, ids.map((id) => { const row = prog.rows.find((r) => r.id === id); return h('tr', {}, h('td', { class: 'sticky strong' }, kind === 'd' ? driverName(ref, id, 'code') : teamName(ref, id)), (row?.pts || []).map((v) => h('td', { class: 'n' }, v == null ? '–' : fmtPts(v)))); })));
  void season;
}

function mathCard(ctx, season, list, remaining, kind) {
  const { ref } = ctx;
  const sprints = remaining.filter((r) => r.sprint).length;
  const perDriver = remaining.length * RACE_MAX + sprints * SPRINT_MAX;
  const perTeam = remaining.length * (RACE_MAX + 18) + sprints * (SPRINT_MAX + 7);
  const max = kind === 'd' ? perDriver : perTeam;
  const lead = list[0][2];
  const decided = season.champion?.[kind] || null;
  const rows = list.slice(0, 8).map(([id, pos, pts]) => {
    const gap = lead - pts;
    const alive = pos === 1 || gap <= max;
    let txt;
    if (decided === id) txt = L('Şampiyonluğu garantiledi.', 'Title secured.');
    else if (pos === 1) txt = L(`Önde; en yakın rakibinden ${fmtPts(lead - list[1][2])} puan fazla.`, `Leads by ${fmtPts(lead - list[1][2])} pts.`);
    else if (!alive) txt = L(`Elendi: ${fmtPts(gap)} puan geride, kalan en fazla ${max} puan.`, `Out: ${fmtPts(gap)} pts behind, ${max} pts left.`);
    else txt = L(`${fmtPts(gap)} puan geride; ${Math.ceil(gap / RACE_MAX * 10) / 10} yarış galibiyeti farkı.`, `${fmtPts(gap)} pts behind; ${Math.ceil(gap / RACE_MAX * 10) / 10} race wins' worth.`);
    return h('div', { class: 'li' },
      h('span', { class: 'cond strong', style: { width: '24px', fontSize: '1.15rem' } }, pos),
      kind === 'd' ? dchip(ref, id, { t: data.teamOf(season, id) }) : tchip(ref, id),
      h('span', { class: 'sp' }),
      h('span', { class: ['t-small', alive ? '' : 'dim'], style: { textAlign: 'right', maxWidth: '58%' } }, txt));
  });
  return card(L('Şampiyonluk matematiği', 'Title maths'), h('div', {},
    h('p', { class: 'muted', style: { marginTop: 0 } }, L(`Kalan ${remaining.length} yarış${sprints ? ` ve ${sprints} sprint` : ''}: bir ${kind === 'd' ? 'pilot' : 'takım'} en fazla ${max} puan daha toplayabilir.`, `${remaining.length} races${sprints ? ` and ${sprints} sprints` : ''} left: up to ${max} more points per ${kind === 'd' ? 'driver' : 'team'}.`)),
    h('div', { class: 'list' }, rows),
    h('div', { class: 'mt' }, h('a', { class: 'btn sm', href: '#simulator' }, icon('sliders'), L('Kalan yarışları sen bitir', 'Finish the remaining races yourself')))));
}
void clear; void ordinalTr;
