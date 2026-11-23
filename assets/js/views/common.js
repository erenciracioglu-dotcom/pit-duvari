// Gorunumlerin paylastigi yaris yardimcilari
import { h, s, isTimed, copyText } from '../core/util.js';
import { L, gpName, fmtDay, fmtTime, sessionLabel, reasonText, tzLabel, circuitName, countryName, fmtRange } from '../core/i18n.js';
import { sessionsOf, calendarUrl } from '../core/data.js';
import { modal, toast, icon, flag } from '../core/ui.js';

export const raceHref = (y, r, tab) => `#yaris/${y}/${r}${tab ? '/' + tab : ''}`;

export function raceEndMs(race) {
  const iso = race.s?.r || race.date;
  if (!iso) return null;
  return isTimed(iso) ? Date.parse(iso) + 2 * 3600000 : Date.parse(iso + 'T00:00:00Z') + 86400000;
}

export function resultValue(x, { lapsLabel = true } = {}) {
  if (x.tm) return x.tm;
  if (x.gap) {
    const m = String(x.gap).match(/^\+?(\d+)\s*laps?$/i);
    if (m) return lapsLabel ? L(`+${m[1]} tur`, `+${m[1]} lap${m[1] === '1' ? '' : 's'}`) : x.gap;
    return x.gap.startsWith('+') ? x.gap : '+' + x.gap;
  }
  if (x.gl) return L(`+${x.gl} tur`, `+${x.gl} laps`);
  if (x.st) return reasonText(x.st);
  if (x.pn == null) return { DNF: L('Bitiremedi', 'DNF'), DNS: L('Start almadı', 'DNS'), DSQ: L('Diskalifiye', 'DSQ'), NC: L('Sınıflandırılmadı', 'NC'), DNQ: L('Kalifiye olamadı', 'DNQ'), DNPQ: L('Ön elemeyi geçemedi', 'DNPQ'), EX: L('İhraç', 'EX') }[x.p] || x.p;
  return '';
}

export function posBadge(x) {
  if (x.pn == null) return h('span', { class: 'dim cond strong' }, x.p);
  return String(x.pn);
}

export function gained(x) {
  if (x.pn == null || x.g == null || x.g === 0) return null;
  const d = x.g - x.pn;
  if (!d) return null;
  return h('span', { class: ['num', d > 0 ? 'pb' : 'bad'] }, d > 0 ? `▲${d}` : `▼${-d}`);
}

export function trackSvg(g, cls, { glow = false } = {}) {
  if (!g) return null;
  const pad = 40;
  return s('svg', { class: cls, viewBox: `${-pad} ${-pad} ${g.w + 2 * pad} ${g.h + 2 * pad}`, preserveAspectRatio: 'xMidYMid meet', 'aria-hidden': 'true' },
    glow ? s('path', { class: 'glow', d: g.d }) : null, s('path', { d: g.d }));
}

export function raceTitle(ref, race) {
  return gpName(ref, race.gp);
}

export function weekendRange(race) {
  const ss = sessionsOf(race);
  const start = race.start || (ss[0] && new Date(ss[0].start).toISOString().slice(0, 10)) || race.date;
  return fmtRange(start, race.date);
}

export function sessionList(race, now = Date.now()) {
  const ss = sessionsOf(race);
  const nextIdx = ss.findIndex((x) => x.end > now);
  return ss.map((x, i) => {
    const live = x.timed && x.start <= now && x.end > now;
    const done = x.end <= now;
    return h('div', { class: ['sess', done && 'done', i === nextIdx && !live && 'next', live && 'live'] },
      h('div', { class: 'n' }, live ? h('span', { class: 'live-dot' }) : null, sessionLabel(x.k)),
      h('div', { class: 'w' }, fmtDay(x.timed ? x.start : x.iso), ' ', x.timed ? fmtTime(x.start) : ''));
  });
}

export function circuitLine(ref, race) {
  const c = ref.circuits[race.c];
  if (!c) return null;
  return h('span', { class: 'row', style: { gap: '8px', display: 'inline-flex' } }, flag(ref, c.nat), `${circuitName(ref, race.c)}, ${c.p}`);
}

export function icsModal() {
  const races = calendarUrl('f1-yarislar.ics');
  const all = calendarUrl('f1-tum-seanslar.ics');
  const webcal = (u) => u.replace(/^https?:/, 'webcal:');
  const row = (title, desc, url) => h('div', { class: 'card', style: { background: 'var(--bg-3)' } },
    h('div', { class: 'strong' }, title), h('p', { class: 'muted t-small', style: { margin: '4px 0 10px' } }, desc),
    h('div', { class: 'row wrap' },
      h('a', { class: 'btn pri sm', href: webcal(url) }, icon('cal'), L('Takvime abone ol', 'Subscribe')),
      h('a', { class: 'btn sm', href: `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcal(url))}`, target: '_blank', rel: 'noopener' }, 'Google Takvim'),
      h('button', { class: 'btn sm ghost', onClick: async () => { toast((await copyText(url)) ? L('Adres kopyalandı.', 'Link copied.') : url); } }, icon('copy'), L('Adresi kopyala', 'Copy link'))));
  modal(L('Takvimine ekle', 'Add to your calendar'), h('div', { class: 'stack' },
    h('p', { class: 'muted', style: { margin: 0 } }, L(`Abonelik bir kere kurulur; saat değişiklikleri ve yeni sezon kendiliğinden gelir. Saatler telefonunun saat diliminde görünür; yarış, sıralama ve sprintten 30 dakika önce hatırlatma vardır.`,
      `Subscribe once; schedule changes and next season arrive automatically. Times show in your phone’s time zone, with a reminder 30 minutes before races, qualifying and sprints.`)),
    row(L('Yalnızca yarışlar ve sprintler', 'Races and sprints only'), L('Hafta sonu başına bir-iki etkinlik.', 'One or two events per weekend.'), races),
    row(L('Tüm seanslar', 'All sessions'), L('Antrenmanlar ve sıralama turları dahil.', 'Including practice and qualifying.'), all),
    h('p', { class: 'dim t-small', style: { margin: 0 } }, L('iPhone: "Takvime abone ol" düğmesi doğrudan açar. Android: Google Takvim düğmesini kullan.', 'iPhone: the Subscribe button opens Calendar. Android: use the Google Calendar button.'))));
}

export function seasonSelect(years, current, onPick) {
  const sel = h('select', { 'aria-label': L('Sezon', 'Season'), onChange: (e) => onPick(Number(e.target.value)) },
    years.map((y) => h('option', { value: y, selected: y === current }, y)));
  return sel;
}

export function tzNote() {
  return h('span', { class: 'dim t-small' }, L('Saatler: ', 'Times: '), tzLabel());
}

export function placeLine(ref, cid) {
  const c = ref.circuits[cid];
  return c ? `${c.p}, ${countryName(ref, c.nat)}` : '';
}
