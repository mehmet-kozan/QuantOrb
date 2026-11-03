# Kararlar

Tarihli, gerekçeli. Bir kural ya da kapsam değiştiğinde buraya bir madde eklenir.

## 2026-11-03 · four.meme ve flap.sh entegrasyonu

**İki launchpad doğrudan kontratından okunur, REST yok.** four.meme'nin `meme-api`'si script'lere Cloudflare
ile 403 döner (canlıda denendi); flap'in herkese açık bir API'si yok (SDK'daki `api.flap.sh/graphql` yer
tutucudur). Zincir anahtarsız public RPC ile okunur, iki platform için de aynı yol.

**Adres ve imzalar resmi kaynaklardan, hash'ler koddan.** `new-implementation.md` B17: hiçbir şey uydurulmadı.
four.meme için resmi `four-meme-ai` skill'i, flap için `docs.flap.sh`; hepsi 3 Kasım 2026'da canlı zincirde
doğrulandı ve ham cevaplar fixture oldu. Seçiciler ve olay konuları elle yazılmaz; `abi.js` içindeki
bağımlılıksız keccak256 imzadan hesaplar, test canlı logların konusuyla karşılaştırır. Bir bağımlılık eklemek
yerine 40 satır keccak yazmanın gerekçesi: depo bağımlılıksız kalır, hash'ler kaynağından türetilir.

**Yaratılış: önce kendi kaydımız, sonra zincir; Etherscan ve Bitquery yok.** Her iki create olayı da indexed
alan taşımadığı için "bu token'ın create olayı" doğrudan filtrelenemez. Etherscan V2 BSC'yi ücretsiz planda
vermiyor (canlıda "Free API access is not supported for this chain"); Bitquery ücretli ikinci bir indeksleyici
olurdu. Bunun yerine: lansman kaydı (`data/launches.json`, `cli.js index`) ve four.meme için DexScreener'ın
pair zamanından blok bulma (ikili arama + 5 bloklu `eth_getLogs`). Flap curve token'ları DexScreener'da
olmadığından kayıtta yoksa creator ve yaş "okunmadı" kalır; bu, uydurmaktan iyidir ve Radar kaydı canlı
beslediğinde kendiliğinden düzelir.

**Creator geçmişi kayıttan, kısmi anlamıyla.** Guard'ın kuralı değişmedi (10+ lansman, < %10 mezun). Kayıt
yalnızca gördüğü lansmanları bilir: eşiği aşan creator HELD olur, aşmayan "okunmadı" kalır, asla "temiz"
olmaz. `historyCheck` için `{ launched, graduated, since, local: true }` biçimi eklendi; eski `alive` biçimi
duruyor. Son 20 lansmanın durumu zincirden okunur; `historyMaxReads` ile sınırlı.

**Kontrat üzerinden lansmanın creator'ı bilinmez.** Canlı kayıtta en çok lansman yapan "creator" flap'in
`VaultPortal` kontratıydı (11 lansman, 0 mezun). Olaydaki creator bir kontratsa (`eth_getCode`) insan cüzdanı
olaydan okunamaz: Guard "launched through a contract · creator wallet not known", dev kontrolleri okunmadı.
Kontratın lansman sayısıyla kimseyi seri lansmancı ilan etmek yanlış pozitif üretirdi.

**Curve'de fiyat etkisi artık kesin.** Önceki sürümün "sabit çarpım yaklaşıktır" kararı kalktı: flap'in
curve'ü dokümandaki formülle sabit çarpımdır (`Rv = h + 1e9 − S`, zincirdeki fiyatı birebir verir); four.meme
curve'ünün de sabit çarpım olduğu beş `tryBuy` kotasıyla ölçüldü, Rv bir kota ve `lastPrice`'tan çözülür.
Skor motoru değişmedi: `impact(q, R)` sanal rezervle çağrılır. Mezun token'da havuz bakiyesi kullanılır.
`new-implementation.md` B8.2'nin istediği "curve'ün kendi satış fonksiyonu" böylece ayrı bir arayüz
gerektirmeden karşılandı.

**Launchpad token'ında GoPlus'ın creator alanları kullanılmaz.** GoPlus `owner_address`/`creator_address`
olarak launchpad kontratını verir; `creator_percent` de ona aittir. Dev ve dev payı create olayından ve
Bubblemaps listesinden gelir. Launchpad olmayan token'da GoPlus alanları olduğu gibi kullanılır.

**Launch bloğu token'ın Transfer loglarından.** four.meme'nin `TokenPurchase`'ı bilinir ama flap'in alım
olayı doğrulanmadı; token'ın kendi `Transfer`'leri iki platformda da aynı şekilde çalışır (mint ve launchpad
kontratları hariç alıcılar). Guard'ın "first-slot buyers" kontrolü artık zincirden; okunamazsa Bubblemaps'in
`bundles` payına düşer. Dev'in launch'ta aldığı aynı loglardan çıkar ve Shield hesaplanır.

**Flap vergisi Portal'dan.** GoPlus yeni token'da vergi vermez; flap tax token'ında `buyTaxRate/sellTaxRate`
(baz puan) kontrat kartını doldurur ve yüksek satış vergisi cap'i çalışır.

**`data/` git dışı.** Lansman kaydı makineye özeldir ve büyür.

## 2026-11-03 · BSC sürümü

**Kapsam: üç hazır kaynak, saf kural motoru, komut satırı.** `docs/new-implementation.md` TypeScript monorepo,
Postgres, Next.js ve kendi log indeksleyicisini öneriyor. Bunların yerine Bubblemaps (cluster'lar),
GoPlus (kontrat) ve DexScreener (piyasa) kullanıldı. Gerekçe: cluster bulma işini Bubblemaps zaten yapıyor ve
four.meme ile entegre; kendi indeksleyicimizi yazmak kod ve maliyet getirir, fark getirmez. Site, Radar ve bot
bu sürümde yok.

**ES modülleri, bağımlılık yok, Node 18+.** Global `fetch` yeterli. `"type": "module"`.

**Kurallar değişmedi; iki BSC eklemesi var.** Honeypot (`is_honeypot` ya da `cannot_sell_all`) kırmızı
bayrak, satış vergisi ≥ %20 cap. BSC'de kontrat riski holder riskinden önce gelir; Solana'da token programı
standart olduğu için bu kontroller yoktu.

**Ölçülemeyen parça null olur, kalan ağırlıklar 100'e ölçeklenir.** Sniper zamanlaması kaynaklarda yok.
Alternatifler: 0 puan vermek (her token 10 puan kaybeder, haksız) ya da tam puan vermek (okunamayan şey
geçer sayılır, ilkeye aykırı). Ölçeklemek ikisinden de dürüst. Rapor hangi parçanın ölçülemediğini yazar.

**Pack: en az 3 cüzdan, union-find ile, bir cüzdan tek pack'te.** Eski kod kanıtlı grup çıkarıldıktan sonra 2
cüzdanla pack üretiyor ve `a` alanına göre gruplayınca zincirli linklerde bir cüzdanı iki pack'e koyuyordu
(pay toplamı float'ı aşıyordu). İkisi için regresyon testi var. `new-implementation.md` B7 ile uyumlu.

**Shield'ın dev kontrolü arzı zorunlu ister.** Eski kod 1 milyar varsayıyordu (pump.fun sabiti). BSC'de arz
token'a göre değişir; arz bilinmiyorsa kontrol "okunmadı".

**Rapor metinleri İngilizce, dokümantasyon ve kod yorumları Türkçe.** Verdict metinleri (`gates[].text`,
`headline`) ürün dizileridir ve `examples/` içindeki beklenen sonuçlar bunlara bağlıdır. Türkçeleştirmek 12
örnek dosyayı değiştirir ve Solana sunucusunun ürettiği sonuçlarla karşılaştırmayı bozar. Kodda tanımlayıcılar
İngilizce (global konvansiyon), yorumlar ve docs Türkçe.

**Fresh tanımı: ilk aktivite ≥ token'ın yaratılışı − 1 saat.** Bubblemaps `first_activity_date` veriyor,
yaratılış launchpad'in create olayından (yoksa DexScreener `pairCreatedAt`). Tolerans, cüzdanın token'dan hemen
önce BNB alıp hazırlanmasını fresh saymak için. Token yaşı bilinmiyorsa parça ölçülemez; cüzdanın tarihi yoksa
cüzdan "unread".

**Transfer tanımı: sıradan bir cüzdandan gelen token.** Bubblemaps `relationships` içinde `from_address`
kontrat, DEX, borsa, burn ya da time node (altyapı üzerinden) değilse alıcı "received, not bought". İki top
holder arasındaysa ayrıca kanıtlı link.

**`assets/` dokunulmadı.** Görseller Solana sürümüne ait; README onları kullanmıyor. Yenilenene kadar duruyor.

## Sıradaki işler

1. **Radar**: `TokenCreate` ve `TokenCreated` olaylarını canlı dinleyip lansman kaydını beslemek ve her
   lansmanda Shield'ı çalıştırmak (`new-implementation.md` B12). Kayıt ve Shield hazır; dinleyici yok.
2. **Sniper zamanlaması**: four.meme için `TokenPurchase` logları (imza doğrulandı), flap için alım olayının
   imzası doğrulanmalı. Launch bloğundan sonraki ilk saniyelerin alıcıları `sniper` parçasını ölçer.
3. **Arşiv RPC ile eski token'lar**: `BSC_RPC_URL` arşiv destekliyse yaratılış iki günden eski token'larda da
   zincirden bulunur; kayıt dolduran komut daha geriye gidebilir.
4. **Önbellek**: Bubblemaps ücretli; aynı token 10 dakika içinde tekrar çağrılmasın.
5. **Canlı doğrulama**: `docs/kaynaklar.md` içindeki Bubblemaps varsayımları gerçek bir token'da test edilip
   fixture'lar gerçek (anonimleştirilmiş) cevaplarla değiştirilecek; four.meme curve modeli curve'ün ortasında
   ve Tax Token şablonunda yeniden ölçülecek.
6. Webhook ve Telegram botu (`new-implementation.md` B13).
