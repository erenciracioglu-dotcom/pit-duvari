// Gunun quizi: her gun herkese ayni 5 soru (tarihten turetilir), F1 tarihinin verisinden uretilir.
import { h, clear, add, rng, shuffle, todayKey, copyText } from '../core/util.js';
import { L, driverName, teamName, gpName, countryName, circuitName, fmtDate } from '../core/i18n.js';
import * as store from '../core/store.js';
import { vhead, card, footer, toast, icon, loading } from '../core/ui.js';
import { loadAll } from '../core/hist.js';

const pick = (arr, r) => arr[Math.floor(r() * arr.length)];

function makeQuestions(all, ref, seedKey, n = 5) {
  const r = rng(`pd-quiz-${seedKey}`);
  const years = Object.keys(all.sd || {}).map(Number).filter((y) => all.sd[y]?.some((x) => x[3]));
  const champD = (y) => all.dr[all.sd[y].find((x) => x[3])[0]];
  const top = (y, k) => all.sd[y].slice(0, k).map((x) => all.dr[x[0]]);
  const winners = new Map();
  for (const x of all.res) if (x[3] === 1) winners.set(x[0], x);
  const raceIdx = [...winners.keys()].filter((i) => all.races[i][1] >= 1960);
  const famous = Object.entries(ref.drivers).filter(([, d]) => (d.s?.[1] || 0) >= 3).map(([id]) => id);
  const gens = [
    () => { // yaris kazanani
      const ri = pick(raceIdx, r); const race = all.races[ri]; const w = all.dr[winners.get(ri)[1]];
      const field = (all.byRace.get(ri) || []).filter((x) => x[3] > 1 && x[3] <= 8).map((x) => all.dr[x[1]]);
      const opts = shuffle([w, ...shuffle(field, r).slice(0, 3)], r);
      return { q: L(`${race[1]} ${gpName(ref, all.gp[race[4]])} yarışını kim kazandı?`, `Who won the ${race[1]} ${gpName(ref, all.gp[race[4]])}?`), opts: opts.map((d) => driverName(ref, d)), a: opts.indexOf(w), why: L(`${driverName(ref, w)}, ${teamName(ref, all.te[winners.get(ri)[2]])} ile kazandı.`, `${driverName(ref, w)} won for ${teamName(ref, all.te[winners.get(ri)[2]])}.`) };
    },
    () => { // dunya sampiyonu
      if (!years.length) return null;
      const y = pick(years, r); const c = champD(y);
      const opts = shuffle([c, ...shuffle(top(y, 5).filter((d) => d !== c), r).slice(0, 3)], r);
      return { q: L(`${y} dünya şampiyonu kimdi?`, `Who was the ${y} world champion?`), opts: opts.map((d) => driverName(ref, d)), a: opts.indexOf(c), why: L(`${y} şampiyonu ${driverName(ref, c)}.`, `${driverName(ref, c)} won the ${y} title.`) };
    },
    () => { // kariyer galibiyeti
      const d = pick(famous, r); const w = ref.drivers[d].s[1];
      const set = new Set([w]);
      while (set.size < 4) { const k = Math.max(1, w + Math.round((r() - 0.5) * Math.max(8, w * 0.6))); set.add(k); }
      const opts = shuffle([...set], r);
      return { q: L(`${driverName(ref, d)} kariyerinde kaç F1 yarışı kazandı?`, `How many F1 races did ${driverName(ref, d)} win?`), opts: opts.map(String), a: opts.indexOf(w), why: L(`${ref.drivers[d].s[0]} startta ${w} galibiyet.`, `${w} wins from ${ref.drivers[d].s[0]} starts.`) };
    },
    () => { // uyruk
      const d = pick(famous, r); const nat = ref.drivers[d].nat;
      const pool = [...new Set(famous.map((x) => ref.drivers[x].nat))].filter((c) => c && c !== nat);
      const opts = shuffle([nat, ...shuffle(pool, r).slice(0, 3)], r);
      return { q: L(`${driverName(ref, d)} hangi ülkenin pilotu?`, `Which country does ${driverName(ref, d)} represent?`), opts: opts.map((c) => countryName(ref, c)), a: opts.indexOf(nat), why: L(`${driverName(ref, d)}: ${countryName(ref, nat)}.`, `${driverName(ref, d)}: ${countryName(ref, nat)}.`) };
    },
    () => { // pist ulkesi
      const cs = Object.entries(ref.circuits).filter(([, c]) => (c.races || 0) >= 5);
      const [cid, c] = pick(cs, r);
      const pool = [...new Set(cs.map(([, x]) => x.nat))].filter((x) => x !== c.nat);
      const opts = shuffle([c.nat, ...shuffle(pool, r).slice(0, 3)], r);
      return { q: L(`${circuitName(ref, cid)} hangi ülkede?`, `Which country is ${circuitName(ref, cid)} in?`), opts: opts.map((x) => countryName(ref, x)), a: opts.indexOf(c.nat), why: `${c.p}, ${countryName(ref, c.nat)}.` };
    },
    () => { // ilk galibiyet takimi
      const d = pick(famous, r); const di = all.dIdx.get(d);
      const first = (all.byDriver.get(di) || []).find((x) => x[3] === 1);
      if (!first) return null;
      const t = all.te[first[2]];
      const pool = [...new Set((all.byDriver.get(di) || []).map((x) => all.te[x[2]]))].filter((x) => x !== t);
      const others = shuffle(['ferrari', 'mclaren', 'williams', 'red-bull', 'mercedes', 'lotus', 'brabham', 'renault', 'benetton', 'tyrrell'].filter((x) => x !== t && !pool.includes(x)), r);
      const opts = shuffle([t, ...[...pool, ...others].slice(0, 3)], r);
      const race = all.races[first[0]];
      return { q: L(`${driverName(ref, d)} ilk F1 galibiyetini hangi takımla aldı?`, `With which team did ${driverName(ref, d)} take his first F1 win?`), opts: opts.map((x) => teamName(ref, x)), a: opts.indexOf(t), why: L(`${race[1]} ${gpName(ref, all.gp[race[4]])}, ${teamName(ref, t)}.`, `${race[1]} ${gpName(ref, all.gp[race[4]])} with ${teamName(ref, t)}.`) };
    },
    () => { // en cok pole
      const ds = shuffle(famous.filter((d) => (ref.drivers[d].s[3] || 0) > 0), r).slice(0, 4);
      if (ds.length < 4) return null;
      const best = ds.reduce((a, b) => ((ref.drivers[a].s[3] || 0) >= (ref.drivers[b].s[3] || 0) ? a : b));
      if (ds.filter((d) => ref.drivers[d].s[3] === ref.drivers[best].s[3]).length > 1) return null;
      return { q: L('Bu pilotlardan hangisi daha çok pole pozisyonu aldı?', 'Which of these drivers took the most pole positions?'), opts: ds.map((d) => driverName(ref, d)), a: ds.indexOf(best), why: ds.map((d) => `${driverName(ref, d, 'last')} ${ref.drivers[d].s[3]}`).join(', ') + '.' };
    },
    () => { // takimlar sampiyonu
      const ys = Object.keys(all.sc || {}).map(Number).filter((y) => all.sc[y]?.some((x) => x[3]));
      if (!ys.length) return null;
      const y = pick(ys, r); const c = all.te[all.sc[y].find((x) => x[3])[0]];
      const pool = all.sc[y].slice(0, 6).map((x) => all.te[x[0]]).filter((t) => t !== c);
      const opts = shuffle([c, ...shuffle(pool, r).slice(0, 3)], r);
      return { q: L(`${y} takımlar şampiyonu hangisiydi?`, `Who won the ${y} constructors’ title?`), opts: opts.map((t) => teamName(ref, t)), a: opts.indexOf(c), why: L(`${y}: ${teamName(ref, c)}.`, `${y}: ${teamName(ref, c)}.`) };
    },
    () => { // GP ilk yili
      const gpIdx = Math.floor(r() * all.gp.length);
      const firstRace = all.races.find((x) => x[4] === gpIdx);
      const count = all.races.filter((x) => x[4] === gpIdx).length;
      if (!firstRace || count < 5) return null;
      const y = firstRace[1];
      const set = new Set([y]);
      while (set.size < 4) set.add(Math.min(2026, Math.max(1950, y + Math.round((r() - 0.5) * 24))));
      const opts = shuffle([...set], r);
      return { q: L(`${gpName(ref, all.gp[gpIdx])} dünya şampiyonası takviminde ilk kez hangi yıl yer aldı?`, `In which year was the ${gpName(ref, all.gp[gpIdx])} first part of the world championship?`), opts: opts.map(String), a: opts.indexOf(y), why: L(`İlk kez ${y}; toplam ${count} kez düzenlendi.`, `First held in ${y}; ${count} editions in total.`) };
    }
  ];
  const out = [];
  const used = new Set();
  let guard = 0;
  while (out.length < n && guard++ < 200) {
    const gi = Math.floor(r() * gens.length);
    if (used.has(gi) && used.size < gens.length) continue;
    let q = null;
    try { q = gens[gi](); } catch { q = null; }
    if (!q || q.a < 0 || new Set(q.opts).size !== q.opts.length) continue;
    used.add(gi);
    out.push(q);
  }
  return out;
}

export async function render(root, ctx) {
  const { ref, meta } = ctx;
  const day = ctx.params[0] && /^\d{4}-\d{2}-\d{2}$/.test(ctx.params[0]) ? ctx.params[0] : todayKey();
  const isToday = day === todayKey();
  add(root, vhead({ title: L('Günün quizi', 'Daily quiz'), sub: L(`Her gün 5 yeni soru; aynı gün herkese aynı sorular gelir, arkadaşınla karşılaştırabilirsin. ${fmtDate(day)}.`, `Five new questions every day; everyone gets the same set, so compare with friends. ${fmtDate(day)}.`) }));
  const body = h('div', {}, loading());
  root.appendChild(body);
  const all = await loadAll();
  const qs = makeQuestions(all, ref, day);
  const p = store.get();
  const hist = p.quiz.history[day];
  const answers = hist?.answers ? [...hist.answers] : [];
  const box = h('div', { class: 'card', style: { maxWidth: '640px' } });
  clear(body).append(h('div', { class: 'grid g-7-5' }, box, statsCard(p)));

  const finish = () => {
    const sc = answers.filter((a, i) => a === qs[i].a).length;
    if (isToday && !hist) {
      store.update((x) => {
        const yesterday = todayKey(new Date(Date.now() - 86400000));
        x.quiz.streak = x.quiz.last === yesterday ? (x.quiz.streak || 0) + 1 : 1;
        x.quiz.last = day;
        x.quiz.best = Math.max(x.quiz.best || 0, sc);
        x.quiz.history[day] = { score: sc, total: qs.length, answers };
      });
    }
    const squares = answers.map((a, i) => (a === qs[i].a ? '🟩' : '🟥')).join('');
    clear(box).append(
      h('div', { class: 't-label' }, L('Sonuç', 'Result')),
      h('div', { class: 't-display', style: { fontSize: '4rem', margin: '6px 0' } }, `${sc}/${qs.length}`),
      h('p', { class: 'muted' }, sc === qs.length ? L('Kusursuz tur.', 'A perfect lap.') : sc >= 3 ? L('Puanları topladın.', 'In the points.') : L('Bugün pit stop uzun sürdü; yarın yeni sorular var.', 'A slow stop today; new questions tomorrow.')),
      h('div', { class: 'row wrap' }, h('button', { class: 'btn pri', type: 'button', onClick: async () => { const t = L(`Pit Duvarı günün quizi ${fmtDate(day)}: ${sc}/${qs.length} ${squares}`, `Pit Duvarı daily quiz ${fmtDate(day)}: ${sc}/${qs.length} ${squares}`); toast((await copyText(t)) ? L('Sonuç kopyalandı.', 'Result copied.') : t); } }, icon('copy'), L('Sonucu paylaş', 'Share result'))),
      h('div', { class: 'list mt' }, qs.map((q, i) => h('div', { class: 'li', style: { alignItems: 'flex-start' } },
        h('span', {}, answers[i] === q.a ? '🟩' : '🟥'),
        h('div', {}, h('div', { class: 'li-t' }, q.q), h('div', { class: 'li-s' }, L('Doğru cevap: ', 'Answer: '), h('strong', {}, q.opts[q.a]), `. ${q.why}`))))));
  };

  const ask = (i) => {
    if (i >= qs.length) return finish();
    const q = qs[i];
    const opts = h('div', { class: 'quiz-opts' });
    q.opts.forEach((o, j) => opts.appendChild(h('button', { type: 'button', onClick: () => {
      answers[i] = j;
      [...opts.children].forEach((b, k) => { b.disabled = true; if (k === q.a) b.classList.add('ok'); else if (k === j) b.classList.add('no'); });
      next.hidden = false;
      next.focus();
    } }, o)));
    const next = h('button', { class: 'btn pri mt', type: 'button', hidden: true, onClick: () => ask(i + 1) }, i === qs.length - 1 ? L('Sonucu gör', 'See result') : L('Sonraki soru', 'Next question'));
    clear(box).append(h('div', { class: 'progress', style: { marginBottom: '14px' } }, h('div', { style: { width: `${(100 * i) / qs.length}%` } })),
      h('div', { class: 't-label' }, L(`Soru ${i + 1} / ${qs.length}`, `Question ${i + 1} of ${qs.length}`)), h('p', { class: 'quiz-q', style: { marginTop: '8px' } }, q.q), opts, next);
  };
  if (hist?.answers?.length === qs.length) finish(); else ask(0);
  add(root, footer(meta));
}

function statsCard(p) {
  const days = Object.values(p.quiz.history);
  const total = days.reduce((a, d) => a + d.score, 0), max = days.reduce((a, d) => a + d.total, 0);
  return card(L('Senin karnen', 'Your record'), h('div', { class: 'stats' },
    h('div', { class: 'stat' }, h('div', { class: 'v' }, p.quiz.streak || 0), h('div', { class: 'k' }, L('günlük seri', 'day streak'))),
    h('div', { class: 'stat' }, h('div', { class: 'v' }, days.length), h('div', { class: 'k' }, L('oynanan gün', 'days played'))),
    h('div', { class: 'stat' }, h('div', { class: 'v' }, max ? `%${Math.round((100 * total) / max)}` : '–'), h('div', { class: 'k' }, L('doğru oranı', 'accuracy')))));
}
