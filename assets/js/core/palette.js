// Hizli arama (Ctrl+K ya da /): sayfalar, pilotlar, takimlar, yarislar ve pistler arasinda zipla.
import { h, clear } from './util.js';
import { L, gpName, driverName, teamName, circuitName } from './i18n.js';
import { teamColor } from './colors.js';
import { icon } from './ui.js';
import { weekendRange } from '../views/common.js';

let open = null;

// Turkce buyuk/kucuk harf ve aksan farkini yok say
const norm = (x) => String(x || '').toLocaleLowerCase('tr').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i');

function buildIndex(ctx, nav) {
  const { ref, seasons } = ctx;
  const items = [];
  for (const n of nav) if (!n.grp) items.push({ kind: L('Sayfa', 'Page'), t: L(n.tr, n.en), href: `#${n.key}`, ic: n.icon, rank: 0 });
  const cur = seasons[0];
  const seenD = new Set(), seenT = new Set();
  for (const x of ref.lineup || []) {
    if (!seenD.has(x.d)) {
      seenD.add(x.d);
      items.push({ kind: L('Pilot', 'Driver'), t: driverName(ref, x.d), sub: `${x.code || driverName(ref, x.d, 'code')} · ${teamName(ref, x.t)}`, href: `#surucu/${x.d}`, color: teamColor(x.t), extra: x.code, rank: 1 });
    }
    if (!seenT.has(x.t)) {
      seenT.add(x.t);
      items.push({ kind: L('Takım', 'Team'), t: teamName(ref, x.t), href: `#takim/${x.t}`, color: teamColor(x.t), rank: 2 });
    }
  }
  for (const S of seasons) {
    for (const r of S?.races || []) {
      items.push({ kind: `${S.year} · ${r.r}. ${L('yarış', 'round')}`, t: gpName(ref, r.gp), sub: `${circuitName(ref, r.c)} · ${weekendRange(r)}`, href: `#yaris/${S.year}/${r.r}`, ic: 'flag', extra: r.c, rank: S === cur ? 3 : 4 });
    }
  }
  const seenC = new Set();
  for (const r of cur?.races || []) {
    if (seenC.has(r.c)) continue;
    seenC.add(r.c);
    items.push({ kind: L('Pist', 'Circuit'), t: circuitName(ref, r.c), sub: ref.circuits?.[r.c]?.p, href: `#pist/${r.c}`, ic: 'map', rank: 5 });
  }
  for (const it of items) it.key = norm([it.t, it.sub, it.extra, it.kind].join(' '));
  return items;
}

function search(items, q) {
  const words = norm(q).split(/\s+/).filter(Boolean);
  if (!words.length) return items.filter((x) => x.rank <= 1).slice(0, 12);
  const scored = [];
  for (const it of items) {
    if (!words.every((w) => it.key.includes(w))) continue;
    const tn = norm(it.t);
    const score = (tn.startsWith(words[0]) ? 0 : tn.includes(words[0]) ? 1 : 2) * 10 + it.rank;
    scored.push([score, it]);
  }
  return scored.sort((a, b) => a[0] - b[0]).slice(0, 14).map((x) => x[1]);
}

export function openPalette(ctx, nav) {
  if (open || !ctx) return;
  const items = buildIndex(ctx, nav);
  let sel = 0, shown = [];
  const input = h('input', { type: 'search', placeholder: L('Pilot, takım, yarış, pist ya da sayfa ara…', 'Search drivers, teams, races, circuits or pages…'), 'aria-label': L('Hızlı arama', 'Quick search'), autocomplete: 'off', spellcheck: 'false' });
  const list = h('div', { class: 'pal-list', role: 'listbox' });
  const box = h('div', { class: 'pal', role: 'dialog', 'aria-modal': 'true', 'aria-label': L('Hızlı arama', 'Quick search') },
    h('div', { class: 'pal-in' }, icon('search'), input, h('kbd', {}, 'Esc')), list,
    h('div', { class: 'pal-foot' }, h('span', {}, h('kbd', {}, '↑'), h('kbd', {}, '↓'), L(' seç', ' select')), h('span', {}, h('kbd', {}, 'Enter'), L(' aç', ' open')), h('span', { class: 'sp' }), h('span', {}, h('kbd', {}, 'Ctrl'), h('kbd', {}, 'K'))));
  const bg = h('div', { class: 'modal-bg pal-bg', onClick: (e) => { if (e.target === bg) close(); } }, box);

  const go = (it) => { if (!it) return; close(); location.hash = it.href; };
  const paint = () => {
    shown = search(items, input.value);
    sel = Math.min(sel, Math.max(0, shown.length - 1));
    clear(list);
    if (!shown.length) list.appendChild(h('div', { class: 'pal-empty' }, L('Sonuç yok.', 'No results.')));
    shown.forEach((it, i) => list.appendChild(h('a', { class: ['pal-it', i === sel && 'on'], href: it.href, role: 'option', 'aria-selected': String(i === sel), onClick: (e) => { e.preventDefault(); go(it); }, onMousemove: () => { if (sel !== i) { sel = i; mark(); } } },
      it.color ? h('span', { class: 'pal-bar', style: { background: it.color } }) : h('span', { class: 'pal-ic' }, icon(it.ic || 'search')),
      h('span', { class: 'pal-t' }, h('span', { class: 'ellip' }, it.t), it.sub ? h('span', { class: 'pal-s ellip' }, it.sub) : null),
      h('span', { class: 'pal-k' }, it.kind))));
  };
  const mark = () => [...list.children].forEach((el, i) => { el.classList.toggle('on', i === sel); if (i === sel) el.scrollIntoView({ block: 'nearest' }); });
  input.addEventListener('input', () => { sel = 0; paint(); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(sel + 1, shown.length - 1); mark(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(sel - 1, 0); mark(); }
    else if (e.key === 'Enter') { e.preventDefault(); go(shown[sel]); }
    else if (e.key === 'Escape') { e.preventDefault(); close(); }
  });
  function close() { bg.remove(); open = null; window.removeEventListener('hashchange', close); }
  window.addEventListener('hashchange', close);
  document.body.appendChild(bg);
  open = close;
  paint();
  input.focus();
}

// Klavye: Ctrl/Cmd+K her yerde, "/" yazi alani disinda
export function bindPalette(getCtx, nav) {
  window.addEventListener('keydown', (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '') || document.activeElement?.isContentEditable;
    if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); open ? open() : openPalette(getCtx(), nav); }
    else if (e.key === '/' && !typing && !open) { e.preventDefault(); openPalette(getCtx(), nav); }
  });
}
