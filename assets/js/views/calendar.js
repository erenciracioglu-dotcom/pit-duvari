// Takvim: sezonun tum yarislari, gecmisin kazananlari, siradakinin geri sayimi, takvim aboneligi
import { h, add } from '../core/util.js';
import { L, gpName, fmtDay, fmtTime, fmtRel, circuitName } from '../core/i18n.js';
import * as data from '../core/data.js';
import { vhead, flag, icon, dchip, spoilerActive, footer } from '../core/ui.js';
import { raceHref, raceEndMs, trackSvg, weekendRange, icsModal, seasonSelect, tzNote } from './common.js';

export async function render(root, ctx) {
  const { ref, meta } = ctx;
  const years = [meta.currentSeason, meta.nextSeason].filter(Boolean);
  const year = Number(ctx.params[0]) || (ctx.cur.races.every((r) => r.res?.length) && meta.nextSeason ? meta.nextSeason : meta.currentSeason);
  const season = year === meta.currentSeason ? ctx.cur : year === meta.nextSeason ? ctx.next : await data.season(year);
  const geo = await data.geo().catch(() => ({}));
  const now = Date.now();
  const ne = data.nextEvent([season], now);

  const items = season.races.map((race) => {
    const state = data.raceState(race, now);
    const isNext = ne?.race === race;
    const key = data.raceKey(year, race.r);
    const c = ref.circuits[race.c];
    let side;
    if (race.res?.length) {
      const w = race.res[0];
      side = spoilerActive(key, raceEndMs(race))
        ? h('span', { class: 'dim row', style: { gap: '6px', justifyContent: 'flex-end' } }, icon('eyeOff'), L('Gizli', 'Hidden'))
        : h('div', {}, h('div', { class: 'dim t-small' }, L('Kazanan', 'Winner')), h('div', {}, dchip(ref, w.d, { t: w.t, link: false, short: true })));
    } else if (state === 'live') side = h('span', { class: 'badge bad' }, h('span', { class: 'live-dot' }), L('Bu hafta sonu', 'This weekend'));
    else if (state === 'pending') side = h('span', { class: 'dim' }, L('Sonuç bekleniyor', 'Awaiting result'));
    else if (isNext) side = h('div', {}, h('div', { class: 'strong' }, fmtRel(ne.session.start)), h('div', { class: 'dim t-small' }, L('sıradaki seans', 'next session')));
    else side = h('span', { class: 'dim' }, race.s?.r?.includes('T') ? `${fmtDay(race.s.r)} ${fmtTime(race.s.r)}` : L('saat açıklanmadı', 'time TBC'));
    const month = new Date((race.start || race.date) + 'T12:00:00Z');
    return h('a', { class: ['cal-item', isNext && 'next', race.res?.length && 'past'], href: raceHref(year, race.r) },
      h('div', { class: 'rd' }, race.r, h('small', {}, month.toLocaleDateString(L('tr-TR', 'en-GB'), { month: 'short', timeZone: 'UTC' }))),
      h('div', { style: { minWidth: 0 } },
        h('div', { class: 'gpn' }, flag(ref, c?.nat), h('span', { class: 'ellip' }, gpName(ref, race.gp)), race.sprint ? h('span', { class: 'badge' }, 'Sprint') : null),
        h('div', { class: 'meta' }, h('span', {}, weekendRange(race)), h('span', { class: 'ellip' }, circuitName(ref, race.c)))),
      h('div', { class: 'row', style: { gap: '14px' } }, h('div', { class: 'side' }, side), trackSvg(geo[race.c], 'mini-track')));
  });

  const doneCount = season.races.filter((r) => r.res?.length).length;
  const sub = season.provisional
    ? L(`${season.races.length} yarış, ${season.races.filter((r) => r.sprint).length} sprint. Seans saatleri açıklanınca kendiliğinden eklenecek.`, `${season.races.length} races, ${season.races.filter((r) => r.sprint).length} sprints. Session times appear once announced.`)
    : L(`${season.races.length} yarışın ${doneCount} tanesi koşuldu.`, `${doneCount} of ${season.races.length} races run.`);
  add(root, 
    vhead({
      title: L(`${year} takvimi`, `${year} calendar`), sub,
      actions: [years.length > 1 ? seasonSelect(years, year, (y) => { location.hash = `#takvim/${y}`; }) : null,
        h('button', { class: 'btn pri', type: 'button', onClick: icsModal }, icon('cal'), L('Telefon takvimine ekle', 'Add to phone calendar'))]
    }),
    season.testing ? h('p', { class: 'muted t-small' }, L(`Sezon öncesi testler: ${fmtDay(season.testing.start, { weekday: false })} – ${fmtDay(season.testing.end, { weekday: false })}, Bahreyn.`, `Pre-season testing: ${fmtDay(season.testing.start, { weekday: false })} – ${fmtDay(season.testing.end, { weekday: false })}, Bahrain.`)) : null,
    h('div', { class: 'row', style: { marginBottom: '10px' } }, tzNote()),
    h('div', { class: 'cal' }, items),
    footer(meta));
  // siradaki yarisa kaydir
  setTimeout(() => root.querySelector('.cal-item.next')?.scrollIntoView({ block: 'center', behavior: 'instant' }), 50);
}
