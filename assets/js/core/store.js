// Kullanici profili: bu tarayicida saklanir; JSON dosyasi, kod ya da baglanti ile baska cihaza tasinir.
const KEY = 'pitduvari:profile:v1';

export const DEFAULT = () => ({
  app: 'pit-duvari',
  v: 1,
  name: '',
  lang: 'tr',
  tz: '',
  favTeam: null,
  favDrivers: [],
  spoiler: { on: false, days: 4, revealed: {} },
  newsLang: 'all',
  predictions: {},
  quiz: { history: {}, streak: 0, best: 0, last: null },
  sim: {},
  seen: {},
  created: new Date().toISOString(),
  updated: new Date().toISOString()
});

let profile = null;
const listeners = new Set();
let storageOk = true;

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    storageOk = false;
    return null;
  }
}

function normalize(p) {
  const d = DEFAULT();
  const out = { ...d, ...(p || {}) };
  out.spoiler = { ...d.spoiler, ...(p?.spoiler || {}) };
  out.spoiler.revealed = { ...(p?.spoiler?.revealed || {}) };
  out.quiz = { ...d.quiz, ...(p?.quiz || {}) };
  out.quiz.history = { ...(p?.quiz?.history || {}) };
  out.predictions = { ...(p?.predictions || {}) };
  out.sim = { ...(p?.sim || {}) };
  out.seen = { ...(p?.seen || {}) };
  out.favDrivers = Array.isArray(p?.favDrivers) ? p.favDrivers.slice(0, 3) : [];
  out.app = 'pit-duvari';
  out.v = 1;
  return out;
}

export function load() {
  profile = normalize(read());
  return profile;
}
export const get = () => profile || load();
export const storageAvailable = () => storageOk;

function persist() {
  profile.updated = new Date().toISOString();
  try {
    localStorage.setItem(KEY, JSON.stringify(profile));
  } catch {
    storageOk = false;
  }
}

export function update(mutator) {
  const p = get();
  mutator(p);
  persist();
  for (const fn of listeners) fn(p);
  return p;
}
export function onChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// ---- tasima ----
export function exportJSON() {
  return JSON.stringify({ ...get(), exported: new Date().toISOString() }, null, 2);
}

export function validate(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return 'Dosya bir Pit Duvarı profili değil.';
  if (obj.app && obj.app !== 'pit-duvari') return 'Bu dosya başka bir uygulamaya ait.';
  const known = ['favTeam', 'favDrivers', 'spoiler', 'predictions', 'quiz', 'lang'];
  if (!known.some((k) => k in obj)) return 'Dosyada profil bilgisi bulunamadı.';
  return null;
}

export function importProfile(obj, mode = 'replace') {
  const err = validate(obj);
  if (err) throw new Error(err);
  const incoming = normalize(obj);
  if (mode === 'merge') {
    const cur = get();
    const newer = Date.parse(incoming.updated || 0) > Date.parse(cur.updated || 0) ? incoming : cur;
    profile = normalize({
      ...newer,
      predictions: { ...cur.predictions, ...incoming.predictions },
      quiz: {
        ...newer.quiz,
        history: { ...cur.quiz.history, ...incoming.quiz.history },
        best: Math.max(cur.quiz.best || 0, incoming.quiz.best || 0)
      },
      spoiler: { ...newer.spoiler, revealed: { ...cur.spoiler.revealed, ...incoming.spoiler.revealed } },
      sim: { ...cur.sim, ...incoming.sim },
      created: [cur.created, incoming.created].filter(Boolean).sort()[0]
    });
  } else {
    profile = incoming;
  }
  persist();
  for (const fn of listeners) fn(profile);
  return profile;
}

export function resetProfile() {
  profile = DEFAULT();
  persist();
  for (const fn of listeners) fn(profile);
}

// Baglanti ile tasima: JSON -> deflate -> base64url. CompressionStream yoksa sikistirmasiz.
const b64u = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (str) => Uint8Array.from(atob(str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4)), (c) => c.charCodeAt(0));

async function streamBytes(stream) {
  const buf = await new Response(stream).arrayBuffer();
  return new Uint8Array(buf);
}

export async function encodeLink(obj = get()) {
  const json = JSON.stringify({ ...obj, exported: new Date().toISOString() });
  const raw = new TextEncoder().encode(json);
  if (typeof CompressionStream === 'function') {
    try {
      const z = await streamBytes(new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate-raw')));
      let bin = '';
      for (let i = 0; i < z.length; i += 8192) bin += String.fromCharCode(...z.subarray(i, i + 8192));
      return 'z' + btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    } catch { /* duz kodlamaya dus */ }
  }
  return 'j' + b64u(raw);
}

export async function decodeLink(code) {
  const kind = code[0];
  const bytes = unb64u(code.slice(1));
  let json;
  if (kind === 'z') {
    if (typeof DecompressionStream !== 'function') throw new Error('Bu tarayıcı sıkıştırılmış bağlantıyı açamıyor. Dosya ile aktarmayı dene.');
    const out = await streamBytes(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw')));
    json = new TextDecoder().decode(out);
  } else {
    json = new TextDecoder().decode(bytes);
  }
  return JSON.parse(json);
}
