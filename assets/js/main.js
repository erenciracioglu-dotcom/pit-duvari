// Pit Duvari: uygulama kabugu, yonlendirme, acilis.
import { h, clear } from './core/util.js';
import { L, setLocale, lang } from './core/i18n.js';
import * as store from './core/store.js';
import * as data from './core/data.js';
import { setTeamColors, applyAccent } from './core/colors.js';
import { icon, runCleanup, sheet, loading, errorBox, modal, toast } from './core/ui.js';
import { hideTip } from './core/charts.js';

const VIEWS = {
  pit: () => import('./views/home.js'),
  takvim: () => import('./views/calendar.js'),
  yaris: () => import('./views/race.js'),
  puan: () => import('./views/standings.js'),
  haberler: () => import('./views/news.js'),
  arsiv: () => import('./views/archive.js'),
  surucu: () => import('./views/driver.js'),
  takim: () => import('./views/team.js'),
  analiz: () => import('./views/race.js'),
  telemetri: () => import('./views/telemetry.js'),
  'kafa-kafaya': () => import('./views/h2h.js'),
  rekorlar: () => import('./views/records.js'),
  pistler: () => import('./views/circuits.js'),
  pist: () => import('./views/circuits.js'),
  simulator: () => import('./views/simulator.js'),
  tahmin: () => import('./views/predict.js'),
  quiz: () => import('./views/quiz.js'),
  bugun: () => import('./views/onthisday.js'),
  karne: () => import('./views/season-report.js'),
  profil: () => import('./views/profile.js')
};

const NAV = [
  { key: 'pit', icon: 'pit', tr: 'Pit duvarı', en: 'Pit wall' },
  { key: 'takvim', icon: 'cal', tr: 'Takvim', en: 'Calendar' },
  { key: 'puan', icon: 'trophy', tr: 'Puan durumu', en: 'Standings' },
  { key: 'haberler', icon: 'news', tr: 'Haberler', en: 'News' },
  { key: 'arsiv', icon: 'archive', tr: 'Arşiv', en: 'Archive' },
  { grp: true, tr: 'Analiz', en: 'Analysis' },
  { key: 'analiz', icon: 'pulse', tr: 'Yarış analizi', en: 'Race analysis' },
  { key: 'telemetri', icon: 'gauge', tr: 'Telemetri', en: 'Telemetry' },
  { key: 'kafa-kafaya', icon: 'versus', tr: 'Kafa kafaya', en: 'Head to head' },
  { key: 'rekorlar', icon: 'award', tr: 'Rekorlar', en: 'Records' },
  { key: 'pistler', icon: 'map', tr: 'Pistler', en: 'Circuits' },
  { key: 'simulator', icon: 'sliders', tr: 'Ya şöyle biterse', en: 'What if' },
  { grp: true, tr: 'Oyun', en: 'Play' },
  { key: 'tahmin', icon: 'target', tr: 'Tahmin oyunu', en: 'Predictions' },
  { key: 'quiz', icon: 'quiz', tr: 'Günün quizi', en: 'Daily quiz' },
  { key: 'bugun', icon: 'history', tr: 'Bugün F1 tarihinde', en: 'On this day' },
  { key: 'karne', icon: 'report', tr: 'Sezon karnesi', en: 'Season report' },
  { grp: true, tr: 'Sen', en: 'You' },
  { key: 'profil', icon: 'user', tr: 'Profil ve ayarlar', en: 'Profile & settings' }
];
const TAB_KEYS = ['pit', 'takvim', 'puan', 'haberler'];
const ACTIVE = { yaris: 'takvim', surucu: 'puan', takim: 'puan', pist: 'pistler' };

const app = { ctx: null, token: 0 };
const label = (n) => L(n.tr, n.en);

function shell() {
  const root = document.getElementById('app');
  clear(root);
  const rail = h('aside', { class: 'rail', 'aria-label': L('Ana menü', 'Main menu') },
    h('a', { class: 'wordmark', href: '#pit', 'aria-label': 'Pit Duvarı' }, 'Pit Duvarı', h('i')),
    h('nav', {}, NAV.map((n) => (n.grp ? h('div', { class: 'grp' }, label(n)) : h('a', { href: `#${n.key}`, 'data-key': n.key }, icon(n.icon), label(n))))),
    h('div', { class: 'foot' }, L('Resmi olmayan hayran projesi. ', 'Unofficial fan project. '), h('a', { href: '#profil' }, L('Veri kaynakları', 'Data sources'))));
  const top = h('header', { class: 'topbar' },
    h('a', { class: 'wordmark', href: '#pit' }, 'Pit Duvarı', h('i')),
    h('span', { class: 'sp' }),
    h('a', { class: 'iconbtn', href: '#profil', 'aria-label': L('Profil ve ayarlar', 'Profile & settings') }, icon('user')));
  const main = h('main', { id: 'view', tabindex: '-1' });
  const tabbar = h('nav', { class: 'tabbar', 'aria-label': L('Alt menü', 'Bottom menu') },
    TAB_KEYS.map((k) => { const n = NAV.find((x) => x.key === k); return h('a', { href: `#${k}`, 'data-key': k }, icon(n.icon), label(n)); }),
    h('button', { type: 'button', 'data-key': 'menu', onClick: openMenu }, icon('menu'), L('Menü', 'Menu')));
  root.append(h('div', { class: 'shell' }, rail, h('div', {}, top, main)), tabbar);
}

function openMenu() {
  const items = NAV.filter((n) => !n.grp && !TAB_KEYS.includes(n.key));
  sheet(h('div', {},
    h('div', { class: 'menu-grid' }, items.map((n) => h('a', { href: `#${n.key}` }, icon(n.icon), label(n))))));
}

function markActive(key) {
  const k = ACTIVE[key] || key;
  document.querySelectorAll('[data-key]').forEach((a) => {
    const on = a.dataset.key === k || (a.dataset.key === 'menu' && !TAB_KEYS.includes(k));
    a.classList.toggle('on', on);
    if (a.tagName === 'A') a.setAttribute('aria-current', a.dataset.key === k ? 'page' : 'false');
  });
}

function parseHash() {
  const raw = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
  const [key, ...rest] = raw.split('/');
  return { key: key || 'pit', params: rest.filter(Boolean), raw };
}

async function route() {
  const { key, params, raw } = parseHash();
  if (raw.startsWith('profil=')) return importFromLink(raw.slice(7));
  const loader = VIEWS[key] || VIEWS.pit;
  const my = ++app.token;
  runCleanup();
  hideTip();
  markActive(VIEWS[key] ? key : 'pit');
  const view = document.getElementById('view');
  clear(view).appendChild(loading());
  try {
    const mod = await loader();
    if (my !== app.token) return;
    const root = h('div', { class: 'view-root' });
    await mod.render(root, { ...app.ctx, key, params, profile: store.get() });
    if (my !== app.token) return;
    clear(view).appendChild(root);
    if (!sessionStorage.getItem('pd:keepScroll')) window.scrollTo(0, 0);
    sessionStorage.removeItem('pd:keepScroll');
    const title = root.querySelector('h1')?.textContent;
    document.title = title && key !== 'pit' ? `${title} · Pit Duvarı` : 'Pit Duvarı · F1 takip merkezi';
  } catch (e) {
    console.error(e);
    if (my !== app.token) return;
    clear(view).appendChild(errorBox(L('Bu sayfa açılamadı: ', 'This page could not be opened: ') + (e.message || e)));
  }
}

async function importFromLink(code) {
  try {
    const obj = await store.decodeLink(code);
    const err = store.validate(obj);
    if (err) throw new Error(err);
    const teams = obj.favTeam ? app.ctx.ref.constructors[obj.favTeam]?.n : '–';
    modal(L('Profil bağlantısı', 'Profile link'), h('div', {},
      h('p', { class: 'muted', style: { marginTop: 0 } }, L('Bu bağlantı başka bir cihazdan gönderilmiş bir Pit Duvarı profili içeriyor.', 'This link carries a Pit Duvarı profile sent from another device.')),
      h('dl', { class: 'kv' },
        h('dt', {}, L('Ad', 'Name')), h('dd', {}, obj.name || '–'),
        h('dt', {}, L('Favori takım', 'Favourite team')), h('dd', {}, teams),
        h('dt', {}, L('Tahminler', 'Predictions')), h('dd', {}, String(Object.keys(obj.predictions || {}).length)),
        h('dt', {}, L('Quiz günleri', 'Quiz days')), h('dd', {}, String(Object.keys(obj.quiz?.history || {}).length)))), {
      actions: [
        { label: L('Vazgeç', 'Cancel'), onClick: () => { location.hash = '#profil'; } },
        { label: L('Birleştir', 'Merge'), onClick: () => { store.importProfile(obj, 'merge'); afterProfileChange(); toast(L('Profil birleştirildi.', 'Profile merged.')); location.hash = '#profil'; } },
        { label: L('Bu cihaza al', 'Use on this device'), primary: true, onClick: () => { store.importProfile(obj, 'replace'); afterProfileChange(); toast(L('Profil bu cihaza aktarıldı.', 'Profile imported.')); location.hash = '#profil'; } }
      ],
      onClose: () => { if (location.hash.startsWith('#profil=')) location.hash = '#profil'; }
    });
  } catch (e) {
    toast(L('Profil bağlantısı açılamadı: ', 'Could not open profile link: ') + e.message, 5000);
    location.hash = '#profil';
  }
}

function afterProfileChange() {
  const p = store.get();
  const langChanged = lang() !== p.lang;
  setLocale({ lang: p.lang, tz: p.tz || undefined });
  applyAccent(p.favTeam);
  if (langChanged) shell();
}

export function rerender({ keepScroll = true } = {}) {
  if (keepScroll) sessionStorage.setItem('pd:keepScroll', '1');
  route();
}

async function start() {
  const p = store.load();
  setLocale({ lang: p.lang, tz: p.tz || undefined });
  applyAccent(p.favTeam);
  shell();
  const view = document.getElementById('view');
  view.appendChild(loading());
  try {
    app.ctx = await data.boot();
  } catch (e) {
    console.error(e);
    clear(view).appendChild(errorBox(L('Veriler yüklenemedi. İnternet bağlantını kontrol edip sayfayı yenile.', 'Could not load data. Check your connection and reload.')));
    return;
  }
  setTeamColors(app.ctx.ref.colors);
  applyAccent(p.favTeam);
  store.onChange(() => { afterProfileChange(); });
  window.addEventListener('hashchange', route);
  window.addEventListener('pd:rerender', () => rerender());
  await route();
  if (!p.seen.onboard && !location.hash.startsWith('#profil')) {
    const { onboarding } = await import('./views/profile.js');
    onboarding(app.ctx);
  }
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  // acik kalan sekmede veriyi tazele (30 dk)
  setInterval(async () => {
    try {
      const m = await data.getJSON('meta.json', { fresh: true });
      if (m.generated !== app.ctx.meta.generated) {
        for (const k of ['meta.json', 'ref.json', `season/${m.currentSeason}.json`, 'news.json']) data.getJSON(k, { fresh: true });
        app.ctx = await data.boot();
        setTeamColors(app.ctx.ref.colors);
        const { key } = parseHash();
        if (['pit', 'puan', 'haberler', 'takvim'].includes(key)) rerender();
      }
    } catch { /* cevrimdisi */ }
  }, 30 * 60000);
}

start();
