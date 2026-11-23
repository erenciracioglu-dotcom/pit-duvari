// Gecici: bu bolum bir sonraki guncellemeyle geliyor
import { add } from '../core/util.js';
import { L } from '../core/i18n.js';
import { vhead, empty } from '../core/ui.js';

export async function render(root) {
  add(root, vhead({ title: L('Hazırlanıyor', 'Coming soon') }), empty(L('Bu bölüm birkaç saat içinde burada', 'This section arrives within hours'), L('Takvim, sonuçlar, puan durumu, haberler ve yarış analizi şimdiden hazır.', 'Calendar, results, standings, news and race analysis are already live.')));
}
