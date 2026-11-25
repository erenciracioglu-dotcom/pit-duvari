# Pit Duvarı

Formula 1 takip merkezi: takvim ve geri sayım, 1950'den bugüne tüm sonuçlar, puan durumu, Türkçe ve İngilizce haber akışı, yarış analizleri (tur tur sıralama, lastik stratejisi, pist tekrarı), telemetri karşılaştırması, kafa kafaya istatistikler, rekorlar, pist rehberi, "ya şöyle biterse" simülatörü, tahmin oyunu ve günün quizi.

**Canlı:** https://erenciracioglu-dotcom.github.io/pit-duvari/

Her sayfada Ctrl+K (ya da /) ile pilot, takım, yarış, pist ve sayfalar arasında hızlı arama yapılır.

Telefonda tarayıcının menüsünden "Ana ekrana ekle" ile uygulama gibi kurulur. Profil (favori takım, spoiler kalkanı, tahminler, quiz geçmişi) tarayıcıda saklanır; Profil sayfasından dosya, bağlantı ya da karekodla başka cihaza taşınır.

## Nasıl çalışır

Sunucu ve veritabanı yok. GitHub Actions her 30 dakikada bir `scripts/build.mjs` betiğini çalıştırır, veriyi `data/` altına üretir ve siteyi GitHub Pages'e yayınlar.

| Veri | Kaynak |
| --- | --- |
| 1950'den bugüne sonuçlar, sıralama turları, sprintler, puan durumu, pit stoplar | [F1DB](https://github.com/f1db/f1db) (CC BY 4.0), her yarıştan birkaç saat sonra güncellenir |
| Yeni seansların hızlı sonucu, takım renkleri, yarış hikâyeleri, telemetri | [OpenF1](https://openf1.org) (2023'ten bugüne ücretsiz geçmiş veri) |
| Pist krokileri | [bacinger/f1-circuits](https://github.com/bacinger/f1-circuits) (MIT) |
| Hava tahmini | [Open-Meteo](https://open-meteo.com) |
| Haberler | 11 Türkçe ve İngilizce kaynağın RSS akışı (başlık, kısa özet, kaynağa bağlantı) |
| Lastik seçimi (sıradaki yarış) | Pirelli duyuruları; `assets/tyres.json` dosyasına elle eklenir |
| 2027 takvimi | FIA / Formula 1 duyurusu (`scripts/static/calendar-2027.json`); seans saatleri açıklanınca otomatik dolar |

Canlı, saniye saniye zamanlama ücretli bir veri akışı gerektirdiği için yok; sonuçlar seans bitiminden yaklaşık yarım saat sonra gelir.

## Yerelde çalıştırma

```
npm install
node scripts/build.mjs          # veriyi data/ altına üretir (internet gerekir)
node scripts/serve.mjs 8777     # http://localhost:8777/
```

Windows'ta `baslat.bat` sunucuyu açar ve tarayıcıyı başlatır. Yerelde açılan site, internet varsa veriyi canlı siteden okur.

## Dosyalar

- `index.html`, `assets/` : site (ES modülleri, derleme adımı yok)
- `assets/js/views/` : her sayfa ayrı modül
- `scripts/` : veri hattı (`build.mjs` ve `lib/`)
- `data/stories/` : OpenF1'den üretilmiş yarış hikâyeleri (repoda saklanır)
- `data/reports/` : yarış sonrası yazılan raporlar

Resmi olmayan bir hayran projesidir; Formula 1, FIA ya da takımlarla bağı yoktur. F1 ve ilgili markalar sahiplerine aittir.
