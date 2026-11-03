# Kararlar

Tarihli, gerekçeli. Bir kural ya da kapsam değiştiğinde buraya bir madde eklenir.

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

**Ölçülemeyen parça null olur, kalan ağırlıklar 100'e ölçeklenir.** Sniper zamanlaması üç kaynakta yok.
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

**Fresh tanımı: ilk aktivite ≥ token'ın ilk pair'i − 1 saat.** Bubblemaps `first_activity_date` veriyor,
DexScreener `pairCreatedAt` veriyor. Tolerans, cüzdanın token'dan hemen önce BNB alıp hazırlanmasını fresh
saymak için. Token yaşı bilinmiyorsa parça ölçülemez; cüzdanın tarihi yoksa cüzdan "unread".

**Transfer tanımı: sıradan bir cüzdandan gelen token.** Bubblemaps `relationships` içinde `from_address`
kontrat, DEX, borsa, burn ya da time node (altyapı üzerinden) değilse alıcı "received, not bought". İki top
holder arasındaysa ayrıca kanıtlı link.

**Rezerv: havuz adresinin token bakiyesi.** Önce GoPlus'ın bildiği pair, yoksa en büyük DEX adresi, yoksa
en büyük kontrat (bonding curve). Curve'de sabit çarpım formülü yaklaşıktır; `new-implementation.md` B8.2
curve'ün kendi satış fonksiyonunu istiyor. Bu, four.meme kontratıyla konuşmayı gerektirir ve ertelendi.

**`assets/` dokunulmadı.** Görseller Solana sürümüne ait; README onları kullanmıyor. Yenilenene kadar duruyor.

## Sıradaki işler

1. **four.meme olay okuyucusu** (`TokenManager2` create ve trade olayları): creator geçmişi → Guard'ın ilk
   kontrolü ve Shield; launch bloğu alıcıları → `bundle` bayrağı; giriş zamanı → sniper ve pack. ABI ve
   adresler `@four-meme/four-meme-ai` paketinden ve resmi dokümandan alınacak, uydurulmayacak.
2. **Curve fiyat etkisi**: `priceImpact(token, q)` arayüzü, curve ve AMM için ayrı.
3. **Önbellek**: Bubblemaps ücretli; aynı token 10 dakika içinde tekrar çağrılmasın.
4. **Canlı doğrulama**: `docs/kaynaklar.md` içindeki 6 varsayım gerçek bir token'da test edilip fixture'lar
   gerçek (anonimleştirilmiş) cevaplarla değiştirilecek.
5. Radar, webhook ve Telegram botu (`new-implementation.md` B12–B13).
