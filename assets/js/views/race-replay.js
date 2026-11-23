// Pist tekrari (deneysel): araclari tur sonu gecis zamanlarindan pist cizgisi uzerinde hareket ettirir.
import { h, s, clear } from '../core/util.js';
import { L, nf } from '../core/i18n.js';
import * as data from '../core/data.js';
import { empty, icon, seg, onCleanup } from '../core/ui.js';
import { driverMeta } from './race-story.js';

export async function replayView(ctx, season, race) {
  const { ref, profile } = ctx;
  let story;
  try { story = await data.story(season.year, race.r); } catch { return empty(L('Tekrar hazır değil', 'Replay not ready'), null); }
  if (!story.trk?.pts?.length) return empty(L('Pist çizgisi yok', 'No track outline'), L('Bu yarış için konum verisi alınamadı.', 'Position data was not available for this race.'));
  const dm = driverMeta(story, ref, race);

  // pist cizgisi: OpenF1 x/y (y yukari) -> SVG
  const P = story.trk.pts;
  const xs = P.map((p) => p[0]), ys = P.map((p) => -p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const pad = 400;
  const vb = [minX - pad, minY - pad, maxX - minX + 2 * pad, maxY - minY + 2 * pad];
  const scale = Math.max(vb[2], vb[3]) / 1000;
  const d = 'M' + P.map((p) => `${p[0]} ${-p[1]}`).join('L') + 'Z';
  const tf = P.map((p) => p[2]);
  const pointAt = (f) => {
    f = ((f % 1) + 1) % 1;
    let lo = 0, hi = tf.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (tf[mid] <= f) lo = mid; else hi = mid; }
    const a = P[lo], b = P[hi] || P[0];
    const span = (tf[hi] ?? 1) - tf[lo] || 1;
    const k = Math.max(0, Math.min(1, (f - tf[lo]) / span));
    return [a[0] + (b[0] - a[0]) * k, -(a[1] + (b[1] - a[1]) * k)];
  };

  // her surucu icin tur sonu zamanlari
  const drivers = Object.keys(story.lap).filter((no) => dm[no]);
  const ends = {};
  for (const no of drivers) ends[no] = story.lap[no].map((r) => r[5]);
  const tMax = Math.max(...drivers.flatMap((no) => ends[no].filter((x) => x != null)));
  const firstLapStart = 0;
  const grid = {};
  for (const x of race.res || []) if (x.no) grid[String(x.no)] = x.g || 20;

  const state = { t: 0, playing: false, speed: 20 };
  const svg = s('svg', { class: 'trk', viewBox: vb.join(' '), role: 'img', 'aria-label': L('Pist tekrarı', 'Track replay') },
    s('path', { class: 'base', d, style: `stroke-width:${18 * scale}` }), s('path', { class: 'line', d, style: `stroke-width:${2 * scale}` }));
  const favNos = new Set(drivers.filter((no) => profile.favDrivers.includes(dm[no].d)));
  const cars = {};
  for (const no of drivers) {
    const g = s('g', { class: 'car' });
    const r = (favNos.has(no) ? 11 : 9) * scale;
    g.append(s('circle', { r, fill: dm[no].color, style: `stroke-width:${2 * scale}` }), s('text', { x: r + 3 * scale, y: 5 * scale, style: `font-size:${15 * scale}px;stroke-width:${4 * scale}px` }, dm[no].code));
    svg.appendChild(g);
    cars[no] = g;
  }
  const banner = h('div', { class: 'badge', style: { visibility: 'hidden' } });
  const lapEl = h('strong', { class: 'num' });
  const order = h('ol', { class: 'order list', style: { margin: 0, paddingLeft: '22px' } });
  const range = h('input', { type: 'range', min: 0, max: Math.ceil(tMax), step: 1, value: 0, 'aria-label': L('Yarış zamanı', 'Race time'), onInput: (e) => { state.t = Number(e.target.value); frame(); } });
  const playBtn = h('button', { class: 'btn pri sm', type: 'button', onClick: () => { state.playing = !state.playing; if (state.playing && state.t >= tMax) state.t = 0; sync(); last = performance.now(); if (state.playing) raf = requestAnimationFrame(loop); } });

  function where(no, t) {
    const e = ends[no];
    let lap = 0;
    while (lap < e.length && e[lap] != null && e[lap] <= t) lap++;
    if (lap >= e.length || e[lap] == null) {
      const lastEnd = e.filter((x) => x != null).pop() ?? 0;
      const out = lap < story.laps && t > lastEnd + 200 && lastEnd < tMax - 300;
      // bitirenler arasinda once gecen onde
      return { lap, frac: 0, done: true, out, total: lap + 0.5 * (1 - lastEnd / (tMax + 1)) };
    }
    const start = lap === 0 ? firstLapStart : e[lap - 1];
    let frac = Math.max(0, Math.min(0.999, (t - start) / (e[lap] - start || 1)));
    // ilk turda araclar start cizgisinin gerisindeki grid yerlerinden baslar
    if (lap === 0) frac -= (1 - frac) * (grid[no] || 20) * 0.0028;
    return { lap, frac, done: false, total: lap + frac };
  }

  function frame() {
    const t = state.t;
    const ws = drivers.map((no) => ({ no, ...where(no, t) }));
    for (const w of ws) {
      const [x, y] = pointAt(w.done ? 0 : w.frac);
      cars[w.no].setAttribute('transform', `translate(${x} ${y})`);
      cars[w.no].style.opacity = w.out ? 0.25 : 1;
    }
    const leaderLap = Math.max(...ws.map((w) => w.lap));
    lapEl.textContent = L(`${Math.min(leaderLap + 1, story.laps)}. tur / ${story.laps}`, `Lap ${Math.min(leaderLap + 1, story.laps)} / ${story.laps}`);
    const sc = (story.sc || []).find(([, , , a, b]) => a != null && t >= a && t <= (b ?? Infinity));
    banner.style.visibility = sc ? 'visible' : 'hidden';
    banner.className = 'badge ' + (sc?.[0] === 'RED' ? 'bad' : '');
    banner.textContent = sc ? (sc[0] === 'SC' ? L('Güvenlik aracı', 'Safety car') : sc[0] === 'VSC' ? L('Sanal güvenlik aracı', 'Virtual safety car') : L('Kırmızı bayrak', 'Red flag')) : '';
    const sorted = ws.slice().sort((a, b) => (b.out ? -1 : b.total) - (a.out ? -1 : a.total));
    clear(order);
    sorted.slice(0, 20).forEach((w) => order.appendChild(h('li', { style: { padding: '2px 0', opacity: w.out ? 0.4 : 1 } }, h('span', { class: 'row', style: { gap: '6px' } }, h('span', { class: 'tdot', style: { background: dm[w.no].color } }), h('strong', {}, dm[w.no].code), w.out ? h('span', { class: 'dim' }, L('dışarıda', 'out')) : null))));
    range.value = Math.round(t);
  }
  const sync = () => { clear(playBtn).append(icon(state.playing ? 'pause' : 'play'), state.playing ? L('Durdur', 'Pause') : L('Oynat', 'Play')); };
  let raf = 0, last = 0;
  function loop(now) {
    const dt = (now - last) / 1000;
    last = now;
    state.t = Math.min(tMax, state.t + dt * state.speed);
    frame();
    if (state.t >= tMax) { state.playing = false; sync(); return; }
    if (state.playing) raf = requestAnimationFrame(loop);
  }
  onCleanup(() => cancelAnimationFrame(raf));
  sync();
  frame();

  const speedSeg = seg([1, 5, 20, 60].map((v) => ({ value: v, label: `${v}×` })), state.speed, (v) => { state.speed = v; }, { label: L('Hız', 'Speed') });
  return h('div', { class: 'stack' },
    h('div', { class: 'replay' },
      h('div', { class: 'card' }, h('div', { class: 'row wrap', style: { marginBottom: '8px' } }, lapEl, banner), svg,
        h('div', { class: 'controls mt' }, playBtn, range, speedSeg)),
      h('div', { class: 'card' }, h('h2', { class: 't-h3', style: { marginBottom: '8px' } }, L('Anlık sıralama', 'Running order')), order)),
    h('p', { class: 'dim t-small' }, L(`Deneysel: araçlar her turun başlangıç ve bitiş zamanına göre, en hızlı turun hız profiliyle pist üzerinde konumlanır. Yarış süresi ${nf(tMax / 60, 0)} dakika; 20× ile yaklaşık ${nf(tMax / 20 / 60, 0)} dakikada izlenir.`,
      `Experimental: cars are placed on track from each lap’s start and end times, using the fastest lap’s speed profile. Race time ${nf(tMax / 60, 0)} min; about ${nf(tMax / 20 / 60, 0)} min at 20×.`)));
}
