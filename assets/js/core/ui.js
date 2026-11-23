// Ortak arayuz parcalari
import { h, s, clear } from './util.js';
import { L, driverName, teamName, countryName, flagCode } from './i18n.js';
import { teamColor } from './colors.js';
import * as store from './store.js';

// ---- gorunum temizligi (zamanlayicilar, dinleyiciler) ----
let disposers = [];
export const onCleanup = (fn) => disposers.push(fn);
export function runCleanup() {
  for (const fn of disposers) { try { fn(); } catch { /* yoksay */ } }
  disposers = [];
}

// ---- simgeler (24x24, cizgi) ----
const P = {
  pit: 'M4 21V4m0 0h11l-2 4 2 4H4',
  cal: 'M7 3v3m10-3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z',
  trophy: 'M8 4h8v5a4 4 0 0 1-8 0V4Zm0 2H5a3 3 0 0 0 3 4m8-4h3a3 3 0 0 1-3 4m-4 3v4m-3 4h6m-5-4h4',
  news: 'M5 4h11a1 1 0 0 1 1 1v14a1 1 0 0 0 1 1H6a2 2 0 0 1-2-2V5a1 1 0 0 1 1-1Zm12 5h2a1 1 0 0 1 1 1v8a2 2 0 0 1-2 2M8 8h5M8 12h5M8 16h3',
  archive: 'M12 7v5l3 2M3.5 12a8.5 8.5 0 1 0 2.5-6M3 4v4h4',
  pulse: 'M3 12h4l2-6 4 12 2-6h6',
  gauge: 'M12 14l4-4M4.5 18a9 9 0 1 1 15 0',
  versus: 'M5 4l6 8-6 8m14-16-6 8 6 8',
  award: 'M12 15a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm-3.5 2.5L7 22l5-2 5 2-1.5-4.5',
  map: 'M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Zm0 0v14m6-12v14',
  sliders: 'M4 6h10m4 0h2M4 12h4m4 0h8M4 18h12m4 0h0M14 4v4m-6 2v4m8 2v4',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-4a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0-4a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z',
  quiz: 'M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14m0 3.5v.01M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z',
  history: 'M12 8v4l2 2m6-2a8 8 0 1 1-2.3-5.7M20 4v4h-4',
  report: 'M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm7 0v5h5M9 13h6M9 17h4',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9a7 7 0 0 1 14 0',
  menu: 'M4 7h16M4 12h16M4 17h16',
  x: 'M6 6l12 12M18 6 6 18',
  chevL: 'M15 6l-6 6 6 6',
  chevR: 'M9 6l6 6-6 6',
  play: 'M7 5v14l11-7L7 5Z',
  pause: 'M8 5v14m8-14v14',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  eyeOff: 'M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3 3.9M6.6 6.6A16.6 16.6 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2',
  download: 'M12 4v11m0 0-4-4m4 4 4-4M5 20h14',
  upload: 'M12 20V9m0 0-4 4m4-4 4 4M5 4h14',
  copy: 'M9 9h10v11H9zM5 15V4h10',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1m2 3.7a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  qr: 'M4 4h6v6H4zm10 0h6v6h-6zM4 14h6v6H4zm10 0h2v2h-2zm4 0h2v2h-2zm-4 4h2v2h-2zm4 0h2v2h-2z',
  ext: 'M14 4h6v6m0-6-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  bell: 'M6 16V11a6 6 0 1 1 12 0v5l2 2H4l2-2Zm4 4h4',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm9 2-4-4',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-11v6m0-9v.01',
  star: 'm12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3Z',
  flag: 'M5 21V4h9l1 2h5v9h-6l-1-2H5'
};
export function icon(name, cls) {
  return s('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.9, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', class: cls }, s('path', { d: P[name] || P.info }));
}

// ---- bayrak, surucu, takim ----
export function flag(ref, countryId, cls) {
  const code = flagCode(ref, countryId);
  if (!code) return null;
  return h('img', { class: ['flag', cls], src: `assets/flags/${code}.svg`, alt: countryName(ref, countryId), title: countryName(ref, countryId), loading: 'lazy', width: 18, height: 14 });
}

export function dchip(ref, id, { t, code = true, name = true, short = false, link = true, flagOn = false } = {}) {
  const col = teamColor(t);
  const d = ref.drivers[id];
  const kids = [h('span', { class: 'sl', style: { background: col } })];
  if (flagOn && d?.nat) kids.push(flag(ref, d.nat));
  if (code && !name) kids.push(h('span', { class: 'code' }, driverName(ref, id, 'code')));
  if (name) kids.push(h('span', { class: 'nm' }, short ? driverName(ref, id, 'last') : driverName(ref, id)));
  return h(link ? 'a' : 'span', { class: 'dchip', href: link ? `#surucu/${id}` : null, title: `${driverName(ref, id)}${t ? ' · ' + teamName(ref, t) : ''}` }, kids);
}

export function tchip(ref, id, { link = true } = {}) {
  return h(link ? 'a' : 'span', { class: 'dchip', href: link ? `#takim/${id}` : null },
    h('span', { class: 'sl', style: { background: teamColor(id) } }), h('span', { class: 'nm' }, teamName(ref, id)));
}

// ---- duzen ----
export function vhead({ title, sub, crumbs, actions }) {
  return h('header', { class: 'vhead' },
    h('div', { class: 'tt' },
      crumbs ? h('nav', { class: 'crumbs', 'aria-label': L('Konum', 'Breadcrumb') }, crumbs.flatMap((c, i) => [i ? h('span', { 'aria-hidden': 'true' }, '/') : null, c.href ? h('a', { href: c.href }, c.label) : h('span', {}, c.label)])) : null,
      h('h1', { class: 't-title' }, title),
      sub ? h('p', { class: 'sub' }, sub) : null),
    actions ? h('div', { class: 'acts' }, actions) : null);
}

export function card(title, body, { more, cls, flush, actions } = {}) {
  return h('section', { class: ['card', flush && 'flush', cls] },
    title || more || actions ? h('header', {}, title ? h('h2', {}, title) : null, h('span', { class: 'sp' }), actions || null, more ? h('a', { class: 'more', href: more.href }, more.label) : null) : null,
    body);
}

export function seg(options, value, onChange, { label } = {}) {
  const wrap = h('div', { class: 'seg', role: 'group', 'aria-label': label || null });
  const render = (v) => {
    clear(wrap);
    for (const o of options) {
      wrap.appendChild(h('button', { type: 'button', class: o.value === v ? 'on' : null, 'aria-pressed': String(o.value === v), onClick: () => { render(o.value); onChange(o.value); } }, o.label));
    }
  };
  render(value);
  return wrap;
}

export function tabs(items, active) {
  return h('nav', { class: 'tabs', 'aria-label': L('Bölümler', 'Sections') },
    items.map((it) => h('a', { href: it.href, class: it.key === active ? 'on' : null, 'aria-current': it.key === active ? 'page' : null }, it.label)));
}

export function select(options, value, onChange, attrs = {}) {
  const el = h('select', { ...attrs, onChange: (e) => onChange(e.target.value) },
    options.map((o) => (o.group ? h('optgroup', { label: o.group }, o.items.map((x) => h('option', { value: x.value, selected: x.value === value }, x.label))) : h('option', { value: o.value, selected: o.value === value }, o.label))));
  return el;
}

export const loading = () => h('div', { class: 'loading', role: 'status' }, h('div', {}, h('div', { class: 'bar-l' }), h('p', { class: 'dim t-small', style: { marginTop: '12px' } }, L('Yükleniyor', 'Loading'))));
export const empty = (title, text, action) => h('div', { class: 'empty' }, h('h3', {}, title), text ? h('p', { style: { margin: 0 } }, text) : null, action ? h('div', { class: 'mt' }, action) : null);
export const errorBox = (text) => h('div', { class: 'err' }, text);

// ---- bildirim ----
export function toast(msg, ms = 2600) {
  let area = document.querySelector('.toast-area');
  if (!area) document.body.appendChild((area = h('div', { class: 'toast-area', role: 'status', 'aria-live': 'polite' })));
  const t = h('div', { class: 'toast' }, msg);
  area.appendChild(t);
  setTimeout(() => t.remove(), ms);
}

// ---- modal ----
export function modal(title, body, { actions = [], onClose } = {}) {
  const prev = document.activeElement;
  const close = () => { bg.remove(); document.removeEventListener('keydown', onKey); onClose?.(); prev?.focus?.(); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const box = h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    h('div', { class: 'row' }, h('h2', { style: { flex: 1, margin: 0 } }, title), h('button', { class: 'iconbtn', 'aria-label': L('Kapat', 'Close'), onClick: close }, icon('x'))),
    h('div', { class: 'mt' }, body),
    actions.length ? h('div', { class: 'row wrap mt', style: { justifyContent: 'flex-end' } }, actions.map((a) => h('button', { class: ['btn', a.primary && 'pri'], onClick: () => { if (a.onClick?.() !== false) close(); } }, a.label))) : null);
  const bg = h('div', { class: 'modal-bg', onClick: (e) => { if (e.target === bg) close(); } }, box);
  document.body.appendChild(bg);
  document.addEventListener('keydown', onKey);
  setTimeout(() => box.querySelector('button, select, input, textarea, a')?.focus(), 30);
  return { close, box };
}

// ---- alt menu tabakasi (mobil) ----
export function sheet(content) {
  const bg = h('div', { class: 'sheet-bg' });
  const sh = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': L('Menü', 'Menu') }, h('div', { class: 'grab' }), content);
  const close = () => { bg.classList.remove('on'); sh.classList.remove('on'); setTimeout(() => { bg.remove(); sh.remove(); }, 220); window.removeEventListener('hashchange', close); };
  bg.addEventListener('click', close);
  document.body.append(bg, sh);
  requestAnimationFrame(() => { bg.classList.add('on'); sh.classList.add('on'); });
  window.addEventListener('hashchange', close);
  return close;
}

// ---- geri sayim ----
export function countdown(target, { onDone } = {}) {
  const box = h('div', { class: 'cd', role: 'timer', 'aria-live': 'off' });
  const parts = [['d', L('gün', 'days')], ['h', L('saat', 'hrs')], ['m', L('dakika', 'min')], ['s', L('saniye', 'sec')]];
  const vals = {};
  parts.forEach(([k, label], i) => {
    if (i) box.appendChild(h('span', { class: 'sep', 'aria-hidden': 'true' }, ':'));
    vals[k] = h('span', { class: 'v' }, '00');
    box.appendChild(h('div', { class: 'u' }, vals[k], h('span', { class: 'k' }, label)));
  });
  const tick = () => {
    let d = Math.max(0, target - Date.now());
    const D = Math.floor(d / 86400000); d -= D * 86400000;
    const H = Math.floor(d / 3600000); d -= H * 3600000;
    const M = Math.floor(d / 60000); d -= M * 60000;
    const S = Math.floor(d / 1000);
    vals.d.textContent = String(D).padStart(2, '0');
    vals.h.textContent = String(H).padStart(2, '0');
    vals.m.textContent = String(M).padStart(2, '0');
    vals.s.textContent = String(S).padStart(2, '0');
    if (target - Date.now() <= 0) { clearInterval(iv); onDone?.(); }
  };
  tick();
  const iv = setInterval(tick, 1000);
  onCleanup(() => clearInterval(iv));
  return box;
}

// ---- spoiler kalkani ----
export function spoilerActive(key, raceEndMs, now = Date.now()) {
  const p = store.get();
  if (!p.spoiler?.on || p.spoiler.revealed?.[key]) return false;
  if (!raceEndMs) return false;
  return now - raceEndMs < (p.spoiler.days || 4) * 86400000;
}

export function spoiler(key, raceEndMs, content, { label } = {}) {
  if (!spoilerActive(key, raceEndMs)) return content;
  const wrap = h('div', { class: 'spoiler' }, content);
  const veil = h('div', { class: 'veil' }, h('div', { class: 'box' },
    icon('eyeOff'),
    h('p', {}, label || L('Spoiler kalkanı açık: bu yarışın sonuçları gizli.', 'Spoiler shield is on: results for this race are hidden.')),
    h('button', { class: 'btn sm', onClick: () => { store.update((p) => { p.spoiler.revealed[key] = Date.now(); }); window.dispatchEvent(new HashChangeEvent('hashchange')); } }, L('Sonuçları göster', 'Show results'))));
  wrap.appendChild(veil);
  return wrap;
}

export function footer(meta) {
  return h('footer', { class: 'footer' },
    h('p', { style: { margin: 0 } },
      L('Veriler: ', 'Data: '), h('a', { href: 'https://github.com/f1db/f1db', target: '_blank', rel: 'noopener' }, 'F1DB'), ' (CC BY 4.0), ',
      h('a', { href: 'https://openf1.org', target: '_blank', rel: 'noopener' }, 'OpenF1'), ', ',
      h('a', { href: 'https://github.com/bacinger/f1-circuits', target: '_blank', rel: 'noopener' }, 'f1-circuits'), ', ',
      h('a', { href: 'https://open-meteo.com', target: '_blank', rel: 'noopener' }, 'Open-Meteo'), L(' ve haber kaynaklarının RSS akışları.', ' and the news sources’ RSS feeds.')),
    h('p', { style: { margin: '4px 0 0' } }, L('Resmi olmayan bir hayran projesidir; Formula 1, FIA ya da takımlarla bağı yoktur.', 'An unofficial fan project, not affiliated with Formula 1, the FIA or any team.'),
      meta?.generated ? ` ${L('Son güncelleme', 'Last update')}: ${new Date(meta.generated).toLocaleString()}` : ''));
}
