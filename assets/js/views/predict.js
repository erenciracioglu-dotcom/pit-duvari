// Tahmin oyunu: siradaki yaris icin pole, podyum, en hizli tur, bitiremeyen sayisi; sonuc gelince puanlanir.
import { h, add, copyText } from '../core/util.js';
import { L, gpName, driverName, teamName, fmtDay, fmtTime, fmtRel } from '../core/i18n.js';
import * as data from '../core/data.js';
import * as store from '../core/store.js';

import { vhead, card, footer, toast, icon, spoilerActive } from '../core/ui.js';
import { raceHref, raceEndMs } from './common.js';

export const RULES = { pole: 5, p1: 10, p2: 6, p3: 6, podiumAny: 2, fl: 4, dnfExact: 4, dnfNear: 1, sprint: 5 };

export function score(pred, race, story) {
  if (!race?.res?.length) return null;
  const out = { total: 0, parts: [] };
  const addp = (k, v, ok) => { out.parts.push({ k, v, ok }); if (ok) out.total += v; };
  const res = race.res;
  const pole = res.find((x) => x.pole)?.d || race.q?.[0]?.d; // resmi pole: gridin ilk sirasi (ceza sonrasi)
  if (pred.pole) addp('pole', RULES.pole, pred.pole === pole);
  const top3 = [1, 2, 3].map((n) => res.find((x) => x.pn === n)?.d);
  ['p1', 'p2', 'p3'].forEach((k, i) => {
    if (!pred[k]) return;
    if (pred[k] === top3[i]) addp(k, RULES[k], true);
    else if (top3.includes(pred[k])) addp(`${k}~`, RULES.podiumAny, true);
    else addp(k, RULES[k], false);
  });
  const fl = race.fl?.d || (story?.fl ? story.drv?.[story.fl.no]?.d : null);
  if (pred.fl && fl) addp('fl', RULES.fl, pred.fl === fl);
  if (pred.dnf != null && pred.dnf !== '') {
    const n = res.filter((x) => x.pn == null && x.p !== 'DNS').length;
    const d = Math.abs(Number(pred.dnf) - n);
    if (d === 0) addp('dnf', RULES.dnfExact, true); else if (d === 1) addp('dnf~', RULES.dnfNear, true); else addp('dnf', RULES.dnfExact, false);
  }
  if (pred.sprint && race.spr?.length) addp('sprint', RULES.sprint, pred.sprint === race.spr.find((x) => x.pn === 1)?.d);
  return out;
}

const LABEL = () => ({ pole: 'Pole', p1: L('Kazanan', 'Winner'), p2: L('İkinci', 'Second'), p3: L('Üçüncü', 'Third'), fl: L('En hızlı tur', 'Fastest lap'), dnf: L('Bitiremeyen sayısı', 'Retirements'), sprint: L('Sprint kazananı', 'Sprint winner') });

export async function render(root, ctx) {
  const { ref, meta, seasons } = ctx;
  const p = store.get();
  const ne = data.nextEvent(seasons);
  add(root, vhead({ title: L('Tahmin oyunu', 'Predictions'), sub: L('Her yarıştan önce pole, podyum, en hızlı tur ve bitiremeyen sayısını tahmin et. Tahminler ilk sıralama seansı başlayınca kilitlenir, sonuç gelince puanlanır.', 'Before each race, predict pole, podium, fastest lap and retirements. Picks lock when the first qualifying session starts and are scored after the race.') }));
  const grid = h('div', { class: 'grid g-7-5' });
  const left = h('div', { class: 'stack' }), right = h('div', { class: 'stack' });
  grid.append(left, right);
  root.appendChild(grid);

  if (ne && !ne.season.provisional) left.appendChild(formCard(ctx, ne.season, ne.race));
  else left.appendChild(card(L('Sıradaki yarış', 'Next race'), h('p', { class: 'muted', style: { margin: 0 } }, L('Sıradaki yarışın seans saatleri açıklanınca tahmin formu burada açılır.', 'The form opens here once the next race’s session times are out.'))));

  // gecmis tahminler
  const entries = Object.entries(p.predictions).sort((a, b) => b[0].localeCompare(a[0], undefined, { numeric: true }));
  const rows = [];
  let seasonTotal = 0, count = 0;
  for (const [key, pred] of entries) {
    const [y, r] = key.split('-').map(Number);
    const S = seasons.find((s) => s.year === y) || await data.season(y).catch(() => null);
    const race = S?.races.find((x) => x.r === r);
    if (!race) continue;
    let story = null;
    if ((meta.stories || []).includes(key)) story = await data.story(y, r).catch(() => null);
    const hidden = spoilerActive(key, raceEndMs(race));
    const sc = hidden ? null : score(pred, race, story);
    if (sc && y === meta.currentSeason) { seasonTotal += sc.total; count++; }
    rows.push(h('div', { class: 'li', style: { alignItems: 'flex-start' } },
      h('div', { style: { minWidth: 0, flex: 1 } },
        h('a', { class: 'li-t', href: raceHref(y, r) }, `${y} ${gpName(ref, race.gp)}`),
        h('div', { class: 'li-s' }, ['pole', 'p1', 'p2', 'p3', 'fl', 'sprint'].filter((k) => pred[k]).map((k) => `${LABEL()[k]}: ${driverName(ref, pred[k], 'code')}`).join(', '), pred.dnf != null && pred.dnf !== '' ? `, DNF: ${pred.dnf}` : ''),
        sc ? h('div', { class: 'row wrap', style: { gap: '4px', marginTop: '6px' } }, sc.parts.map((x) => h('span', { class: ['badge', x.ok ? 'pb' : ''] }, `${LABEL()[x.k.replace('~', '')]}${x.k.endsWith('~') ? L(' (podyumda)', ' (on podium)') : ''} ${x.ok ? '+' + x.v : '0'}`))) : null),
      h('div', { class: 'r' }, hidden ? h('span', { class: 'dim t-small' }, L('Gizli', 'Hidden')) : sc ? h('div', { class: 'cond strong', style: { fontSize: '1.6rem' } }, sc.total) : h('span', { class: 'dim t-small' }, L('Sonuç bekleniyor', 'Awaiting result')))));
  }
  right.appendChild(card(L('Puan tablon', 'Your scorecard'), h('div', {},
    h('div', { class: 'stats' }, h('div', { class: 'stat' }, h('div', { class: 'v' }, seasonTotal), h('div', { class: 'k' }, L(`${meta.currentSeason} toplamı`, `${meta.currentSeason} total`))),
      h('div', { class: 'stat' }, h('div', { class: 'v' }, count ? Math.round(seasonTotal / count) : '–'), h('div', { class: 'k' }, L('yarış başına', 'per race')))),
    rows.length ? h('div', { class: 'list mt' }, rows) : h('p', { class: 'muted' }, L('Henüz tahmin yok.', 'No predictions yet.')))));
  right.appendChild(card(L('Puanlama', 'Scoring'), h('dl', { class: 'kv' },
    h('dt', {}, 'Pole'), h('dd', {}, RULES.pole), h('dt', {}, L('Kazanan', 'Winner')), h('dd', {}, RULES.p1), h('dt', {}, L('İkinci, üçüncü', 'Second, third')), h('dd', {}, `${RULES.p2}, ${RULES.p3}`),
    h('dt', {}, L('Podyumdaki pilot, yanlış basamak', 'Podium driver, wrong step')), h('dd', {}, RULES.podiumAny), h('dt', {}, L('En hızlı tur', 'Fastest lap')), h('dd', {}, RULES.fl),
    h('dt', {}, L('Bitiremeyen sayısı (tam / bir eksik-fazla)', 'Retirements (exact / off by one)')), h('dd', {}, `${RULES.dnfExact} / ${RULES.dnfNear}`), h('dt', {}, L('Sprint kazananı', 'Sprint winner')), h('dd', {}, RULES.sprint))));
  add(root, footer(meta));
}

function formCard(ctx, season, race) {
  const { ref, cur } = ctx;
  const key = data.raceKey(season.year, race.r);
  const p = store.get();
  const pred = { ...(p.predictions[key] || {}) };
  const lockAt = data.sessionsOf(race).find((x) => ['sq', 'q'].includes(x.k))?.start || Date.parse(race.s?.r || race.date);
  const locked = Date.now() >= lockAt;
  const lineup = data.lineup(ref, cur);
  const opts = (k) => h('select', { disabled: locked, 'aria-label': LABEL()[k], onChange: (e) => { pred[k] = e.target.value || undefined; } },
    h('option', { value: '' }, L('Seç', 'Pick')),
    [...lineup.entries()].map(([t, ds]) => h('optgroup', { label: teamName(ref, t) }, ds.map((d) => h('option', { value: d, selected: pred[k] === d }, driverName(ref, d))))));
  const dnf = h('select', { disabled: locked, 'aria-label': LABEL().dnf, onChange: (e) => { pred.dnf = e.target.value; } }, h('option', { value: '' }, L('Seç', 'Pick')), [0, 1, 2, 3, 4, 5, 6].map((n) => h('option', { value: n, selected: String(pred.dnf) === String(n) }, n === 6 ? '6+' : n)));
  const fields = ['pole', 'p1', 'p2', 'p3', 'fl'].concat(race.sprint ? ['sprint'] : []);
  const save = () => {
    const keys = ['p1', 'p2', 'p3'].map((k) => pred[k]).filter(Boolean);
    if (new Set(keys).size !== keys.length) { toast(L('Podyumda aynı pilot iki kez olamaz.', 'The same driver can’t take two podium steps.')); return; }
    store.update((x) => { x.predictions[key] = { ...pred, at: Date.now() }; });
    toast(L('Tahminin kaydedildi.', 'Prediction saved.'));
  };
  const share = async () => {
    const txt = L(`Pit Duvarı tahminim, ${gpName(ref, race.gp)}: `, `My Pit Duvarı prediction, ${gpName(ref, race.gp)}: `) + fields.filter((k) => pred[k]).map((k) => `${LABEL()[k]} ${driverName(ref, pred[k], 'last')}`).join(', ') + (pred.dnf !== undefined && pred.dnf !== '' ? `, DNF ${pred.dnf}` : '');
    toast((await copyText(txt)) ? L('Tahmin metni kopyalandı; WhatsApp’a yapıştırabilirsin.', 'Copied; paste it into WhatsApp.') : txt, 4000);
  };
  return card(L(`${gpName(ref, race.gp)} tahminin`, `Your ${gpName(ref, race.gp)} picks`), h('div', {},
    h('p', { class: 'muted', style: { marginTop: 0 } }, locked ? L('Tahminler kilitlendi; sonuç gelince puanın burada.', 'Picks are locked; your score appears after the race.')
      : L(`Kilit: ${fmtDay(lockAt)} ${fmtTime(lockAt)} (${fmtRel(lockAt)})`, `Locks ${fmtDay(lockAt)} ${fmtTime(lockAt)} (${fmtRel(lockAt)})`)),
    fields.map((k) => h('div', { class: 'pick' }, h('label', { class: 'strong' }, LABEL()[k]), opts(k))),
    h('div', { class: 'pick' }, h('label', { class: 'strong' }, LABEL().dnf), dnf),
    h('div', { class: 'row wrap mt' }, locked ? null : h('button', { class: 'btn pri', type: 'button', onClick: save }, icon('target'), L('Kaydet', 'Save')),
      h('button', { class: 'btn ghost', type: 'button', onClick: share }, icon('copy'), L('Paylaş', 'Share')))));
}
