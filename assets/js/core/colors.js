// Takim renkleri: guncel renkler OpenF1'den (ref.colors), tarihi takimlar icin sabit liste.
const STATIC = {
  ferrari: '#E8002D', mclaren: '#FF8000', mercedes: '#27F4D2', 'red-bull': '#3671C6', williams: '#1868DB', 'aston-martin': '#229971',
  alpine: '#0093CC', haas: '#B6BABD', 'racing-bulls': '#6692FF', rb: '#6692FF', audi: '#F50537', cadillac: '#909090', sauber: '#52E252',
  'kick-sauber': '#52E252', alphatauri: '#5E8FAA', 'toro-rosso': '#469BFF', renault: '#FFF500', 'lotus-f1': '#B79C2B', 'force-india': '#F596C8',
  'racing-point': '#F596C8', brawn: '#D4F535', 'alfa-romeo': '#B12039', lotus: '#C9A227', brabham: '#3D8C40', tyrrell: '#2E5FA8', jordan: '#F2D022',
  benetton: '#3BAA5C', bar: '#C9C9C9', jaguar: '#2E7D4F', toyota: '#E31D1D', honda: '#D9D9D9', 'bmw-sauber': '#5C8ED6', minardi: '#8B8B8B',
  ligier: '#3E7FD1', arrows: '#E86F2B', march: '#C0392B', cooper: '#2F6B3A', brm: '#5E7A3A', vanwall: '#2C6E49', maserati: '#B03A2E',
  matra: '#3F6CC7', wolf: '#B88A2C', shadow: '#5A5A5A', hesketh: '#E6E6E6', surtees: '#C0392B', stewart: '#E0E0E0', prost: '#2D5BAF',
  sauber_petronas: '#4D7AB8', spyker: '#F07D19', 'super-aguri': '#C0392B', 'manor': '#E3312F', marussia: '#E3312F', caterham: '#1B6B37',
  hrt: '#9E8A5B', virgin: '#C4262E', 'lotus-racing': '#1B5E37', 'midland': '#C0392B', simtek: '#6A4C93', footwork: '#E86F2B', larrousse: '#3E7FD1',
  'leyton-house': '#4FC3B5', zakspeed: '#B03A2E', osella: '#2E5FA8', ats: '#E6C229', ensign: '#3D8C40', penske: '#E6E6E6', parnelli: '#E6E6E6',
  kurtis: '#8B8B8B', talbot: '#2E5FA8', gordini: '#3F6CC7', connaught: '#2F6B3A', 'mercedes-amg': '#27F4D2'
};
const FALLBACK = ['#7FA7D9', '#D98F7F', '#8FCB9B', '#C9A8E8', '#E3C77B', '#7FCBC6', '#E39BB5', '#A9B98A', '#B9A27F', '#8FA0B9'];

let current = {};
export function setTeamColors(colors) { current = colors || {}; }

export function teamColor(id) {
  if (!id) return '#75838f';
  if (current[id]) return current[id];
  if (STATIC[id]) return STATIC[id];
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return FALLBACK[h % FALLBACK.length];
}

// koyu takim renkleri uzerine yazi rengi
export function inkOn(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const y = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return y > 0.6 ? '#121922' : '#ffffff';
}

export function withAlpha(hex, a) {
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

// Favori takim rengini arayuz vurgusu yapar
export function applyAccent(teamId) {
  const root = document.documentElement.style;
  if (!teamId) {
    root.removeProperty('--accent'); root.removeProperty('--accent-ink'); root.removeProperty('--accent-soft');
    document.querySelector('meta[name=theme-color]')?.setAttribute('content', '#121922');
    return;
  }
  const c = teamColor(teamId);
  root.setProperty('--accent', c);
  root.setProperty('--accent-ink', inkOn(c));
  root.setProperty('--accent-soft', withAlpha(c, 0.12));
}
