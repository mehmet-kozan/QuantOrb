BSC sürümü hazır. 58 test geçiyor, CLI hem hazır girdiyle hem fixture üzerinden uçtan uca çalışıyor.

## Ne yapıldı

**Yapı** (ES modülleri, bağımlılık yok, Node 18+):

- [src/rules/](src/rules/) · Saf kural motoru. Solana kuralları birebir taşındı, iki hata düzeltildi: pack artık en az 3 cüzdan ister ve union-find ile kurulur, bir cüzdan iki pack'e giremez. [contract.js](src/rules/contract.js) BSC eklemesi: honeypot kırmızı bayrak, satış vergisi ≥ %20 cap.
- [src/config/rules.js](src/config/rules.js) · Tüm eşikler tek yerde, Türkçe yorumlu.
- [src/sources/](src/sources/) · Bubblemaps, GoPlus ve DexScreener istemcileri; her biri tek endpoint.
- [src/adapter.js](src/adapter.js) · Üç kaynağın cevabını kural motorunun girdisine çevirir. Havuz, borsa ve burn adreslerini dışlar, cluster'ları kanıtlı link yapar, sıradan cüzdandan gelen transferi "received, not bought" sayar, fresh cüzdanı ilk aktivite tarihinden çıkarır.
- [src/scan.js](src/scan.js) · Üç kaynağı paralel okur; biri düşerse rapor söyler. [src/cli.js](src/cli.js) adres ya da JSON dosyası alır.
- Ölçülemeyen parça (bu kaynaklarda sniper zamanlaması yok) `null` olur, kalan ağırlıklar 100'e ölçeklenir ve rapor bunu yazar.

**Dokümantasyon** Türkçe: [README.md](README.md), [docs/mimari.md](docs/mimari.md), [docs/skor.md](docs/skor.md), [docs/kaynaklar.md](docs/kaynaklar.md) (alan alan eşleme ve 6 varsayım), [docs/kararlar.md](docs/kararlar.md) (gerekçeler ve sıradaki işler). Eski İngilizce `rules/` ve docs silindi; `examples/` ve beklenen sonuçları olduğu gibi duruyor ve geçiyor.

```bash
npm test
BUBBLEMAPS_API_KEY=... node src/cli.js 0xTokenAdresi
node src/cli.js examples/site-example.json
```

## Bilmeniz gerekenler

- **Canlı veriyle doğrulanmadı.** Elimde Bubblemaps anahtarı yok. Fixture'lar yayımlanan şemalara göre yazıldı ama spec iki şeyi söylemiyor: `share` birimi (kesir mi yüzde mi) ve `clusters[].holders` içeriği (adres mi sıra mı). Adapter ikisine de savunmacı davranıyor. İlk gerçek taramada `--json` çıktısındaki `input` alanına bakmak gerekiyor.
- **Guard'ın creator geçmişi okunmuyor.** Üç kaynaktan hiçbiri "bu cüzdan kaç token çıkardı" demiyor; four.meme TokenManager2 olayları gerekir. Rapor bunu "okunmadı" olarak gösteriyor, geçer saymıyor.
- **Curve aşamasında fiyat etkisi yaklaşık.** Sabit çarpım formülü kullanılıyor; new-implementation.md'nin istediği curve satış fonksiyonu ertelendi.
- **Rapor metinleri İngilizce kaldı.** Örnek dosyaların beklenen sonuçları bu dizilere bağlı; gerekçe kararlar.md'de.
- Radar, webhook ve Telegram botu bu kapsamda değil. `new-implementation.md` dosyanız untracked duruyor, dokunmadım. Commit yapmadım.