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


four.meme ve flap.sh entegrasyonu tamam. 68 test geçiyor; launchpad katmanı canlı zincirde iki gerçek token'la uçtan uca denendi.

## Ne eklendi

- **Zincir katmanı** [src/sources/rpc.js](src/sources/rpc.js) ve [src/sources/abi.js](src/sources/abi.js): bağımlılıksız JSON-RPC ve ABI (keccak256 dahil). Seçiciler ve olay konuları depoda yazılı değil, imzadan hesaplanıyor; test canlı logların konusuyla karşılaştırıyor.
- **İki launchpad** [src/sources/fourmeme.js](src/sources/fourmeme.js), [src/sources/flap.js](src/sources/flap.js), [src/sources/launchpad.js](src/sources/launchpad.js): platform tespiti, curve/mezun, ilerleme, creator, yaratılış zamanı, launch bloğu alıcıları, dev'in aldığı, flap vergileri. Adresler ve imzalar resmi four-meme-ai skill'i ve docs.flap.sh'ten; hiçbiri uydurulmadı.
- **Curve'de fiyat etkisi artık kesin.** İki curve de sabit çarpım çıktı: flap'te dokümandaki formül zincirdeki fiyatı birebir veriyor, four.meme'de beş tryBuy kotasıyla ölçtüm. Skor motoru değişmedi, sanal rezerv veriliyor.
- **Lansman kaydı** [src/record.js](src/record.js): `node src/cli.js index 20000` iki platformun create olaylarını `data/launches.json`'a yazar. Creator geçmişi buradan gelir; Guard'ın üç kontrolü ve Shield artık zincirden besleniyor.
- Rapora Launchpad ve Shield kartları eklendi. Dokümanlar güncellendi: [kaynaklar.md](docs/kaynaklar.md) (doğrulanan her olgu), [kararlar.md](docs/kararlar.md) (gerekçeler), [mimari.md](docs/mimari.md), [skor.md](docs/skor.md), README, CHANGELOG.

## Canlıda öğrenilen ve karar gerektiren şeyler

- **four.meme REST API kullanılamıyor.** Script isteğine Cloudflare 403 dönüyor; her şey kontrattan okunuyor.
- **Etherscan BSC'yi ücretsiz vermiyor**, Bitquery ücretli ikinci indeksleyici olurdu. Bu yüzden yaratılış önce kendi kayıttan, four.meme için DexScreener zamanından zincirden bulunuyor. Flap curve token'ı kayıtta yoksa creator ve yaş "okunmadı" kalıyor. Radar kaydı canlı besleyince düzelir.
- **Public RPC yaklaşık iki günlük log veriyor.** Daha eski token'lar için `BSC_RPC_URL` ile arşiv node gerekir.
- **Flap'te creator bir kontrat olabilir.** Canlı kayıtta en çok lansman yapan "creator" VaultPortal kontratıydı. Kontrat creator'ı Guard'da "okunmadı" sayılıyor; aksi halde her vault lansmanı seri lansmancı olurdu.
- **Launchpad token'ında GoPlus'ın creator alanları yanlış** (launchpad kontratını gösteriyor), artık kullanılmıyor.
- four.meme curve modeli lansman anındaki bir token'da doğrulandı; curve'ün ortasında ve Tax Token şablonunda yeniden ölçülmeli (kararlar.md'de sıradaki işlerde).

Bubblemaps anahtarı olmadığı için tam tarama canlıda denenmedi; launchpad katmanı ve kayıt denendi. Commit yapmadım; `data/` gitignore'a girdi.