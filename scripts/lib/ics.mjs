// Telefon / bilgisayar takvimine abone olunabilen .ics dosyalari
import { GP_TR, SESSION_LABEL, SESSION_MINUTES, SESSION_ORDER } from '../../assets/js/core/names.js';

const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
const stamp = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const dateOnly = (s) => s.replace(/-/g, '');

function fold(line) {
  // RFC 5545: 75 oktette satir katla
  const bytes = Buffer.from(line, 'utf8');
  if (bytes.length <= 75) return line;
  const parts = [];
  let cur = '';
  for (const ch of line) {
    if (Buffer.byteLength(cur + ch, 'utf8') > (parts.length ? 74 : 75)) { parts.push(cur); cur = ch; } else cur += ch;
  }
  parts.push(cur);
  return parts.join('\r\n ');
}

export function buildIcs(seasons, ref, { onlyRaces = false, now = new Date(), base = 'https://erenciracioglu-dotcom.github.io/pit-duvari/' } = {}) {
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Pit Duvari//F1 Takvimi//TR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    `X-WR-CALNAME:${onlyRaces ? 'F1 yarışları (Pit Duvarı)' : 'F1 tüm seanslar (Pit Duvarı)'}`,
    'X-WR-TIMEZONE:Europe/Istanbul', 'REFRESH-INTERVAL;VALUE=DURATION:PT6H', 'X-PUBLISHED-TTL:PT6H'
  ];
  const dtstamp = stamp(now);
  for (const season of seasons) {
    if (!season) continue;
    for (const race of season.races) {
      const gp = GP_TR[race.gp] || ref.gps[race.gp]?.s || race.gp;
      const circ = ref.circuits[race.c];
      const where = circ ? `${circ.fn}, ${circ.p}` : '';
      const url = `${base}#yaris/${season.year}/${race.r}`;
      const keys = onlyRaces ? ['spr', 'r'] : SESSION_ORDER;
      let any = false;
      for (const k of keys) {
        const when = race.s?.[k];
        if (!when || !when.includes('T')) continue;
        any = true;
        const start = new Date(when);
        const end = new Date(start.getTime() + SESSION_MINUTES[k] * 60000);
        lines.push('BEGIN:VEVENT', `UID:${season.year}-${race.r}-${k}@pit-duvari`, `DTSTAMP:${dtstamp}`, `DTSTART:${stamp(start)}`, `DTEND:${stamp(end)}`,
          fold(`SUMMARY:${esc(`${k === 'r' ? '🏁 ' : k === 'spr' ? '⚡ ' : ''}${gp} · ${SESSION_LABEL.tr[k]}`)}`),
          fold(`LOCATION:${esc(where)}`), fold(`DESCRIPTION:${esc(`${season.year} sezonu ${race.r}. yarış. Canlı sonuçlar ve analiz: ${url}`)}`), fold(`URL:${url}`));
        if (k === 'r' || k === 'q' || k === 'spr') lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(`${gp} ${SESSION_LABEL.tr[k]} 30 dakika sonra`)}`, 'TRIGGER:-PT30M', 'END:VALARM');
        lines.push('END:VEVENT');
      }
      if (!any && race.start && race.date) {
        // saatler henuz aciklanmadi: tum gun hafta sonu etkinligi
        const endDay = new Date(Date.parse(race.date + 'T00:00:00Z') + 86400000).toISOString().slice(0, 10);
        lines.push('BEGIN:VEVENT', `UID:${season.year}-${race.r}-weekend@pit-duvari`, `DTSTAMP:${dtstamp}`, `DTSTART;VALUE=DATE:${dateOnly(race.start)}`, `DTEND;VALUE=DATE:${dateOnly(endDay)}`,
          fold(`SUMMARY:${esc(`🏁 ${gp} hafta sonu${race.sprint ? ' (sprint)' : ''}`)}`), fold(`LOCATION:${esc(where)}`),
          fold(`DESCRIPTION:${esc(`Seans saatleri açıklanınca bu etkinlik saatli seanslara dönüşür. ${url}`)}`), 'TRANSP:TRANSPARENT', 'END:VEVENT');
      }
    }
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}
