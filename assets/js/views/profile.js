// Profil ve ayarlar: favoriler, spoiler kalkani, dil, saat dilimi, cihazlar arasi tasima
import { h, clear, download, copyText, add } from '../core/util.js';
import { L, driverName, teamName, deviceTz, fmtDate } from '../core/i18n.js';
import * as store from '../core/store.js';
import * as data from '../core/data.js';
import { teamColor, inkOn } from '../core/colors.js';
import { vhead, card, icon, toast, modal, footer, seg } from '../core/ui.js';
import { icsModal } from './common.js';
import { qrcode } from '../../vendor/qrcode.mjs';

const TZS = ['Europe/Istanbul', 'Europe/London', 'Europe/Berlin', 'Europe/Moscow', 'Asia/Almaty', 'Asia/Dubai', 'America/New_York', 'America/Los_Angeles', 'Asia/Tokyo', 'Australia/Sydney'];

// guncel kadro, sampiyonadaki siraya gore
function orderedLineup(ctx) {
  const lineup = data.lineup(ctx.ref, ctx.cur);
  const st = data.latestStandings(ctx.cur);
  const cPos = new Map(st.c.map(([t, p]) => [t, p]));
  const dPos = new Map(st.d.map(([d, p]) => [d, p]));
  return new Map([...lineup.entries()].sort((a, b) => (cPos.get(a[0]) || 99) - (cPos.get(b[0]) || 99))
    .map(([t, ds]) => [t, ds.slice().sort((a, b) => (dPos.get(a) || 99) - (dPos.get(b) || 99))]));
}

function teamPicker(ctx, value, onPick) {
  const lineup = orderedLineup(ctx);
  const wrap = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '8px' } });
  const render = (v) => {
    clear(wrap);
    for (const t of lineup.keys()) {
      const c = teamColor(t);
      const on = v === t;
      wrap.appendChild(h('button', { type: 'button', 'aria-pressed': String(on), onClick: () => { onPick(on ? null : t); render(on ? null : t); },
        style: { textAlign: 'left', padding: '10px 12px', borderRadius: '10px', cursor: 'pointer', border: `1px solid ${on ? c : 'var(--line-2)'}`, background: on ? c : 'var(--bg-3)', color: on ? inkOn(c) : 'var(--ink)', fontWeight: 650 } },
        h('span', { style: { display: 'block', width: '22px', height: '4px', borderRadius: '2px', background: on ? inkOn(c) : c, marginBottom: '8px' } }), teamName(ctx.ref, t)));
    }
  };
  render(value);
  return wrap;
}

function driverPicker(ctx, values, onChange) {
  const lineup = orderedLineup(ctx);
  const sel = new Set(values);
  const wrap = h('div', { class: 'row wrap', style: { gap: '6px' } });
  const render = () => {
    clear(wrap);
    for (const [t, ds] of lineup) for (const d of ds) {
      const on = sel.has(d);
      wrap.appendChild(h('button', { type: 'button', class: ['btn sm', on ? '' : 'ghost'], 'aria-pressed': String(on), style: on ? { borderColor: teamColor(t) } : {},
        onClick: () => { if (on) sel.delete(d); else { if (sel.size >= 3) { toast(L('En fazla 3 favori pilot seçebilirsin.', 'Up to 3 favourite drivers.')); return; } sel.add(d); } onChange([...sel]); render(); } },
      h('span', { class: 'tdot', style: { background: teamColor(t) } }), driverName(ctx.ref, d)));
    }
  };
  render();
  return wrap;
}

export function onboarding(ctx) {
  const p = store.get();
  let team = p.favTeam, drivers = [...p.favDrivers], spoilerOn = p.spoiler.on;
  const body = h('div', { class: 'stack' },
    h('p', { class: 'muted', style: { margin: 0 } }, L('Takvim, sonuçlar, puan durumu, haberler ve yarış analizleri tek yerde. Birkaç seçimle sayfayı sana göre ayarlayalım; hepsini sonra Profil sayfasından değiştirebilirsin.', 'Calendar, results, standings, news and race analysis in one place. A few picks tailor the app to you; change them any time under Profile.')),
    h('div', {}, h('div', { class: 't-label', style: { marginBottom: '8px' } }, L('Tuttuğun takım', 'Your team')), teamPicker(ctx, team, (v) => { team = v; })),
    h('div', {}, h('div', { class: 't-label', style: { marginBottom: '8px' } }, L('Favori pilotların (en fazla 3)', 'Favourite drivers (up to 3)')), driverPicker(ctx, drivers, (v) => { drivers = v; })),
    h('label', { class: 'switch' }, h('input', { type: 'checkbox', checked: spoilerOn, onChange: (e) => { spoilerOn = e.target.checked; } }),
      h('span', {}, h('strong', {}, L('Spoiler kalkanı', 'Spoiler shield')), h('span', { class: 'muted t-small', style: { display: 'block' } }, L('Yarışları sonradan izliyorsan sonuçlar ve başlıklar sen açana kadar gizli kalır.', 'If you watch races later, results and headlines stay hidden until you reveal them.')))));
  modal(L('Pit Duvarı’na hoş geldin', 'Welcome to Pit Duvarı'), body, {
    actions: [
      { label: L('Şimdilik geç', 'Skip for now'), onClick: () => { store.update((x) => { x.seen.onboard = true; }); } },
      { label: L('Kaydet ve başla', 'Save and start'), primary: true, onClick: () => { store.update((x) => { x.favTeam = team; x.favDrivers = drivers; x.spoiler.on = spoilerOn; x.seen.onboard = true; }); window.dispatchEvent(new Event('pd:rerender')); } }
    ],
    onClose: () => { if (!store.get().seen.onboard) store.update((x) => { x.seen.onboard = true; }); }
  });
}

export async function render(root, ctx) {
  const { ref, meta } = ctx;
  const p = store.get();
  const save = (fn, msg) => { store.update(fn); if (msg) toast(msg); };

  const nameIn = h('input', { type: 'text', value: p.name, placeholder: L('Adın (isteğe bağlı)', 'Your name (optional)'), maxlength: 40, onChange: (e) => save((x) => { x.name = e.target.value.trim(); }, L('Kaydedildi.', 'Saved.')) });
  const tzSel = h('select', { onChange: (e) => { save((x) => { x.tz = e.target.value; }); window.dispatchEvent(new Event('pd:rerender')); } },
    h('option', { value: '', selected: !p.tz }, L(`Cihazın saat dilimi (${deviceTz()})`, `Device time zone (${deviceTz()})`)),
    TZS.map((z) => h('option', { value: z, selected: p.tz === z }, z.replace('_', ' '))));

  const favs = card(L('Favoriler', 'Favourites'), h('div', { class: 'stack' },
    h('div', {}, h('div', { class: 't-label', style: { marginBottom: '8px' } }, L('Tuttuğun takım: arayüzün vurgu rengi olur, haberlerde öne çıkar.', 'Your team: becomes the accent colour and leads the news.')),
      teamPicker(ctx, p.favTeam, (v) => save((x) => { x.favTeam = v; }, L('Takım kaydedildi.', 'Team saved.')))),
    h('div', {}, h('div', { class: 't-label', style: { marginBottom: '8px' } }, L('Favori pilotlar (en fazla 3): tablolarda ve grafiklerde vurgulanır.', 'Favourite drivers (up to 3): highlighted in tables and charts.')),
      driverPicker(ctx, p.favDrivers, (v) => save((x) => { x.favDrivers = v; })))));

  const spoilerCard = card(L('Spoiler kalkanı', 'Spoiler shield'), h('div', { class: 'stack' },
    h('label', { class: 'switch' }, h('input', { type: 'checkbox', checked: p.spoiler.on, onChange: (e) => save((x) => { x.spoiler.on = e.target.checked; }, e.target.checked ? L('Spoiler kalkanı açık.', 'Spoiler shield on.') : L('Spoiler kalkanı kapalı.', 'Spoiler shield off.')) }),
      h('span', {}, L('Son yarışın sonuçlarını ve başlıklarını gizle', 'Hide the latest race results and headlines'))),
    h('div', { class: 'row wrap' }, h('span', { class: 'muted t-small' }, L('Gizleme süresi', 'Hide for')),
      seg([2, 4, 7].map((d) => ({ value: d, label: L(`${d} gün`, `${d} days`) })), p.spoiler.days, (v) => save((x) => { x.spoiler.days = v; }))),
    h('p', { class: 'muted t-small', style: { margin: 0 } }, L('Sonucu bir kere açtığında o yarış için gizleme kalkar. Puan durumu, gizli yarıştan önceki haliyle gösterilir.', 'Revealing a result lifts the shield for that race. Standings show the table before the hidden race.'))));

  const prefs = card(L('Dil ve saat', 'Language and time'), h('div', { class: 'stack' },
    h('label', { class: 'field' }, L('Ad', 'Name'), nameIn),
    h('div', { class: 'field' }, L('Dil', 'Language'), seg([{ value: 'tr', label: 'Türkçe' }, { value: 'en', label: 'English' }], p.lang, (v) => { save((x) => { x.lang = v; }); window.dispatchEvent(new Event('pd:rerender')); })),
    h('label', { class: 'field' }, L('Saat dilimi', 'Time zone'), tzSel),
    h('button', { class: 'btn', type: 'button', onClick: icsModal, style: { justifySelf: 'start' } }, icon('cal'), L('Telefon takvimine abone ol', 'Subscribe in your phone calendar'))));

  add(root, vhead({ title: L('Profil ve ayarlar', 'Profile & settings'), sub: L('Ayarların bu tarayıcıda saklanır. Başka bir cihazda aynı deneyim için profilini aşağıdan taşı.', 'Settings live in this browser. Move your profile below to get the same setup on another device.') }),
    h('div', { class: 'grid g2' }, h('div', { class: 'stack' }, favs, spoilerCard), h('div', { class: 'stack' }, prefs, transferCard(ctx))),
    aboutCard(meta), footer(meta));
}

function summary(p, ref) {
  return L(`Takım: ${p.favTeam ? teamName(ref, p.favTeam) : '–'}; pilotlar: ${p.favDrivers.map((d) => driverName(ref, d, 'last')).join(', ') || '–'}; ${Object.keys(p.predictions).length} tahmin; ${Object.keys(p.quiz.history).length} quiz günü.`,
    `Team: ${p.favTeam ? teamName(ref, p.favTeam) : '–'}; drivers: ${p.favDrivers.map((d) => driverName(ref, d, 'last')).join(', ') || '–'}; ${Object.keys(p.predictions).length} predictions; ${Object.keys(p.quiz.history).length} quiz days.`);
}

function transferCard(ctx) {
  const { ref } = ctx;
  const p = store.get();
  const out = h('div', { class: 'stack' });
  const fileIn = h('input', { type: 'file', accept: '.json,application/json', style: { display: 'none' }, onChange: async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try { const obj = JSON.parse(await f.text()); askImport(obj, ref); } catch (err) { toast(L('Dosya okunamadı: ', 'Could not read file: ') + err.message, 4000); }
    e.target.value = '';
  } });
  const qrBox = h('div', {});
  const linkBtn = h('button', { class: 'btn', type: 'button', onClick: async () => {
    const code = await store.encodeLink();
    const url = `${location.href.split('#')[0]}#profil=${code}`;
    clear(qrBox);
    if (url.length < 2600) {
      try {
        const qr = qrcode(0, 'L');
        qr.addData(url);
        qr.make();
        const svgBox = h('div', { class: 'qr-box', html: qr.createSvgTag({ cellSize: 3, margin: 2, scalable: true }) });
        qrBox.append(h('p', { class: 'muted t-small', style: { margin: '0 0 8px' } }, L('Telefonun kamerasıyla okut:', 'Scan with your phone camera:')), svgBox);
      } catch { /* cok uzun */ }
    } else qrBox.append(h('p', { class: 'muted t-small' }, L('Profilin karekod için çok büyük; bağlantıyı ya da dosyayı kullan.', 'Your profile is too big for a QR code; use the link or file.')));
    const ok = await copyText(url);
    qrBox.append(h('p', { class: 'muted t-small' }, ok ? L('Bağlantı panoya kopyalandı; kendine WhatsApp ya da e-posta ile gönderebilirsin.', 'Link copied; send it to yourself by WhatsApp or e-mail.') : url));
  } }, icon('link'), L('Bağlantı ve karekod oluştur', 'Create link and QR code'));

  out.append(
    h('p', { class: 'muted t-small', style: { margin: 0 } }, summary(p, ref)),
    h('div', { class: 'row wrap' },
      h('button', { class: 'btn pri', type: 'button', onClick: () => { download(`pit-duvari-profil-${new Date().toISOString().slice(0, 10)}.json`, store.exportJSON()); toast(L('Profil dosyası indirildi.', 'Profile file downloaded.')); } }, icon('download'), L('Dosya olarak indir', 'Download as file')),
      h('button', { class: 'btn', type: 'button', onClick: () => fileIn.click() }, icon('upload'), L('Dosyadan yükle', 'Load from file')), fileIn),
    h('div', { class: 'row wrap' }, linkBtn,
      h('button', { class: 'btn ghost', type: 'button', onClick: () => pasteDialog(ref) }, icon('copy'), L('Kodu yapıştır', 'Paste code'))),
    qrBox,
    h('p', { class: 'dim t-small', style: { margin: 0 } }, L('Profil yalnızca senin cihazlarında durur; hiçbir sunucuya gönderilmez. Bağlantı, profilin tamamını içinde taşır.', 'Your profile stays on your devices and is never sent to a server. The link carries the whole profile inside it.')));
  return card(L('Profil taşıma', 'Move your profile'), out);
}

function askImport(obj, ref) {
  const err = store.validate(obj);
  if (err) { toast(err, 4000); return; }
  const preview = { favTeam: obj.favTeam || null, favDrivers: Array.isArray(obj.favDrivers) ? obj.favDrivers : [], predictions: obj.predictions || {}, quiz: { history: obj.quiz?.history || {} } };
  modal(L('Profili içe aktar', 'Import profile'), h('div', {}, h('p', { class: 'muted', style: { marginTop: 0 } }, summary(preview, ref)),
    h('p', { class: 't-small', style: { margin: 0 } }, L('"Birleştir" bu cihazdaki tahmin ve quiz geçmişini korur; "Değiştir" bu cihazdakini tamamen yenisiyle değiştirir.', '"Merge" keeps this device’s predictions and quiz history; "Replace" swaps it entirely.'))), {
    actions: [
      { label: L('Vazgeç', 'Cancel') },
      { label: L('Birleştir', 'Merge'), onClick: () => { store.importProfile(obj, 'merge'); toast(L('Profil birleştirildi.', 'Profile merged.')); window.dispatchEvent(new Event('pd:rerender')); } },
      { label: L('Değiştir', 'Replace'), primary: true, onClick: () => { store.importProfile(obj, 'replace'); toast(L('Profil aktarıldı.', 'Profile imported.')); window.dispatchEvent(new Event('pd:rerender')); } }
    ]
  });
}

function pasteDialog(ref) {
  const ta = h('textarea', { placeholder: L('Profil bağlantısını, kodunu ya da JSON metnini yapıştır', 'Paste the profile link, code or JSON text') });
  modal(L('Kodu yapıştır', 'Paste code'), ta, {
    actions: [{ label: L('Vazgeç', 'Cancel') }, { label: L('Devam', 'Continue'), primary: true, onClick: async () => {
      const v = ta.value.trim();
      try {
        let obj;
        if (v.startsWith('{')) obj = JSON.parse(v);
        else { const code = v.includes('#profil=') ? v.split('#profil=')[1] : v; obj = await store.decodeLink(code); }
        setTimeout(() => askImport(obj, ref), 50);
      } catch (e) { toast(L('Kod çözülemedi: ', 'Could not decode: ') + e.message, 4000); return false; }
      return true;
    } }]
  });
}

function aboutCard(meta) {
  const src = meta.sources || {};
  const news = src.news ? Object.entries(src.news) : [];
  return h('div', { class: 'mt' }, card(L('Veri ve güncelleme', 'Data and updates'), h('div', { class: 'stack' },
    h('dl', { class: 'kv' },
      h('dt', {}, L('Son güncelleme', 'Last update')), h('dd', {}, new Date(meta.generated).toLocaleString()),
      h('dt', {}, L('Sonuç arşivi', 'Results archive')), h('dd', {}, `F1DB ${meta.f1db?.tag || ''} (${meta.f1db?.published ? fmtDate(meta.f1db.published) : ''})`),
      h('dt', {}, L('Yarış hikâyeleri', 'Race stories')), h('dd', {}, L(`${(meta.stories || []).length} yarış (2023’ten bu yana)`, `${(meta.stories || []).length} races (since 2023)`)),
      h('dt', {}, L('Haber kaynakları', 'News sources')), h('dd', {}, news.map(([k, v]) => `${k}: ${typeof v === 'number' ? v : '✕'}`).join(', '))),
    h('p', { class: 'muted t-small', style: { margin: 0 } }, L('Veriler her 30 dakikada bir GitHub Actions ile yenilenir. Sonuçlar seans bitiminden yaklaşık yarım saat sonra gelir; resmi tablo F1DB güncellenince yerleşir. Canlı tur tur zamanlama ücretli bir veri akışı gerektirdiği için yok.', 'Data refreshes every 30 minutes via GitHub Actions. Results arrive about half an hour after a session; the official table settles when F1DB updates. Live lap-by-lap timing needs a paid feed, so it is not included.')),
    h('div', { class: 'row wrap' }, h('button', { class: 'btn ghost sm', type: 'button', onClick: () => modal(L('Profili sıfırla', 'Reset profile'), h('p', { style: { margin: 0 } }, L('Bu cihazdaki favoriler, tahminler ve quiz geçmişi silinir. Önce dosya olarak indirmen önerilir.', 'Favourites, predictions and quiz history on this device will be deleted. Download a file first.')), { actions: [{ label: L('Vazgeç', 'Cancel') }, { label: L('Sıfırla', 'Reset'), primary: true, onClick: () => { store.resetProfile(); window.dispatchEvent(new Event('pd:rerender')); } }] }) }, L('Profili sıfırla', 'Reset profile'))))));
}
