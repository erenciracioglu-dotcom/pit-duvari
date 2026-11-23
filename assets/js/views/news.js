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

export function newsItem(it, sources, ref, profile, cut) {
  const src = sources?.find((x) => x.id === it.src);
  const fav = it.tags?.d?.some((d) => profile.favDrivers.includes(d)) || (profile.favTeam && it.tags?.t?.includes(profile.favTeam));
  const hidden = cut && it.ts >= cut.from;
  const tags = [...(it.tags?.t || []).slice(0, 2).map((t) => h('span', { class: 'row', style: { gap: '5px', display: 'inline-flex' } }, h('span', { class: 'tdot', style: { background: teamColor(t) } }), teamName(ref, t))),
    ...(it.tags?.d || []).slice(0, 2).map((d) => h('span', {}, driverName(ref, d, 'last')))];
  const a = h('a', { class: ['nitem', fav && 'fav'], href: it.u, target: '_blank', rel: 'noopener' },
    h('div', { class: ['t', hidden && 'spoiler inline-veil'] }, it.t),
    hidden ? h('div', { class: 's' }, L('Spoiler olabilir. Görmek için dokun.', 'Possible spoiler. Tap to reveal.')) : (it.s ? h('div', { class: 's' }, it.s) : null),
    h('div', { class: 'm' }, h('span', { class: 'src' }, src?.name || it.src), h('span', { class: 'lang' }, it.lang.toUpperCase()), h('span', {}, fmtRel(it.ts)), ...tags));
  if (hidden) {
    a.addEventListener('click', (e) => {
      if (a.dataset.shown) return;
      e.preventDefault();
      a.dataset.shown = '1';
      a.querySelector('.t').classList.remove('spoiler', 'inline-veil');
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
  const state = { lang: profile.newsLang || 'all', src: 'all', tag: profile.favTeam || profile.favDrivers.length ? 'fav' : 'all', q: '' };
  const listEl = h('div', { class: 'news' });
  const countEl = h('span', { class: 'dim t-small' });

  const lineupDrivers = (ref.lineup || []).map((x) => x.d);
  const teams = [...new Set((ref.lineup || []).map((x) => x.t))];
  const tagOptions = [
    { value: 'all', label: L('Tüm konular', 'All topics') },
    ...(profile.favTeam || profile.favDrivers.length ? [{ value: 'fav', label: L('Favorilerim', 'My favourites') }] : []),
    { group: L('Takımlar', 'Teams'), items: teams.map((t) => ({ value: 't:' + t, label: teamName(ref, t) })) },
    { group: L('Pilotlar', 'Drivers'), items: lineupDrivers.map((d) => ({ value: 'd:' + d, label: driverName(ref, d) })).sort((a, b) => a.label.localeCompare(b.label)) }
  ];

  const apply = () => {
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
    if (!items.length) { listEl.appendChild(h('div', { class: 'nitem' }, h('div', { class: 's' }, L('Bu süzgeçle haber yok. Konuyu ya da dili değiştir.', 'No stories for this filter. Change the topic or language.')))); return; }
    for (const it of items.slice(0, 150)) listEl.appendChild(newsItem(it, nw.sources, ref, profile, cut));
  };

  const srcOptions = [{ value: 'all', label: L('Tüm kaynaklar', 'All sources') }, ...nw.sources.map((x) => ({ value: x.id, label: `${x.name} (${x.lang.toUpperCase()})` }))];
  add(root, 
    vhead({ title: L('Haberler', 'News'), sub: L('Türkçe ve İngilizce F1 kaynaklarından başlıklar ve kısa özetler. Habere dokununca kaynağında açılır.', 'Headlines and short summaries from Turkish and English F1 outlets. Tap a story to open it at the source.') }),
    h('div', { class: 'filters' },
      seg([{ value: 'all', label: L('Tümü', 'All') }, { value: 'tr', label: 'Türkçe' }, { value: 'en', label: 'English' }], state.lang, (v) => { state.lang = v; store.update((p) => { p.newsLang = v; }); apply(); }, { label: L('Dil', 'Language') }),
      select(tagOptions, state.tag, (v) => { state.tag = v; apply(); }, { 'aria-label': L('Konu', 'Topic') }),
      select(srcOptions, state.src, (v) => { state.src = v; apply(); }, { 'aria-label': L('Kaynak', 'Source') }),
      h('input', { type: 'search', placeholder: L('Haberlerde ara', 'Search news'), 'aria-label': L('Haberlerde ara', 'Search news'), onInput: debounce((e) => { state.q = e.target.value; apply(); }, 200) }),
      countEl),
    cut ? h('p', { class: 'muted t-small row', style: { gap: '8px' } }, icon('eyeOff'), L('Spoiler kalkanı açık: son yarış haftası başladıktan sonraki başlıklar bulanık.', 'Spoiler shield on: headlines since the last race weekend began are blurred.')) : null,
    listEl,
    h('p', { class: 'dim t-small mt' }, L('Akış her 30 dakikada bir yenilenir. Son tarama: ', 'Refreshed every 30 minutes. Last scan: '), fmtRel(Date.parse(nw.generated))),
    footer(meta));
  apply();
}
