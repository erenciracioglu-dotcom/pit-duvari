// GoatCounter ziyaret sayacı (çerezsiz). Uygulama # ile gezindiği için sayfa görüntülemelerini
// yönlendirici sayar; index.html'de sayacın kendi açılış sayımı kapalı (no_onload).
// Profil aktarım bağlantıları (#profil=...) buraya hiç gelmez, profil kodu dışarı gitmez.
const queue = [];
let last = '';
let timer = 0;

function flush() {
  const gc = window.goatcounter;
  if (!gc || typeof gc.count !== 'function') return false;
  while (queue.length) gc.count(queue.shift());
  return true;
}

export function countView(key, params = []) {
  const path = location.pathname + '#' + [key, ...params].join('/');
  if (path === last) return; // aynı sayfanın yeniden çizimi (ör. spoiler açma) sayılmaz
  last = path;
  queue.push({ path, title: document.title });
  if (flush() || timer) return;
  // count.js async yükleniyor; hazır olana kadar bekle (engelleyici varsa 30 sn sonra vazgeç)
  let tries = 0;
  timer = setInterval(() => {
    if (flush() || ++tries > 150) { clearInterval(timer); timer = 0; queue.length = 0; }
  }, 200);
}
