// Haber akisi: Turkce ve Ingilizce F1 RSS kaynaklari. Yalnizca baslik, kisa ozet ve kaynaga baglanti tutulur.
import { XMLParser } from 'fast-xml-parser';
import { http, sha1, log } from './util.mjs';

export const FEEDS = [
  { id: 'motorsport-tr', name: 'Motorsport.com Türkiye', lang: 'tr', url: 'https://tr.motorsport.com/rss/f1/news/', home: 'https://tr.motorsport.com/f1/' },
  { id: 'ntvspor', name: 'NTV Spor', lang: 'tr', url: 'https://www.ntvspor.net/rss/kategori/formula-1', home: 'https://www.ntvspor.net/formula-1' },
  { id: 'f1', name: 'Formula1.com', lang: 'en', url: 'https://www.formula1.com/en/latest/all.xml', home: 'https://www.formula1.com/en/latest' },
  { id: 'motorsport', name: 'Motorsport.com', lang: 'en', url: 'https://www.motorsport.com/rss/f1/news/', home: 'https://www.motorsport.com/f1/' },
  { id: 'autosport', name: 'Autosport', lang: 'en', url: 'https://www.autosport.com/rss/f1/news/', home: 'https://www.autosport.com/f1/' },
  { id: 'the-race', name: 'The Race', lang: 'en', url: 'https://www.the-race.com/feed/', home: 'https://www.the-race.com/formula-1/', filter: (u) => /\/formula-1\//.test(u) },
  { id: 'racefans', name: 'RaceFans', lang: 'en', url: 'https://www.racefans.net/feed/', home: 'https://www.racefans.net/' },
  { id: 'bbc', name: 'BBC Sport', lang: 'en', url: 'https://feeds.bbci.co.uk/sport/formula1/rss.xml', home: 'https://www.bbc.com/sport/formula1' },
  { id: 'crash', name: 'Crash.net', lang: 'en', url: 'https://www.crash.net/rss/f1', home: 'https://www.crash.net/f1' },
  { id: 'rn365', name: 'RacingNews365', lang: 'en', url: 'https://racingnews365.com/feed/news.xml', home: 'https://racingnews365.com/', max: 60 },
  { id: 'grandprix', name: 'GrandPrix.com', lang: 'en', url: 'https://www.grandprix.com/rss.xml', home: 'https://www.grandprix.com/' }
];

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', hellip: '…', ndash: '–', mdash: '—' };
function decode(s) {
  return String(s ?? '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m);
}
const text = (v) => (v && typeof v === 'object' ? v['#text'] ?? '' : v ?? '');
function clean(html) {
  return decode(decode(String(html || '')).replace(/<a [^>]*class=['"]more['"][\s\S]*$/i, '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ').trim();
}
function snippet(s, max = 220) {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  return cut.slice(0, Math.max(cut.lastIndexOf(' '), max - 30)).replace(/[,;:.\-–]+$/, '') + '…';
}
function normLink(u) {
  try {
    const url = new URL(u);
    for (const k of [...url.searchParams.keys()]) if (/^utm_|^at_|^ref$|^ito$/i.test(k)) url.searchParams.delete(k);
    url.hash = '';
    return url.toString();
  } catch {
    return u;
  }
}

function parseFeed(xml, feed) {
  const p = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@', cdataPropName: false, processEntities: false, trimValues: true });
  const doc = p.parse(xml);
  let items = doc?.rss?.channel?.item || doc?.['rdf:RDF']?.item || doc?.feed?.entry || [];
  if (!Array.isArray(items)) items = [items];
  const out = [];
  for (const it of items) {
    let link = text(it.link);
    if (it.link && typeof it.link === 'object' && !Array.isArray(it.link) && it.link['@href']) link = it.link['@href'];
    if (Array.isArray(it.link)) link = (it.link.find((l) => l['@rel'] === 'alternate') || it.link[0])?.['@href'] || text(it.link[0]);
    if (!link && it.guid) link = text(it.guid);
    link = normLink(decode(link).trim());
    const title = clean(text(it.title));
    if (!title || !link) continue;
    if (feed.filter && !feed.filter(link)) continue;
    const desc = clean(text(it.description) || text(it.summary) || text(it['content:encoded']) || text(it.content));
    const when = Date.parse(text(it.pubDate) || text(it.published) || text(it.updated) || text(it['dc:date']));
    out.push({ id: sha1(link).slice(0, 12), t: title, s: snippet(desc.startsWith(title) ? desc.slice(title.length).trim() : desc), u: link, src: feed.id, lang: feed.lang, ts: isFinite(when) ? when : Date.now() });
  }
  return feed.max ? out.sort((a, b) => b.ts - a.ts).slice(0, feed.max) : out;
}

// Haberi surucu / takim adlariyla etiketler
function tagger(ref, lineup) {
  const rules = [];
  const teamWords = {
    mercedes: ['Mercedes'], ferrari: ['Ferrari'], 'red-bull': ['Red Bull'], mclaren: ['McLaren'], 'aston-martin': ['Aston Martin'],
    alpine: ['Alpine'], williams: ['Williams'], 'racing-bulls': ['Racing Bulls', 'VCARB'], haas: ['Haas'], audi: ['Audi', 'Sauber'], cadillac: ['Cadillac']
  };
  const teams = new Set(lineup.map((x) => x.t));
  for (const t of teams) for (const w of teamWords[t] || [ref.constructors[t]?.n].filter(Boolean)) rules.push({ re: new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'), kind: 't', id: t });
  for (const x of lineup) {
    const d = ref.drivers[x.d];
    if (!d?.l) continue;
    const last = d.l.normalize('NFC');
    rules.push({ re: new RegExp(`(^|[^\\p{L}])${last.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=[^\\p{L}]|$)`, 'iu'), kind: 'd', id: x.d });
  }
  return (item) => {
    const hay = `${item.t} ${item.s}`;
    const tags = { d: [], t: [] };
    for (const r of rules) if (r.re.test(hay) && !tags[r.kind].includes(r.id)) tags[r.kind].push(r.id);
    return tags.d.length || tags.t.length ? tags : undefined;
  };
}

export async function buildNews({ previous = [], ref, lineup = [], now = Date.now() }) {
  const status = {};
  const fresh = [];
  await Promise.all(FEEDS.map(async (f) => {
    try {
      const xml = await http(f.url, { as: 'text', timeout: 20000, retries: 1, headers: { Accept: 'application/rss+xml, application/xml, text/xml, */*' } });
      const items = parseFeed(xml, f);
      status[f.id] = items.length;
      fresh.push(...items);
    } catch (e) {
      status[f.id] = 'hata: ' + e.message.slice(0, 80);
      log('Haber kaynagi alinamadi:', f.id, e.message);
    }
  }));
  const tag = tagger(ref, lineup);
  const seen = new Map();
  const normTitle = (t) => t.toLowerCase().normalize('NFD').replace(/[^\p{L}\p{N} ]/gu, '').replace(/\s+/g, ' ').trim();
  const all = [...fresh, ...previous].sort((a, b) => b.ts - a.ts);
  const out = [];
  const cutoff = now - 21 * 86400000;
  for (const it of all) {
    if (it.ts < cutoff || it.ts > now + 3600000) continue;
    const k1 = it.u;
    const k2 = it.lang + '|' + normTitle(it.t);
    if (seen.has(k1) || seen.has(k2)) continue;
    seen.set(k1, 1);
    seen.set(k2, 1);
    out.push({ ...it, tags: tag(it) });
    if (out.length >= 600) break;
  }
  return { items: out, status, sources: FEEDS.map(({ id, name, lang, home }) => ({ id, name, lang, home })) };
}
