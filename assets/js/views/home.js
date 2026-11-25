// Ana sayfa: pit tahtasi geri sayimi, son yaris, sampiyona, favori takim, haberler
import { h, fmtPts, isTimed } from '../core/util.js';
import { L, gpName, sessionLabel, fmtTime, fmtDay, fmtRange, driverName, teamName, tzLabel, ordinalTr } from '../core/i18n.js';
import * as data from '../core/data.js';
import { teamColor } from '../core/colors.js';
import { card, countdown, dchip, tchip, icon, spoiler, spoilerActive, seg, footer, onCleanup } from '../core/ui.js';
import { raceHref, raceEndMs, resultValue, trackSvg, sessionList, circuitLine, icsModal } from './common.js';
import { newsItem, spoilerCut } from './news.js';

export async function render(root, ctx) {
  const { ref, meta, seasons, cur, profile } = ctx;
  const now = Date.now();
  const geo = await data.geo().catch(() => ({}));
  const ne = data.nextEvent(seasons, now);
  const last = data.lastRace(seasons);
  const tyres = await fetch(new URL('../../tyres.json', import.meta.url), { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : {})).catch(() => ({}));

  root.appendChild(board(ctx, ne, geo, now, tyres));
  root.appendChild(kpiStrip(ctx, last, now));

  const grid = h('div', { class: 'grid g-7-5' });
  root.appendChild(grid);
  const leftCol = h('div', { class: 'stack' });
  const rightCol = h('div', { class: 'stack' });
  grid.append(leftCol, rightCol);

  if (last) leftCol.appendChild(lastRaceCard(ctx, last));
  if (profile.favTeam || profile.favDrivers.length) leftCol.appendChild(favCard(ctx, last));
  else leftCol.appendChild(card(L('Takımını seç', 'Pick your team'), h('div', {},
    h('p', { class: 'muted', style: { marginTop: 0 } }, L('Favori takımını ve pilotunu seçersen bu sayfa, renkler ve haber sırası onlara göre düzenlenir.', 'Choose a favourite team and driver to tailor this page, the colours and the news order.')),
    h('a', { class: 'btn pri', href: '#profil' }, icon('star'), L('Favorileri seç', 'Choose favourites')))));
  rightCol.appendChild(champCard(ctx, last));
  rightCol.appendChild(toolsCard(ctx, ne));

  // haberler
  try {
    const nw = await data.news();
    const items = rankNews(nw.items, profile).slice(0, 6);
    if (items.length) {
      const cut = spoilerCut(seasons);
      root.appendChild(h('section', { class: 'mt-l' },
        h('div', { class: 'card-h' }, h('h2', { class: 't-h2' }, L('Son haberler', 'Latest news')), h('span', { class: 'sp' }), h('a', { class: 'btn ghost sm', href: '#haberler' }, L('Tüm haberler', 'All news'))),
        h('div', { class: 'nstrip' }, items.map((it) => newsItem(it, nw.sources, ref, profile, cut, { eager: true })))));
    }
  } catch { /* haber yoksa bolum gizli */ }

  root.appendChild(footer(meta));
}

function board(ctx, ne, geo, now, tyres = {}) {
  const { ref, seasons } = ctx;
  if (!ne) {
    const champ = seasons[0]?.champion;
    return h('section', { class: 'board' }, h('div', { class: 'info' },
      h('div', { class: 'when' }, L('Sezon bitti', 'Season over')),
      h('h1', { class: 't-display gp' }, champ?.d ? driverName(ref, champ.d) : L('Kış arası', 'Winter break')),
      h('p', { class: 'circ' }, L('Yeni sezonun takvimi açıklanınca geri sayım burada başlayacak.', 'The countdown starts here once the new calendar is out.'))));
  }
  const { race, session, live, season } = ne;
  const g = geo[race.c];
  const total = season.races.length;
  const target = session.start;
  const sessName = sessionLabel(session.k);
  const when = h('div', { class: 'when' },
    live ? h('span', { class: 'pill strong' }, h('span', { class: 'live-dot' }), L(`${sessName} sürüyor`, `${sessName} is live`))
      : h('span', { class: 'pill strong' }, L(`Sıradaki: ${sessName}`, `Next: ${sessName}`)),
    h('span', {}, session.timed ? `${fmtDay(session.start)} ${fmtTime(session.start)}` : `${fmtDay(session.iso)}, ${L('saat açıklanmadı', 'time TBC')}`),
    session.timed ? h('span', { class: 'dim' }, tzLabel()) : null);
  const raceWhen = race.s?.r && race.s.r !== session.iso
    ? h('span', { class: 'dim' }, L('Yarış: ', 'Race: '), isTimed(race.s.r) ? `${fmtDay(race.s.r)} ${fmtTime(race.s.r)}` : fmtDay(race.s.r)) : null;
  const info = h('div', { class: 'info' },
    when,
    h('h1', { class: 't-display gp', style: { marginTop: '14px' } }, gpName(ref, race.gp)),
    h('div', { class: 'circ row wrap' }, circuitLine(ref, race), h('span', { class: 'dim' }, L(`${season.year} sezonu, ${race.r}. yarış (${total} yarışın)`, `${season.year}, round ${race.r} of ${total}`)), race.sprint ? h('span', { class: 'badge' }, 'Sprint') : null),
    raceWhen ? h('div', { class: 'circ' }, raceWhen) : null);
  const kids = [trackSvg(g, 'track', { glow: true, car: true }), info];
  const tset = tyres[data.raceKey(season.year, race.r)];
  if (tset?.length) info.appendChild(tyreRow(tset));
  if (!live) kids.push(countdown(target, { onDone: () => window.dispatchEvent(new Event('pd:rerender')) }));
  else kids.push(h('div', { class: 'row wrap', style: { position: 'relative', zIndex: 1 } },
    h('p', { class: 'muted', style: { margin: 0, maxWidth: '52ch' } }, L('Sonuçlar seans bittikten yaklaşık yarım saat sonra burada ve yarış sayfasında görünür.', 'Results appear here and on the race page about half an hour after the session ends.'))));
  kids.push(h('div', { class: 'sessions' }, sessionList(race, now)));
  kids.push(h('div', { class: 'row wrap', style: { position: 'relative', zIndex: 1 } },
    h('a', { class: 'btn pri', href: raceHref(season.year, race.r) }, L('Yarış haftası', 'Race weekend')),
    h('a', { class: 'btn', href: `#tahmin` }, icon('target'), L('Tahmin yap', 'Make a prediction')),
    h('button', { class: 'btn ghost', type: 'button', onClick: icsModal }, icon('cal'), L('Takvime ekle', 'Add to calendar'))));
  const b = h('section', { class: 'board', 'aria-label': L('Sıradaki seans', 'Next session') }, kids);
  // canli seans bitince yenile
  if (live) { const t = setTimeout(() => window.dispatchEvent(new Event('pd:rerender')), Math.max(5000, session.end - now + 1000)); onCleanup(() => clearTimeout(t)); }
  return b;
}

// ---- Pirelli lastik secimi (assets/tyres.json) ----
function tyreRow(set) {
  const roles = [['hard', L('Sert', 'Hard')], ['medium', L('Orta', 'Medium')], ['soft', L('Yumuşak', 'Soft')]];
  return h('div', { class: 'tyres', title: L('Pirelli’nin bu yarış için seçtiği lastikler', 'Pirelli’s compound choice for this race') },
    h('span', { class: 'dim' }, L('Lastikler', 'Tyres')),
    set.slice(0, 3).map((c, i) => h('span', { class: ['tchip-t', roles[i][0]] }, h('i'), h('b', {}, c), ' ', roles[i][1])));
}

// ---- ozet kartlari: lider, takimlar, son kazanan, Istanbul ----
function kpiStrip(ctx, last, now) {
  const { ref, seasons } = ctx;
  const { season, st, hidden } = visibleStandings(ctx, last);
  const cards = [];
  const kpi = (href, label, big, sub, color) => h('a', { class: 'kpi', href, style: color ? { '--k': color } : null },
    h('span', { class: 'k-l' }, label), h('span', { class: 'k-v' }, big), sub ? h('span', { class: 'k-s' }, sub) : null);

  const [d1, d2] = st.d;
  if (d1) {
    const t = data.teamOf(season, d1[0]);
    const champ = season.champion?.d === d1[0];
    cards.push(kpi(`#surucu/${d1[0]}`, champ ? L(`${season.year} şampiyonu`, `${season.year} champion`) : L('Pilotlarda lider', 'Drivers’ leader'),
      driverName(ref, d1[0]), d2 ? L(`${fmtPts(d1[2])} puan, ${driverName(ref, d2[0], 'last')} ${fmtPts(d1[2] - d2[2])} geride`, `${fmtPts(d1[2])} pts, ${fmtPts(d1[2] - d2[2])} clear of ${driverName(ref, d2[0], 'last')}`) : `${fmtPts(d1[2])} ${L('puan', 'pts')}`, teamColor(t)));
  }
  const [c1, c2] = st.c;
  if (c1) cards.push(kpi(`#takim/${c1[0]}`, L('Takımlarda lider', 'Constructors’ leader'), teamName(ref, c1[0]),
    c2 ? L(`${fmtPts(c1[2])} puan, ${teamName(ref, c2[0])} ${fmtPts(c1[2] - c2[2])} geride`, `${fmtPts(c1[2])} pts, ${fmtPts(c1[2] - c2[2])} ahead of ${teamName(ref, c2[0])}`) : null, teamColor(c1[0])));

  if (last) {
    const { race, season: ls } = last;
    const w = race.res?.[0];
    const href = raceHref(ls.year, race.r);
    if (hidden || !w) cards.push(kpi(href, L(`Son yarış: ${gpName(ref, race.gp)}`, `Last race: ${gpName(ref, race.gp)}`), L('Gizli', 'Hidden'), L('Spoiler kalkanı açık', 'Spoiler shield is on')));
    else {
      const pod = race.res.slice(1, 3).map((x) => driverName(ref, x.d, 'last')).join(', ');
      cards.push(kpi(href, L(`Son yarış: ${gpName(ref, race.gp)}`, `Last race: ${gpName(ref, race.gp)}`), driverName(ref, w.d), pod ? L(`Podyum: ${pod}`, `Podium: ${pod}`) : null, teamColor(w.t)));
    }
  }

  // Istanbul Park: takvimde varsa geri sayim
  for (const S of seasons) {
    const tr = S?.races.find((r) => r.gp === 'turkey' && !r.res?.length);
    if (!tr) continue;
    const start = Date.parse((tr.start || tr.date) + 'T00:00:00Z');
    const days = Math.ceil((start - now) / 86400000);
    if (days > 0) cards.push(kpi(raceHref(S.year, tr.r), L('İstanbul Park dönüyor', 'Istanbul Park returns'),
      L(`${days} gün`, `${days} days`), L(`${S.year} Türkiye GP, ${fmtRange(tr.start, tr.date)}`, `${S.year} Turkish GP, ${fmtRange(tr.start, tr.date)}`), '#E30A17'));
    break;
  }
  return h('section', { class: 'kpis', 'aria-label': L('Özet', 'Summary') }, cards);
}

function lastRaceCard(ctx, last) {
  const { ref } = ctx;
  const { race, season } = last;
  const key = data.raceKey(season.year, race.r);
  const end = raceEndMs(race);
  const fav = new Set(ctx.profile.favDrivers);
  const rows = race.res.slice(0, 10).map((x) => h('a', { class: ['tw', fav.has(x.d) && 'fav'], href: `#surucu/${x.d}` },
    h('span', { class: 'pos' }, x.pn ?? x.p),
    h('span', { class: 'bar', style: { background: teamColor(x.t) } }),
    h('span', { class: 'who' }, h('span', { class: 'code' }, driverName(ref, x.d, 'code')), h('span', { class: 'nm ellip' }, driverName(ref, x.d))),
    h('span', { class: 'val' }, resultValue(x))));
  const extras = h('div', { class: 'row wrap t-small muted', style: { padding: '10px 14px 14px', gap: '6px 16px' } },
    race.fl ? h('span', {}, h('span', { class: 'badge best' }, L('En hızlı tur', 'Fastest lap')), ' ', driverName(ref, race.fl.d), ' ', h('span', { class: 'num' }, race.fl.tm)) : null,
    race.dotd?.[0] ? h('span', {}, h('span', { class: 'badge' }, L('Günün pilotu', 'Driver of the day')), ' ', driverName(ref, race.dotd[0].d)) : null,
    race.src === 'openf1' ? h('span', { class: 'dim' }, L('Ön sonuç (OpenF1); resmi tablo birkaç saat içinde gelir.', 'Provisional (OpenF1); official table follows within hours.')) : null);
  const body = h('div', {}, h('div', { class: 'tower' }, rows), extras);
  const hasStory = ctx.meta.stories?.includes(key);
  return card(L(`Son yarış: ${gpName(ref, race.gp)}`, `Last race: ${gpName(ref, race.gp)}`), spoiler(key, end, body), {
    flush: true,
    actions: hasStory ? h('a', { class: 'btn sm ghost', href: raceHref(season.year, race.r, 'hikaye') }, icon('pulse'), L('Yarışın hikâyesi', 'Race story')) : null,
    more: { href: raceHref(season.year, race.r), label: L('Tam sonuç', 'Full result') }
  });
}

// Spoiler kalkani aciksa son yaristan onceki tablo
function visibleStandings(ctx, last) {
  const season = last?.season || ctx.cur;
  if (last && spoilerActive(data.raceKey(last.season.year, last.race.r), raceEndMs(last.race))) {
    const prev = last.season.races.filter((r) => r.res?.length && r.r < last.race.r).pop();
    return { season, st: prev ? data.standingsAfter(last.season, prev.r) : { d: [], c: [] }, upto: prev ? prev.r : 0, hidden: true };
  }
  return { season, st: data.latestStandings(season), upto: Infinity, hidden: false };
}

function champCard(ctx, last) {
  const { ref, profile } = ctx;
  const { season, st, hidden } = visibleStandings(ctx, last);
  const note = hidden ? L('Spoiler kalkanı açık: son yarıştan önceki tablo gösteriliyor.', 'Spoiler shield on: showing the table before the last race.') : null;
  const box = h('div', {});
  const render = (kind) => {
    box.innerHTML = '';
    const list = (kind === 'd' ? st.d : st.c).slice(0, 10);
    const lead = list[0]?.[2] || 0;
    const favD = new Set(profile.favDrivers);
    box.appendChild(h('div', { class: 'tower' }, list.map(([id, pos, pts]) => {
      const t = kind === 'd' ? data.teamOf(season, id) : id;
      const fav = kind === 'd' ? favD.has(id) : profile.favTeam === id;
      return h('a', { class: ['tw', fav && 'fav'], href: kind === 'd' ? `#surucu/${id}` : `#takim/${id}` },
        h('span', { class: 'pos' }, pos),
        h('span', { class: 'bar', style: { background: teamColor(t) } }),
        h('span', { class: 'who' }, kind === 'd' ? [h('span', { class: 'code' }, driverName(ref, id, 'code')), h('span', { class: 'nm ellip' }, driverName(ref, id, 'last'))] : h('span', { class: 'nm ellip', style: { color: 'var(--ink)', fontWeight: 650 } }, teamName(ref, id))),
        h('span', { class: 'val' }, h('strong', {}, fmtPts(pts)), ' ', h('span', { class: 'dim' }, pos === 1 ? L('puan', 'pts') : `−${fmtPts(lead - pts)}`)));
    })));
    if (note) box.appendChild(h('p', { class: 'foot-note', style: { padding: '0 14px 12px' } }, note));
  };
  render('d');
  const title = season.champion?.d ? L(`${season.year} şampiyonası`, `${season.year} championship`) : L('Şampiyona', 'Championship');
  return card(title, box, { flush: true, actions: seg([{ value: 'd', label: L('Pilotlar', 'Drivers') }, { value: 'c', label: L('Takımlar', 'Teams') }], 'd', render), more: { href: '#puan', label: L('Tablo', 'Table') } });
}

function favCard(ctx, last) {
  const { ref, profile } = ctx;
  const { season, st, upto, hidden: hide } = visibleStandings(ctx, last);
  const team = profile.favTeam;
  const drivers = profile.favDrivers.length ? profile.favDrivers : (data.lineup(ref, season).get(team) || []);
  const rows = drivers.map((d) => {
    const s1 = st.d.find((x) => x[0] === d);
    const t = data.teamOf(season, d);
    const lr = last?.race.res?.find((x) => x.d === d);
    const seen = season.races.filter((r) => r.r <= upto);
    const wins = seen.filter((r) => r.res?.[0]?.d === d).length;
    const pods = seen.filter((r) => r.res?.slice(0, 3).some((x) => x.d === d)).length;
    return h('div', { class: 'li' },
      dchip(ref, d, { t, flagOn: true }),
      h('span', { class: 'sp' }),
      h('div', { class: 'r' },
        h('div', { class: 'strong num' }, s1 ? L(`${s1[1]}. sırada, ${fmtPts(s1[2])} puan`, `${ordinalTr(s1[1])}, ${fmtPts(s1[2])} pts`) : '–'),
        h('div', { class: 'li-s num' }, `${wins} ${L('galibiyet', 'wins')}, ${pods} ${L('podyum', 'podiums')}`, lr && !hide ? L(`; son yarışta ${lr.pn ? lr.pn + '.' : lr.p}`, `; last race ${lr.pn ? ordinalTr(lr.pn) : lr.p}`) : '')));
  });
  const tStand = team ? st.c.find((x) => x[0] === team) : null;
  const title = team ? teamName(ref, team) : L('Favorilerin', 'Your favourites');
  return card(title, h('div', {},
    team ? h('div', { class: 'row', style: { marginBottom: '6px' } }, tchip(ref, team), h('span', { class: 'sp' }), tStand ? h('span', { class: 'muted num' }, L(`Takımlarda ${tStand[1]}., ${fmtPts(tStand[2])} puan`, `Constructors: ${ordinalTr(tStand[1])}, ${fmtPts(tStand[2])} pts`)) : null) : null,
    h('div', { class: 'list' }, rows),
    drivers.length === 2 ? h('div', { class: 'mt' }, h('a', { class: 'btn sm', href: `#kafa-kafaya/${drivers[0]}/${drivers[1]}` }, icon('versus'), L('Takım içi düello', 'Teammate duel'))) : null),
  { more: team ? { href: `#takim/${team}`, label: L('Takım sayfası', 'Team page') } : null });
}

function toolsCard(ctx, ne) {
  const links = [
    ne ? ['#tahmin', 'target', L(`${gpName(ctx.ref, ne.race.gp)} tahminini yap`, `Predict the ${gpName(ctx.ref, ne.race.gp)}`), L('Pole, podyum ve en hızlı tur; sonuçtan sonra puanlanır.', 'Pole, podium and fastest lap; scored after the race.')] : null,
    ['#quiz', 'quiz', L('Günün quizi', 'Daily quiz'), L('Her gün 5 soru; seri yapabilirsin.', 'Five questions a day; keep your streak.')],
    ['#bugun', 'history', L('Bugün F1 tarihinde', 'On this day'), L('Bu tarihte koşulan yarışlar ve doğan pilotlar.', 'Races held and drivers born on this date.')],
    ['#simulator', 'sliders', L('Ya şöyle biterse', 'What if'), L('Kalan yarışları sen bitir ya da puan sistemini değiştir.', 'Finish the remaining races or change the points system.')]
  ].filter(Boolean);
  return card(L('Oyna ve kurcala', 'Play and tinker'), h('div', { class: 'list' }, links.map(([href, ic, t, sub]) =>
    h('a', { class: 'li', href }, h('span', { class: 'dim' }, icon(ic)), h('div', {}, h('div', { class: 'li-t' }, t), h('div', { class: 'li-s' }, sub))))));
}

export function rankNews(items, profile) {
  const favD = new Set(profile.favDrivers), favT = profile.favTeam;
  const langOk = (it) => profile.newsLang === 'all' || !profile.newsLang || it.lang === profile.newsLang;
  const score = (it) => (it.tags?.d?.some((d) => favD.has(d)) || (favT && it.tags?.t?.includes(favT)) ? 1 : 0);
  const pool = items.filter(langOk);
  const recent = pool.filter((it) => Date.now() - it.ts < 36 * 3600000);
  const favs = recent.filter((it) => score(it)).slice(0, 2);
  const rest = pool.filter((it) => !favs.includes(it));
  return [...favs, ...rest];
}
