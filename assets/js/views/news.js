// Haber akisi: Turkce ve Ingilizce kaynaklar, favori etiketleri, spoiler kalkani
import { h, clear, debounce, add } from '../core/util.js';
import { L, fmtRel, driverName, teamName } from '../core/i18n.js';
import * as data from '../core/data.js';
import * as store from '../core/store.js';
import { vhead, seg, select, empty, spoilerActive, icon, footer } from '../core/ui.js';
import { teamColor } from '../core/colors.js';
import { raceEndMs } from './common.js';

// Spoiler kalkani acik ve son yarisin sonucu gizliyse: o hafta sonunun siralama seansindan sonra yayinlanan haberler bulanik
export function spoilerCut(seasons) {
  const last = data.lastRace(seasons);
  if (!last) return null;
  const key = data.raceKey(last.season.year, last.race.r);
  if (!spoilerActive(key, raceEndMs(last.race))) return null;
  const ss = data.sessionsOf(last.race).filter((x) => ['q', 'sq', 'spr', 'r'].includes(x.k));
  return { key, from: ss[0]?.start ?? Date.parse(last.race.date) };
}

// Kaynaklarin kendi rengi (resimsiz haberlerde kart arka plani)
const SRC_COL = { f1: '#e10600', 'motorsport-tr': '#e30a17', motorsport: '#f5a623', autosport: '#c8102e', 'the-race': '#d61f69', racefans: '#2e86de', bbc: '#bb1919', crash: '#1f8f5f', rn365: '#7b4dff', grandprix: '#0aa3c2', ntvspor: '#00a0e3' };

export function newsItem(it, sources, ref, profile, cut, { eager = false } = {}) {
  const src = sources?.find((x) => x.id === it.src);
  const fav = it.tags?.d?.some((d) => profile.favDrivers.includes(d)) || (profile.favTeam && it.tags?.t?.includes(profile.favTeam));
  const hidden = cut && it.ts >= cut.from;
  // resimsiz kartin rengi: haberdeki takim, yoksa pilotun takimi, yoksa kaynagin rengi; yon haberden habere degisir
  const dTeam = it.tags?.d?.length ? (ref.lineup || []).find((x) => x.d === it.tags.d[0])?.t : null;
  const tint = it.tags?.t?.[0] ? teamColor(it.tags.t[0]) : dTeam ? teamColor(dTeam) : (SRC_COL[it.src] || '#3a4a5c');
  let hsh = 0; for (const c of it.id || it.u) hsh = (hsh * 31 + c.charCodeAt(0)) >>> 0;
  const tags = [...(it.tags?.t || []).slice(0, 2).map((t) => h('span', { class: 'row', style: { gap: '5px', display: 'inline-flex' } }, h('span', { class: 'tdot', style: { background: teamColor(t) } }), teamName(ref, t))),
    ...(it.tags?.d || []).slice(0, 2).map((d) => h('span', {}, driverName(ref, d, 'last')))];
  const thumb = h('div', { class: ['nthumb', hidden && 'veiled', !it.img && 'noimg'], style: { '--tint': tint, '--gx': `${10 + (hsh % 80)}%`, '--ga': `${100 + (hsh % 90)}deg` } },
    it.img ? h('img', { src: it.img, alt: '', loading: eager ? 'eager' : 'lazy', decoding: 'async', referrerpolicy: 'no-referrer', onError: (e) => e.target.remove() }) : null,
    h('div', { class: 'nbadges' }, h('span', { class: 'nb src' }, src?.name || it.src), h('span', { class: 'nb' }, it.lang.toUpperCase()), fav ? h('span', { class: 'nb fav', title: L('Favorilerinle ilgili', 'About your favourites') }, '★') : null));
  const a = h('a', { class: 'ncard', href: it.u, target: '_blank', rel: 'noopener' },
    thumb,
    h('div', { class: 'nbody' },
      h('div', { class: ['t', hidden && 'spoiler inline-veil'] }, it.t),
      hidden ? h('div', { class: 's' }, L('Spoiler olabilir. Görmek için dokun.', 'Possible spoiler. Tap to reveal.')) : (it.s ? h('div', { class: 's' }, it.s) : null),
      h('div', { class: 'm' }, h('span', {}, fmtRel(it.ts)), ...tags)));
  if (hidden) {
    a.addEventListener('click', (e) => {
      if (a.dataset.shown) return;
      e.preventDefault();
      a.dataset.shown = '1';
      a.querySelector('.t').classList.remove('spoiler', 'inline-veil');
      thumb.classList.remove('veiled');
      const sEl = a.querySelector('.s');
      if (sEl) sEl.textContent = it.s || '';
    });
  }
  return a;
}

export async function render(root, ctx) {
  const { ref, seasons, meta } = ctx;
  const profile = store.get();
  let nw;
  try { nw = await data.news(); } catch {
    add(root, vhead({ title: L('Haberler', 'News') }), empty(L('Haberler yüklenemedi', 'News could not be loaded'), L('Bağlantını kontrol edip yeniden dene.', 'Check your connection and try again.')));
    return;
  }
  const cut = spoilerCut(seasons);
  const state = { limit: 36, lang: profile.newsLang || 'all', src: 'all', tag: profile.favTeam || profile.favDrivers.length ? 'fav' : 'all', q: '' };
  const listEl = h('div', { class: 'ngrid' });
  const countEl = h('span', { class: 'dim t-small' });

  const lineupDrivers = (ref.lineup || []).map((x) => x.d);
  const teams = [...new Set((ref.lineup || []).map((x) => x.t))];
  const tagOptions = [
    { value: 'all', label: L('Tüm konular', 'All topics') },
    ...(profile.favTeam || profile.favDrivers.length ? [{ value: 'fav', label: L('Favorilerim', 'My favourites') }] : []),
    { group: L('Takımlar', 'Teams'), items: teams.map((t) => ({ value: 't:' + t, label: teamName(ref, t) })) },
    { group: L('Pilotlar', 'Drivers'), items: lineupDrivers.map((d) => ({ value: 'd:' + d, label: driverName(ref, d) })).sort((a, b) => a.label.localeCompare(b.label)) }
  ];

  const apply = (reset) => {
    if (reset === true) state.limit = 36;
    const q = state.q.trim().toLocaleLowerCase();
    const items = nw.items.filter((it) => {
      if (state.lang !== 'all' && it.lang !== state.lang) return false;
      if (state.src !== 'all' && it.src !== state.src) return false;
      if (state.tag === 'fav') {
        if (!(it.tags?.d?.some((d) => profile.favDrivers.includes(d)) || (profile.favTeam && it.tags?.t?.includes(profile.favTeam)))) return false;
      } else if (state.tag.startsWith('t:')) { if (!it.tags?.t?.includes(state.tag.slice(2))) return false; }
      else if (state.tag.startsWith('d:')) { if (!it.tags?.d?.includes(state.tag.slice(2))) return false; }
      if (q && !(`${it.t} ${it.s}`.toLocaleLowerCase().includes(q))) return false;
      return true;
    });
    clear(listEl);
    countEl.textContent = L(`${items.length} haber`, `${items.length} stories`);
    if (!items.length) { listEl.appendChild(h('div', { class: 'panel-quiet', style: { gridColumn: '1 / -1' } }, h('div', {}, L('Bu süzgeçle haber yok. Konuyu ya da dili değiştir.', 'No stories for this filter. Change the topic or language.')))); return; }
    const shown = items.slice(0, state.limit);
    shown.forEach((it, i) => listEl.appendChild(newsItem(it, nw.sources, ref, profile, cut, { eager: i < 9 })));
    if (items.length > shown.length) listEl.appendChild(h('button', { class: 'btn nmore', type: 'button', onClick: () => { state.limit += 36; apply(); } }, L(`Daha fazla göster (${items.length - shown.length})`, `Show more (${items.length - shown.length})`)));
  };

  const srcOptions = [{ value: 'all', label: L('Tüm kaynaklar', 'All sources') }, ...nw.sources.map((x) => ({ value: x.id, label: `${x.name} (${x.lang.toUpperCase()})` }))];
  add(root, 
    vhead({ title: L('Haberler', 'News'), sub: L('Türkçe ve İngilizce F1 kaynaklarından başlıklar ve kısa özetler. Habere dokununca kaynağında açılır.', 'Headlines and short summaries from Turkish and English F1 outlets. Tap a story to open it at the source.') }),
    h('div', { class: 'filters' },
      seg([{ value: 'all', label: L('Tümü', 'All') }, { value: 'tr', label: 'Türkçe' }, { value: 'en', label: 'English' }], state.lang, (v) => { state.lang = v; store.update((p) => { p.newsLang = v; }); apply(true); }, { label: L('Dil', 'Language') }),
      select(tagOptions, state.tag, (v) => { state.tag = v; apply(true); }, { 'aria-label': L('Konu', 'Topic') }),
      select(srcOptions, state.src, (v) => { state.src = v; apply(true); }, { 'aria-label': L('Kaynak', 'Source') }),
      h('input', { type: 'search', placeholder: L('Haberlerde ara', 'Search news'), 'aria-label': L('Haberlerde ara', 'Search news'), onInput: debounce((e) => { state.q = e.target.value; apply(true); }, 200) }),
      countEl),
    cut ? h('p', { class: 'muted t-small row', style: { gap: '8px' } }, icon('eyeOff'), L('Spoiler kalkanı açık: son yarış haftası başladıktan sonraki başlıklar bulanık.', 'Spoiler shield on: headlines since the last race weekend began are blurred.')) : null,
    listEl,
    h('p', { class: 'dim t-small mt' }, L('Akış her 30 dakikada bir yenilenir. Son tarama: ', 'Refreshed every 30 minutes. Last scan: '), fmtRel(Date.parse(nw.generated))),
    footer(meta));
  apply();
}
