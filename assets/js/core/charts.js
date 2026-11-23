// SVG grafikleri: cizgi (puan / siralama / tur suresi), telemetri panelleri, stint cizelgesi.
// Ince cizgiler, sessiz izgara, ust uste binen etiketleri iten uc etiketleri, her grafikte tablo gorunumu.
import { h, s, clear } from './util.js';
import { L } from './i18n.js';
import { onCleanup } from './ui.js';

let tipEl = null;
function tip() {
  if (!tipEl) document.body.appendChild((tipEl = h('div', { class: 'tip', role: 'tooltip' })));
  return tipEl;
}
export function showTip(x, y, content) {
  const t = tip();
  clear(t);
  t.appendChild(content);
  t.classList.add('on');
  const r = t.getBoundingClientRect();
  let left = x + 14, top = y + 14;
  if (left + r.width > window.innerWidth - 8) left = x - r.width - 14;
  if (top + r.height > window.innerHeight - 8) top = y - r.height - 14;
  t.style.left = Math.max(8, left) + 'px';
  t.style.top = Math.max(8, top) + 'px';
}
export const hideTip = () => tipEl?.classList.remove('on');

function niceTicks(min, max, count = 5) {
  if (min === max) { min -= 1; max += 1; }
  const span = max - min;
  const step0 = span / count;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((st) => span / st <= count) || 10 * mag;
  const start = Math.floor(min / step) * step;
  const ticks = [];
  for (let v = start; v <= max + step * 0.001; v += step) if (v >= min - step * 0.001) ticks.push(Math.round(v * 1e6) / 1e6);
  return { ticks, min: Math.min(start, min), max: Math.max(ticks[ticks.length - 1], max) };
}

function spread(items, minGap, lo, hi) {
  // etiketleri dikeyde it: items [{y}] -> y degerlerini ayarlar
  items.sort((a, b) => a.y - b.y);
  for (let i = 1; i < items.length; i++) if (items[i].y - items[i - 1].y < minGap) items[i].y = items[i - 1].y + minGap;
  const over = items.length ? items[items.length - 1].y - hi : 0;
  if (over > 0) {
    items[items.length - 1].y -= over;
    for (let i = items.length - 2; i >= 0; i--) if (items[i + 1].y - items[i].y < minGap) items[i].y = items[i + 1].y - minGap;
  }
  if (items.length && items[0].y < lo) { const d = lo - items[0].y; for (const it of items) it.y += d; }
}

function responsive(container, draw) {
  let w = 0;
  const ro = new ResizeObserver(() => {
    const nw = Math.round(container.clientWidth);
    if (nw && nw !== w) { w = nw; draw(w); }
  });
  ro.observe(container);
  onCleanup(() => ro.disconnect());
}

/**
 * Cizgi grafigi.
 * series: [{ id, label, color, dash, values:[..] }]   labels: x kategorileri
 */
export function lineChart(o) {
  const {
    series, labels, height = 300, invert = false, yFmt = (v) => String(v), xFmt = (l) => l, endLabels = true,
    tipTitle = (i) => xFmt(labels[i], i), sortTip = invert ? 'asc' : 'desc', legend = true, yMin, yMax, highlight = [], ariaLabel
  } = o;
  const hidden = new Set(o.hidden || []);
  let focus = null;
  const box = h('div', { class: 'chart' });
  const svgWrap = h('div', { role: 'img', 'aria-label': ariaLabel || L('Grafik', 'Chart') });
  box.appendChild(svgWrap);
  const legendEl = legend ? h('div', { class: 'legend' }) : null;
  if (legendEl) box.appendChild(legendEl);

  const renderLegend = () => {
    if (!legendEl) return;
    clear(legendEl);
    for (const sr of series) {
      legendEl.appendChild(h('button', {
        type: 'button', class: hidden.has(sr.id) ? 'off' : null, 'aria-pressed': String(!hidden.has(sr.id)),
        onClick: () => { hidden.has(sr.id) ? hidden.delete(sr.id) : hidden.add(sr.id); renderLegend(); draw(lastW); },
        onMouseenter: () => { focus = sr.id; draw(lastW); }, onMouseleave: () => { focus = null; draw(lastW); }
      }, h('span', { class: ['sw', sr.dash && 'dash'], style: { background: sr.color, color: sr.color } }), sr.label));
    }
  };

  let lastW = 0;
  function draw(W) {
    lastW = W;
    if (!W) return;
    clear(svgWrap);
    const vis = series.filter((sr) => !hidden.has(sr.id));
    const n = labels.length;
    const m = { l: 40, r: endLabels ? 62 : 14, t: 10, b: 28 };
    const H = height;
    let lo = Infinity, hi = -Infinity;
    for (const sr of vis) for (const v of sr.values) if (v != null) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
    if (!isFinite(lo)) { lo = 0; hi = 1; }
    if (yMin != null) lo = yMin;
    if (yMax != null) hi = yMax;
    const nt = invert ? { ticks: [1, 5, 10, 15, 20].filter((t) => t <= Math.max(hi, 2)), min: 1, max: Math.max(hi, 2) } : niceTicks(lo, hi, H > 220 ? 5 : 4);
    const y0 = invert ? 1 : nt.min, y1 = invert ? nt.max : nt.max;
    const pw = W - m.l - m.r, ph = H - m.t - m.b;
    const X = (i) => m.l + (n <= 1 ? pw / 2 : (i * pw) / (n - 1));
    const Y = (v) => (invert ? m.t + ((v - y0) / (y1 - y0 || 1)) * ph : m.t + ph - ((v - y0) / (y1 - y0 || 1)) * ph);
    const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H });
    const grid = s('g', { class: 'grid' });
    const axis = s('g', { class: 'axis' });
    for (const tv of nt.ticks) {
      grid.appendChild(s('line', { x1: m.l, x2: W - m.r, y1: Y(tv), y2: Y(tv) }));
      axis.appendChild(s('text', { x: m.l - 8, y: Y(tv) + 4, 'text-anchor': 'end' }, yFmt(tv)));
    }
    const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(pw / 46))));
    for (let i = 0; i < n; i++) if (i % every === 0 || i === n - 1) axis.appendChild(s('text', { x: X(i), y: H - 8, 'text-anchor': 'middle' }, xFmt(labels[i], i, true)));
    svg.append(grid, axis);
    const lines = s('g');
    const ends = [];
    for (const sr of vis) {
      let d = '', pen = false;
      sr.values.forEach((v, i) => {
        if (v == null) { pen = false; return; }
        d += `${pen ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`;
        pen = true;
      });
      const dim = (focus && focus !== sr.id) || (highlight.length && !highlight.includes(sr.id) && !focus);
      const p = s('path', { class: ['ln', dim && 'dim', (focus === sr.id || highlight.includes(sr.id)) && 'hi'], d, stroke: sr.color });
      if (sr.dash) p.setAttribute('stroke-dasharray', '5 4');
      lines.appendChild(p);
      if (endLabels) {
        let li = sr.values.length - 1;
        while (li >= 0 && sr.values[li] == null) li--;
        if (li >= 0) ends.push({ y: Y(sr.values[li]), x: X(li), sr, dim });
      }
    }
    svg.appendChild(lines);
    if (endLabels && ends.length) {
      spread(ends, 12, m.t, H - m.b);
      const g = s('g');
      for (const e of ends) g.appendChild(s('text', { class: 'lbl', x: W - m.r + 6, y: e.y + 4, fill: e.sr.color, opacity: e.dim ? 0.3 : 1 }, e.sr.short || e.sr.label));
      svg.appendChild(g);
    }
    // gezinme katmani
    const xh = s('line', { class: 'xh', y1: m.t, y2: H - m.b, x1: 0, x2: 0, visibility: 'hidden' });
    const dots = s('g');
    svg.append(xh, dots);
    const hit = s('rect', { x: m.l - 10, y: 0, width: pw + 20, height: H, fill: 'transparent', tabindex: 0, 'aria-label': L('Değerleri görmek için üzerinde gezin', 'Hover to read values') });
    const at = (i, cx, cy) => {
      xh.setAttribute('x1', X(i)); xh.setAttribute('x2', X(i)); xh.setAttribute('visibility', 'visible');
      clear(dots);
      const rows = vis.map((sr) => ({ sr, v: sr.values[i] })).filter((r) => r.v != null)
        .sort((a, b) => (sortTip === 'asc' ? a.v - b.v : b.v - a.v));
      for (const r of rows) dots.appendChild(s('circle', { cx: X(i), cy: Y(r.v), r: 4, fill: r.sr.color, stroke: 'var(--bg-2)', 'stroke-width': 2 }));
      const content = h('div', {}, h('div', { class: 'tt' }, tipTitle(i)),
        rows.slice(0, 12).map((r) => h('div', { class: 'tr' }, h('span', { class: 'tdot', style: { background: r.sr.color } }), h('span', {}, r.sr.label), h('span', { class: 'sp' }), h('strong', {}, (o.tipValue || ((sr, v) => yFmt(v)))(r.sr, r.v, i)))),
        rows.length > 12 ? h('div', { class: 'dim', style: { marginTop: '4px' } }, `+${rows.length - 12}`) : null);
      showTip(cx, cy, content);
    };
    const move = (ev) => {
      const r = svg.getBoundingClientRect();
      const px = ((ev.clientX - r.left) / r.width) * W;
      const i = Math.max(0, Math.min(n - 1, Math.round(((px - m.l) / (pw || 1)) * (n - 1))));
      at(i, ev.clientX, ev.clientY);
    };
    let kbI = n - 1;
    hit.addEventListener('pointermove', move);
    hit.addEventListener('pointerdown', move);
    hit.addEventListener('pointerleave', () => { hideTip(); clear(dots); xh.setAttribute('visibility', 'hidden'); });
    hit.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      kbI = Math.max(0, Math.min(n - 1, kbI + (e.key === 'ArrowRight' ? 1 : -1)));
      const r = svg.getBoundingClientRect();
      at(kbI, r.left + (X(kbI) / W) * r.width, r.top + 20);
      e.preventDefault();
    });
    hit.addEventListener('blur', hideTip);
    svg.appendChild(hit);
    svgWrap.appendChild(svg);
  }
  renderLegend();
  responsive(box, draw);
  return box;
}

// Grafik + tablo gorunumu ikilisi
export function chartCard(title, chartEl, tableFn, { note, actions } = {}) {
  const body = h('div', {});
  let mode = 'chart';
  const tbl = () => h('div', { class: 'tbl-wrap' }, tableFn());
  const toggle = h('div', { class: 'seg vt', role: 'group' });
  const render = () => {
    clear(body);
    body.appendChild(mode === 'chart' ? chartEl : tbl());
    clear(toggle);
    for (const [k, lbl] of [['chart', L('Grafik', 'Chart')], ['table', L('Tablo', 'Table')]]) toggle.appendChild(h('button', { type: 'button', class: mode === k ? 'on' : null, onClick: () => { mode = k; render(); } }, lbl));
  };
  render();
  return h('section', { class: 'card chart-card' },
    h('header', {}, h('h2', {}, title), h('span', { class: 'sp' }), actions || null, toggle),
    body, note ? h('p', { class: 'foot-note' }, note) : null);
}

// Yatay cubuk listesi (siralamali)
export function barList(items, { fmt = (v) => v, max } = {}) {
  const mx = max ?? Math.max(...items.map((i) => i.value), 1);
  return h('div', { class: 'list' }, items.map((it, idx) => h(it.href ? 'a' : 'div', { class: 'li', href: it.href || null },
    h('span', { class: 'dim num', style: { width: '22px', textAlign: 'right', flex: 'none' } }, idx + 1),
    h('div', { style: { flex: 1, minWidth: 0 } },
      h('div', { class: 'row' }, h('span', { class: 'li-t ellip' }, it.label), h('span', { class: 'sp' }), h('strong', { class: 'num' }, fmt(it.value))),
      it.sub ? h('div', { class: 'li-s' }, it.sub) : null,
      h('div', { style: { height: '4px', borderRadius: '3px', background: 'var(--bg-4)', marginTop: '6px' } },
        h('div', { style: { width: `${Math.max(2, (100 * it.value) / mx)}%`, height: '100%', borderRadius: '3px', background: it.color || 'var(--ink-2)' } }))))));
}

/**
 * Telemetri: ortak x eksenli (mesafe, m) ust uste paneller.
 * panels: [{ key, label, height, min, max, fmt, step?:bool, series:[{label, color, dash, pts:[[x,y]]}] }]
 */
export function teleChart(panels, { xMax, xFmt = (x) => `${Math.round(x)} m`, onX } = {}) {
  const box = h('div', { class: 'chart' });
  let lastW = 0;
  const find = (pts, x) => {
    let lo = 0, hi = pts.length - 1;
    if (!pts.length) return null;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (pts[mid][0] < x) lo = mid; else hi = mid; }
    return Math.abs(pts[lo][0] - x) < Math.abs(pts[hi][0] - x) ? pts[lo] : pts[hi];
  };
  function draw(W) {
    lastW = W;
    clear(box);
    const m = { l: 46, r: 12 };
    const gap = 10;
    const totalH = panels.reduce((acc, p) => acc + p.height + gap, 0) + 22;
    const svg = s('svg', { viewBox: `0 0 ${W} ${totalH}`, width: W, height: totalH });
    const pw = W - m.l - m.r;
    const X = (x) => m.l + (x / xMax) * pw;
    let top = 0;
    const layout = [];
    for (const p of panels) {
      const Y = (v) => top + p.height - ((v - p.min) / (p.max - p.min || 1)) * p.height;
      const g = s('g');
      g.appendChild(s('rect', { x: m.l, y: top, width: pw, height: p.height, fill: 'var(--bg)', rx: 6 }));
      for (const tv of p.ticks || [p.min, p.max]) {
        g.appendChild(s('line', { x1: m.l, x2: W - m.r, y1: Y(tv), y2: Y(tv), stroke: 'var(--line)' }));
        g.appendChild(s('text', { x: m.l - 6, y: Y(tv) + 4, 'text-anchor': 'end', fill: 'var(--ink-3)', 'font-size': 10 }, p.fmt ? p.fmt(tv) : tv));
      }
      g.appendChild(s('text', { x: m.l + 6, y: top + 13, fill: 'var(--ink-2)', 'font-size': 11, 'font-weight': 700 }, p.label));
      for (const sr of p.series) {
        let d = '';
        sr.pts.forEach(([x, y], i) => { d += `${i ? 'L' : 'M'}${X(x).toFixed(1)} ${Y(y).toFixed(1)}`; });
        const path = s('path', { d, fill: 'none', stroke: sr.color, 'stroke-width': 1.8, 'stroke-linejoin': 'round' });
        if (sr.dash) path.setAttribute('stroke-dasharray', '5 3');
        g.appendChild(path);
      }
      svg.appendChild(g);
      layout.push({ p, top, Y });
      top += p.height + gap;
    }
    const axis = s('g');
    const steps = Math.max(2, Math.floor(pw / 90));
    for (let i = 0; i <= steps; i++) {
      const x = (xMax * i) / steps;
      axis.appendChild(s('text', { x: X(x), y: top + 12, 'text-anchor': i === 0 ? 'start' : i === steps ? 'end' : 'middle', fill: 'var(--ink-3)', 'font-size': 10 }, xFmt(x)));
    }
    svg.appendChild(axis);
    const xh = s('line', { y1: 0, y2: top - gap, x1: 0, x2: 0, stroke: 'var(--ink-3)', visibility: 'hidden' });
    svg.appendChild(xh);
    const hit = s('rect', { x: m.l, y: 0, width: pw, height: top, fill: 'transparent' });
    hit.addEventListener('pointermove', (ev) => {
      const r = svg.getBoundingClientRect();
      const px = ((ev.clientX - r.left) / r.width) * W;
      const x = Math.max(0, Math.min(xMax, ((px - m.l) / pw) * xMax));
      xh.setAttribute('x1', X(x)); xh.setAttribute('x2', X(x)); xh.setAttribute('visibility', 'visible');
      const content = h('div', {}, h('div', { class: 'tt' }, xFmt(x)),
        layout.map(({ p }) => h('div', { style: { marginTop: '3px' } }, h('div', { class: 'dim', style: { fontSize: '0.74rem' } }, p.label),
          p.series.map((sr) => { const pt = find(sr.pts, x); return h('div', { class: 'tr' }, h('span', { class: 'tdot', style: { background: sr.color } }), h('span', {}, sr.label), h('span', { class: 'sp' }), h('strong', {}, pt ? (p.fmt ? p.fmt(pt[1]) : pt[1]) : '–')); }))));
      showTip(ev.clientX, ev.clientY, content);
      onX?.(x);
    });
    hit.addEventListener('pointerleave', () => { hideTip(); xh.setAttribute('visibility', 'hidden'); onX?.(null); });
    svg.appendChild(hit);
    box.appendChild(svg);
  }
  responsive(box, draw);
  return box;
}
