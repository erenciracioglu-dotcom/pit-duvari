// Rekorlar: tum zamanlarin pilot ve takim listeleri
import { h, add, fmtPts } from '../core/util.js';
import { L, driverName, teamName, gpName, nf } from '../core/i18n.js';
import * as data from '../core/data.js';
import { teamColor } from '../core/colors.js';
import { vhead, card, footer, tabs, empty } from '../core/ui.js';
import { barList } from '../core/charts.js';
import { loadAll, ageText } from '../core/hist.js';

export async function render(root, ctx) {
  const { ref, meta } = ctx;
  const kind = ctx.params[0] === 'takimlar' ? 't' : 'd';
  let rec, all;
  try { [rec, all] = await Promise.all([data.records(), loadAll()]); } catch { add(root, vhead({ title: L('Rekorlar', 'Records') }), empty(L('Rekor listesi yüklenemedi', 'Records could not be loaded'))); return; }
  const raceById = new Map(all.races.map((r, i) => [r[0], i]));
  const raceTxt = (id) => { const r = all.races[raceById.get(id)]; return r ? `${r[1]} ${gpName(ref, all.gp[r[4]])}` : ''; };
  const lastTeamOf = (d) => { const di = all.dIdx.get(d); const rows = all.byDriver.get(di) || []; return rows.length ? all.te[rows[rows.length - 1][2]] : null; };
  const dItem = (id, value, sub) => ({ label: driverName(ref, id), value, sub, href: `#surucu/${id}`, color: teamColor(lastTeamOf(id)) });
  const tItem = (id, value, sub) => ({ label: teamName(ref, id), value, sub, href: `#takim/${id}`, color: teamColor(id) });
  add(root, vhead({ title: L('Rekorlar', 'Records'), sub: L(`1950’den ${meta.currentSeason}’ya Formula 1 dünya şampiyonasının rekorları. Son F1DB güncellemesine göre.`, `Formula 1 world championship records from 1950 to ${meta.currentSeason}, as of the latest F1DB update.`) }),
    tabs([{ key: 'd', label: L('Pilotlar', 'Drivers'), href: '#rekorlar' }, { key: 't', label: L('Takımlar', 'Constructors'), href: '#rekorlar/takimlar' }], kind));
  const grid = h('div', { class: 'grid g3' });
  const box = (title, items, opt) => card(title, items.length ? barList(items, opt) : h('p', { class: 'muted' }, '–'));
  if (kind === 'd') {
    const D = rec.d;
    grid.append(
      box(L('Dünya şampiyonluğu', 'World titles'), D.titles.slice(0, 10).map(([id, v]) => dItem(id, v))),
      box(L('Galibiyet', 'Wins'), D.wins.slice(0, 10).map(([id, v]) => dItem(id, v))),
      box('Pole', D.poles.slice(0, 10).map(([id, v]) => dItem(id, v))),
      box(L('Podyum', 'Podiums'), D.podiums.slice(0, 10).map(([id, v]) => dItem(id, v))),
      box(L('En hızlı tur', 'Fastest laps'), D.fastestLaps.slice(0, 10).map(([id, v]) => dItem(id, v))),
      box(L('Start sayısı', 'Starts'), D.starts.slice(0, 10).map(([id, v]) => dItem(id, v))),
      box(L('Toplam puan', 'Career points'), D.points.slice(0, 10).map(([id, v]) => dItem(id, v)), { fmt: fmtPts }),
      box(L('Galibiyet oranı (en az 40 start)', 'Win rate (40+ starts)'), D.winRate.slice(0, 10).map(([id, v, w, s]) => dItem(id, v, L(`${w} galibiyet / ${s} yarış`, `${w} wins / ${s} starts`))), { fmt: (v) => `%${nf(v, 1)}` }),
      box(L('Bir sezonda en çok galibiyet', 'Most wins in a season'), D.seasonWins.slice(0, 10).map(([id, y, v, n]) => dItem(id, v, L(`${y}, ${n} yarışta`, `${y}, of ${n} races`)))),
      box(L('Bir sezonda en çok pole', 'Most poles in a season'), D.seasonPoles.slice(0, 10).map(([id, y, v, n]) => dItem(id, v, L(`${y}, ${n} yarışta`, `${y}, of ${n} races`)))),
      box(L('Üst üste galibiyet', 'Consecutive wins'), D.winStreak.slice(0, 10).map(([id, n, from, to]) => dItem(id, n, `${raceTxt(from)} – ${raceTxt(to)}`))),
      box(L('Bir pistte en çok galibiyet', 'Most wins at one circuit'), D.circuitWins.slice(0, 10).map(([id, c, v]) => dItem(id, v, ref.circuits[c]?.fn || c))),
      box(L('Grand slam (pole, galibiyet, en hızlı tur, hep önde)', 'Grand slams'), D.grandSlams.slice(0, 10).map(([id, v]) => dItem(id, v))),
      card(L('En genç kazananlar', 'Youngest winners'), ageList(ref, D.youngestWinner, raceTxt)),
      card(L('En yaşlı kazananlar', 'Oldest winners'), ageList(ref, D.oldestWinner, raceTxt)),
      card(L('En genç ilk start', 'Youngest debutants'), ageList(ref, D.youngestStarter, raceTxt)));
  } else {
    const T = rec.t;
    grid.append(
      box(L('Takımlar şampiyonluğu', 'Constructors’ titles'), T.titles.slice(0, 10).map(([id, v]) => tItem(id, v))),
      box(L('Galibiyet', 'Wins'), T.wins.slice(0, 10).map(([id, v]) => tItem(id, v))),
      box('Pole', T.poles.slice(0, 10).map(([id, v]) => tItem(id, v))),
      box(L('Podyum', 'Podiums'), T.podiums.slice(0, 10).map(([id, v]) => tItem(id, v))),
      box(L('1-2 bitiriş', '1-2 finishes'), T.oneTwos.slice(0, 10).map(([id, v]) => tItem(id, v))),
      box(L('Yarış sayısı', 'Races entered'), T.starts.slice(0, 10).map(([id, v]) => tItem(id, v))),
      box(L('Bir sezonda en çok galibiyet', 'Most wins in a season'), T.seasonWins.slice(0, 10).map(([id, y, v, n]) => tItem(id, v, L(`${y}, ${n} yarışta`, `${y}, of ${n} races`)))));
  }
  add(root, grid, footer(meta));
}

function ageList(ref, rows, raceTxt) {
  return h('div', { class: 'list' }, rows.slice(0, 8).map(([id, days, raceId], i) => h('a', { class: 'li', href: `#surucu/${id}` },
    h('span', { class: 'dim num', style: { width: '22px', textAlign: 'right' } }, i + 1),
    h('div', { style: { minWidth: 0 } }, h('div', { class: 'li-t ellip' }, driverName(ref, id)), h('div', { class: 'li-s ellip' }, raceTxt(raceId))),
    h('span', { class: 'r strong num t-small' }, ageText(days, L)))));
}
