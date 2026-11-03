# BSC Memecoin Holder Scanner: Geliştirme Talimatı

> Bu dosya iki iş görüyor. Birinci bölüm şimdiye kadar konuştuklarımızın özeti. İkinci bölümden itibaren Claude Code'a (ya da başka bir geliştirme ajanına) verilecek ürün ve teknik talimat var. Talimat kısmını proje köküne `CLAUDE.md` veya `docs/SPEC.md` olarak koyabilirsin.

---

## Bölüm A: Konuşma özeti

### four.meme nasıl çalışıyor
- BNB Chain üzerinde bir memecoin launchpad. Herkes token oluşturabiliyor, işlemler BNB ile yapılıyor.
- Yeni token önce platformun **bonding curve** kontratında işlem görüyor. Fiyatı alımlar artırıyor, satımlar düşürüyor. Ön satış ya da ekip payı yok.
- Curve dolunca token **graduate** oluyor ve likiditesi PancakeSwap'e taşınıyor.
- Token tipleri: Normal, **Tax Token** (alım/satım vergili, ör. "Tax 10% / 10%") ve Open Four.
- Ana sayfada gözlemlenenler: aynı birkaç cüzdan art arda %10 vergili tokenlar açıyor. Aynı isimli kopya tokenlar var. Yeni tokenların neredeyse hepsi yaklaşık 3.19K market cap ile başlıyor.

### Advanced sayfası sekmeleri
| Sekme | Anlamı |
|---|---|
| Newly Created | En yeni lansmanlar (spam ve kopyaların en yoğun olduğu yer) |
| About to Launch | Curve'ü dolmak üzere olan, mezuniyete yakın tokenlar |
| Trading Volume | Belli bir sürede en yüksek işlem hacmi olan tokenlar |
| Graduated | PancakeSwap'e geçmiş tokenlar |
| Hot | Hacim, alım sayısı ve fiyat hareketine göre o an en popüler tokenlar |

Satırlardaki alanlar: curve doluluk yüzdesi, token yaşı, kontrat adresi, holder sayısı, MC, VOL, vergi etiketi ve "⚡ 0.1" hızlı alım butonu.
Not: Doluluk oranı tek başına güven göstermez. Örneğin 3 aylık, %49 dolu ama sadece 3 holder'ı olan bir token vardı.

### Campaign sayfası
Trading yarışmaları (GMGN, DeBot, Ave, Maestro gibi ortaklarla), exclusive presale ve TGE'ler, airdrop'lar ve çekilişler listeleniyor. Konuştuğumuz tarihte listedeki tüm kampanyalar bitmişti (ENDED).

### Four.meme Agent Skill (`@four-meme/four-meme-ai`)
- Kurulum: `pnpm add -g @four-meme/four-meme-ai@latest` ve `npx skills add four-meme-community/four-meme-ai`
- Ortam değişkenleri: `PRIVATE_KEY` (sadece işlem imzalayan komutlarda gerekli) ve `BSC_RPC_URL` (isteğe bağlı)
- README'ye göre OpenClaw dışında `.env` otomatik yüklenmiyor. Komutlardan önce `set -a; source .env; set +a` çalıştırmak gerekiyor.
- Bu proje için önemli olan **salt okunur** komutlar:
  - `config`, `token-info`, `token-get`, `token-list`, `token-rankings`
  - `events <fromBlock> [toBlock]`: TokenManager2'nin create, trade ve liquidity olayları
  - `tax-info`, `quote-sell`, `verify`
- Sadece BSC ve TokenManager **V2** destekleniyor.
- Güvenlik: işlem yapacaksan ayrı bir hot wallet kullan. Bu tarayıcının private key'e **hiç ihtiyacı yok** ve salt okunur kalmalı.

---

## Bölüm B: Ürün talimatı

### B1. Amaç
BSC'deki memecoin'lerin, özellikle four.meme lansmanlarının, **gerçekte kimin kontrolünde olduğunu** gösteren bir tarayıcı geliştir. Trader'ın bir tokena girmeden önce rug pull veya koordineli dump riskini görmesi hedefleniyor.

Temel fikir şu: Kullanıcı bir token adresi yapıştırır. Sistem en büyük 20 holder'ı zincirden okur. Birbirine bağlı cüzdanları tek bir **operatör** olarak birleştirir. Böylece "20 cüzdan" görünen bir tokenın aslında 4 kişinin elinde olduğu ortaya çıkar. Ardından şunları üretir:
- 0–100 arası bir skor ve bant: CLEAN / OK / RISKY / DANGER
- En büyük operatör satarsa beklenen fiyat düşüşü
- Owner yetkileri, likidite kontrolü ve creator geçmişi kontrolleri (Guard ve Shield)

### B2. Ürünün üç parçası
1. **Scan (web sitesi):** Token adresi girilir, rapor sayfası gösterilir. Her rapor paylaşılabilir bir URL ile açılır (`/t/<address>`).
2. **Radar:** Her yeni four.meme lansmanını anlık izler. Shield kontrollerini çalıştırır, uygun anlarda otomatik tarama tetikler ve canlı bir grid'de gösterir.
3. **Callback (alarm):** Radar ve Scan sonuçlarını webhook'a ve Telegram botuna gönderir.

### B3. Kısıtlar
- Sistem **tamamen salt okunur** olmalı. Private key tutulmaz, işlem imzalanmaz, alım/satım butonu konmaz.
- Her eşik değeri koddan bağımsız, tek bir `config/rules.ts` (veya `rules.json`) dosyasında durmalı. Bölüm B9'daki tablonun birebir karşılığı olmalı.
- Okunamayan veri **hiçbir zaman kanıt sayılmaz**: ne lehte ne aleyhte. `null` / "not read" olarak taşınır ve arayüzde açıkça gösterilir.
- Skor motoru saf (pure) bir fonksiyon olmalı. Ağ çağrısı yapmamalı, girdisi normalize edilmiş bir `ScanInput` olmalı. Böylece fixture'larla test edilebilir.

### B4. Önerilen teknik yapı
Bu bir öneridir; değiştirilecekse gerekçesi yazılmalı.

- **Dil ve çalışma ortamı:** TypeScript, Node 20+, monorepo (pnpm workspaces)
- **Zincir erişimi:** `viem` ile HTTP ve WebSocket BSC RPC. Ayrıca toplu `eth_getLogs` için arşiv destekli bir sağlayıcı.
- **Holder listesi:** RPC top holder vermediği için iki yol var:
  - (a) Token'ın `Transfer` loglarını yaratılış bloğundan itibaren indeksleyip bakiye tablosu tutmak. four.meme tokenları genç olduğu için çoğu durumda bu ucuz.
  - (b) Bir holder API'si (BscScan/Etherscan v2, Moralis, Covalent vb.) kullanmak.
  - Varsayılan (a) olsun, (b) yedek olarak kalsın.
- **four.meme verisi:** TokenManager2 olayları (create, trade, graduate) ve curve durumu. Kontrat adreslerini ve ABI'leri **uydurma**: `@four-meme/four-meme-ai` paketinden ve resmi Gitbook'tan (protocol-integration) al.
- **Fiyat ve likidite:** PancakeSwap v2 pair rezervleri. Gerekirse DexScreener API'si yedek olarak kullanılabilir.
- **Depolama:** Postgres. Geliştirme ortamında SQLite olabilir. Tablolar: `tokens`, `scans`, `wallet_first_seen`, `creator_launches`, `alerts`.
- **Web:** Next.js. Rapor sayfası ve Radar grid'i server-sent events veya WebSocket ile canlı güncellenir.
- **Paket yapısı:**
  ```
  packages/
    chain/        # RPC, log indeksleme, holder çözümleme, rezervler
    fourmeme/     # TokenManager2 olayları, curve durumu, creator geçmişi
    engine/       # saf skor motoru: operators, score, flags, caps, guard, shield
    radar/        # canlı lansman izleyici + tetikleyici
    notify/       # webhook + telegram
  apps/
    web/          # scan sitesi + radar grid
  ```

### B5. Tanımlar
Kod ve arayüzde bu terimler tutarlı kullanılmalı.

- **Hariç adresler (excluded):** bonding curve kontratı, DEX pair/havuz adresleri, bilinen locker'lar, burn adresleri (`0x000…0`, `0x…dEaD`). Bunlar holder sayılmaz.
- **Float:** toplam arz eksi hariç adreslerdeki bakiye. Tüm "pay" hesapları float'a göre yapılır.
- **Top 20:** hariç adresler çıkarıldıktan sonra bakiyesi en yüksek 20 cüzdan.
- **Dev:** create işlemini gönderen cüzdan.
- **Fresh wallet:** bu tokenla ilk etkileşiminden önce zincirde hiç işlemi olmayan cüzdan (nonce ve gelen transfer geçmişi birlikte kontrol edilir).
- **Sniper:** tokenın ilk alım işleminden itibaren **≤ 30 saniye** içinde alım yapmış ve o zamandan beri hiç satmamış cüzdan. Pencere kapalı aralıktır, yani tam 30. saniye de dahildir.
- **Launch slot:** create işleminin bulunduğu blok.
- **Received, not bought:** cüzdana swap veya curve alımı yerine düz transferle gelen token miktarı.
- **Unread:** zaman aşımı veya hata nedeniyle derin okuması tamamlanamayan cüzdan.
- **Deep read:** cüzdanın geçmişini, ilk görülme zamanını ve aldığı transferleri okumak. Sadece float payı **≥ %0.2** olan cüzdanlar için yapılır.

### B6. Tarama akışı
Adımlar sırayla çalışır. İlk eşleşen erken çıkış durumu sonucu belirler.

1. **Ön veri:** arz, hariç adresler, float, top 20, likidite (USD), market cap (yoksa FDV), token yaşı, curve durumu (graduate olmuş mu).
2. **TOO ESTABLISHED → skor yok.** Üç koşulun **hepsi** sağlanırsa: yaş > 30 gün, likidite > $500K, market cap (bilinmiyorsa FDV) > $10M.
3. **TOO EARLY → skor yok.** Hariç adresler dışında **10'dan az** holder varsa.
4. **Deep read:** top 20 içindeki float payı ≥ %0.2 olan cüzdanlar paralel okunur. Her cüzdan için zaman sınırı konur (config'de, ör. 4 sn). Süresi dolan cüzdan `unread` olarak işaretlenir.
5. **Operatörler** kurulur (B7).
6. **Skor parçaları** hesaplanır (B8.1), ardından kırmızı bayraklar (B8.3), cap'ler (B8.4), bant (B8.5) ve senaryo (B8.6).
7. **Guard** her durumda, TOO EARLY ve TOO ESTABLISHED'de de bağımsız çalışır. Skoru etkilemez (B10).

### B7. Operatör kurma

**Kanıtlı link (proven).** Aşağıdakilerden herhangi biri iki cüzdanı aynı operatöre bağlar:
- Aynı alım işleminde birlikte token alan cüzdanlar (tek tx'te birden fazla alıcı, bundler)
- Token'ı aynı ara cüzdandan almış cüzdanlar (ortak kaynak cüzdan, hariç adresler dışında)
- Top holder'lar arasında doğrudan token transferi

Linkler **union-find** ile zincirlenir: A–B ve B–C linkleri varsa üçü tek operatör olur.

**Pack (davranışsal grup, kanıt değil).**
- Aynı pencerede (config'de) birlikte giren fresh cüzdanlardan oluşur.
- Kanıtlı bir operatöre giren cüzdan pack'e alınmaz.
- **Karar:** Pack, kanıtlı cüzdanlar çıkarıldıktan sonra **en az 3 cüzdan** kalırsa oluşur. Mevcut kodda 2 cüzdanla da pack oluşuyor; bu bir **hata**, düzeltilecek.
- **Karar:** Bir cüzdan en fazla **bir** pack'te bulunabilir. Pack'ler ayrı bir union-find ile kurulur, ya da her cüzdan en erken giriş yapan çapa cüzdanın pack'ine atanır. Böylece çift sayma engellenir. Bunun için bir regresyon testi yazılacak.
- Pack payı sıralamada ve fiyat etkisinde **0.6** ağırlıkla sayılır.

**Diğer cüzdanlar.** Kanıtlı operatöre veya pack'e girmeyen her cüzdan tek başına bir operatördür.

**Sıralama.** Operatörler ağırlıklı paya göre sıralanır: kanıtlı ve tekil operatörler 1.0, pack'ler 0.6 ağırlıkla. En üstteki operatör **biggest operator** olur.

### B8. Skor

#### B8.1 Beş parça (toplam 100)
Her parça top 20 üzerinden ölçülür. Birinci eşikte tam puan, ikinci eşikte sıfır puan verilir, arası doğrusal.

| Parça | Puan | Tam puan | Sıfır | Ölçülen değer |
|---|---:|---|---|---|
| Biggest operator | 35 | drop ≤ %10 | drop ≥ %60 | En büyük operatör tamamını satarsa fiyat düşüşü |
| Fresh wallets | 25 | ≤ %10 | ≥ %80 | Okunan top cüzdanlarda fresh olanların **sayı** oranı |
| Received, not bought | 20 | ≤ %1 | ≥ %10 | Float'ın transferle gelen payı |
| Unsold snipers | 10 | ≤ %1 | ≥ %15 | Satmamış sniper'ların float payı |
| Top-20 share | 10 | ≤ %25 | ≥ %70 | Top 20'nin toplam float payı |

```ts
part = points * clamp((zero - x) / (zero - full), 0, 1)
```
- Her parça 0.1'e yuvarlanır. Toplam tam sayıya yuvarlanır.
- Dev cüzdanı fresh ve sniper hesabına katılmaz.
- Unread cüzdanlar fresh oranının paydasına girmez. Okunan cüzdan sayısı 0 ise fresh parçası `null` olur ve arayüzde belirtilir. Bu durumda nasıl puanlanacağı açık bir karar olarak bırakıldı: varsayılan olarak tam puan verme, 0 puan ver ve PARTIAL notu düş.
- Fresh oranı **cüzdan sayısıyla** hesaplanır. Transfer, sniper ve top-20 parçaları **pay** üzerinden hesaplanır.

#### B8.2 Fiyat etkisi
Sabit çarpım havuzunda R havuzdaki token rezervi, q satılan miktar olsun:
```
drop = 1 − (R / (R + q))²
```
- Havuzdaki rezerv kadar token satmak (q = R) %75 düşüş demektir.
- Biggest operator için q = ağırlıklı pay × float.
- **Önemli:** Bu formül yalnızca **graduate olmuş** (PancakeSwap havuzu olan) tokenlar için geçerli. Henüz curve üzerindeki four.meme tokenlarında sabit çarpım havuzu yok. Bu tokenlarda düşüş, curve'ün kendi satış fonksiyonuyla hesaplanmalı (TokenManager2 helper'ının sell quote'u, `fourmeme quote-sell` ile aynı mantık). Sonuç fiyat oranından türetilmeli: `1 − p_after / p_before`. `priceImpact(token, q)` adında, curve ve AMM için ayrı implementasyonları olan tek bir arayüz yaz.
- Vergili tokenlarda satış vergisi drop hesabına dahil edilmez, raporda ayrı bir satır olarak gösterilir.

#### B8.3 Kırmızı bayraklar: skor ne olursa olsun DANGER
| Kural | Koşul |
|---|---|
| Bağlı operatör satışı | drop ≥ %50 **ve** operatördeki cüzdan sayısı > 1 |
| Fresh yoğunluğu | okunan top cüzdanların ≥ %80'i fresh (en az 1 okunan cüzdan varsa) |
| Transferle gelen float | ≥ %10 |

#### B8.4 Cap'ler: en iyi ihtimalle RISKY (skor 59'a indirilir)
| Kural | Koşul |
|---|---|
| Kanıtlı operatör | 3 veya daha fazla cüzdanlı kanıtlı bir operatör float'ta pay tutuyor |
| Pack | en az bir pack var |
| Tek balina | tek cüzdanlı en büyük holder drop ≥ %50 (etiketi: "dürüst balina riski, rug değil") |
| Düşük likidite | likidite biliniyor ve < $1,000 |
| PARTIAL | 3 veya daha fazla deep-read adayı cüzdan okunamadı |

- Likidite bilinmiyorsa (`null`) cap **uygulanmaz**.
- Float payı < %0.2 olan cüzdanlar deep read'e girmez. Okunmamaları PARTIAL sayılmaz.
- 1 veya 2 unread cüzdan sadece not olarak düşülür, cap uygulanmaz.
- Cap sadece skor > 59 ise skoru 59'a indirir. Daha düşük skoru değiştirmez.

#### B8.5 Bant
| Bant | Koşul |
|---|---|
| DANGER | herhangi bir kırmızı bayrak **veya** skor < 40 |
| RISKY | 40–59 (cap uygulanmış skorlar dahil) |
| OK | 60–79 |
| CLEAN | 80+ |

#### B8.6 Satış senaryosu (sadece DANGER'da)
- **Şüpheli küme:** bağlı operatördeki cüzdanlar, transferle alanlar, fresh cüzdanlar ve launch slotunda alıp satmamış cüzdanlar. Küme tekilleştirilir (union).
- Kümenin toplam payı havuza satılırsa hesaplanan düşüş ≥ %40 ise senaryo gösterilir.
- Senaryo skoru değiştirmez. Arayüzde **"tahmin değil, senaryo"** etiketiyle gösterilir.

#### B8.7 Başlık metni
```
"{N} wallets → {M} operators, biggest holds {X}% of float"
+ (drop ≥ 1% ise) ", could move price −{Y}% if sold"
```

### B9. Eşikler (`config/rules.ts`)
| Anahtar | Değer |
|---|---|
| minHolders | 10 |
| topN | 20 |
| deepMinShare | 0.002 |
| deepReadTimeoutMs | 4000 (önerilen) |
| lowLiquidityUsd | 1000 |
| established.days / liqUsd / mcapUsd | 30 / 500_000 / 10_000_000 |
| sniperWindowSec | 30 (kapalı aralık) |
| packWeight | 0.6 |
| packMinWallets | 3 |
| partialMinUnread | 3 |
| redFlag.linkedDrop / freshRate / receivedShare | 0.50 / 0.80 / 0.10 |
| cap.scoreCeiling | 59 |
| cap.provenMinWallets / whaleDrop | 3 / 0.50 |
| bands.danger / risky / ok | <40 / 40–59 / 60–79 |
| scenario.minDrop | 0.40 |
| guard.historyMinLaunched | 10 |
| guard.historyMaxGradRate | 0.10 |
| guard.historyMaxAliveRate | 0.20 |
| guard.slot0Max | 0.30 |
| guard.devMax | 0.15 |
| shield.minLaunches / maxGradPct / devMax | 10 / 0.10 / 0.15 |
| shield.triggerCurvePct / triggerBuyers | 0.10 / 20 |
| curve.totalSupply | 1e9 (varsayılan; mümkünse zincirden okunur) |

### B10. Guard (token sayfası ve tarama)
Guard'daki kontrollerden **herhangi biri** başarısız olursa sonuç **HELD** olur ve ilk başarısız kontrolün gerekçesi gösterilir. Her kontrolün sonucu `true`, `false` veya `null` (okunmadı) olabilir.
- Hiçbir kontrol başarısız değilse ama okunmamış kontrol varsa sonuç **"PASS so far"** olur, rozet "GUARD · PARTIAL" olarak gösterilir.
- Tüm kontroller geçerse sonuç **PASS** olur.

| Kontrol | HELD koşulu |
|---|---|
| Creator history (zincir) | ≥ 10 lansman ve mezun oranı < %10 |
| Creator history (sunucu kaydı) | ≥ 10 lansman ve hayatta kalma oranı < %20. Sadece **aleyhe** kanıt olarak kullanılır. Creator seri lansmancı değilse sonuç "not read" olur |
| Creator history (eski kaynak) | ≥ 10 lansman ve alive oranı < %20 |
| First-slot buyers | launch slotunda alınan arz ≥ %30 |
| Dev holdings | dev şu an arzın ≥ %15'ini tutuyor |

**Netleştirilecek karar:** Üç creator history kaynağı birbiriyle çelişirse hangisinin geçerli olacağı belirlenmeli. Öneri: Herhangi bir kaynak HELD diyorsa HELD olsun (en kötü sonuç kazanır). Gerekçede kaynak adı yazılsın. "Hayatta" tanımı da (ör. son 24 saatte işlem görmüş ve likiditesi > X) config'e yazılmalı.

**Ek kontroller.** Bunlar Guard rozetini etkilemez, raporda ayrı bir "Contract" kartında gösterilir:
- Owner yetkileri: `owner()`, ownership renounce edilmiş mi, mint, pause/freeze, blacklist, vergi oranını değiştirme yetkisi. four.meme standart şablonu ise kontratın şablonla eşleştiği belirtilir.
- Likidite: LP token'ları kimde, kilitli mi (locker adresi ve kilit süresi) veya yakılmış mı. Curve aşamasında "likidite curve kontratında" olarak gösterilir.
- Tax token: alım/satım oranı ve verginin nereye gittiği (`tax-info` ile aynı veri).

### B11. Shield (Radar, grid ve bot alarmları)
| Kontrol | HELD koşulu |
|---|---|
| Creator history | ≥ 10 lansman ve mezun oranı < %10 (Guard'daki kuralla aynı). Curve %10'a **veya** 20 alıcıya ulaşınca okunur. 0 lansman cevabı "unavailable" sayılır, geçmiş sayılmaz |
| Dev at launch | create işleminde dev'in aldığı pay ≥ %15 (arz varsayılan olarak 1 milyar) |

### B12. Radar
- WebSocket ile TokenManager2'nin create olaylarına abone ol. Bağlantı koparsa son işlenen bloktan itibaren `getLogs` ile boşluğu doldur (backfill). Hiçbir lansman kaçırılmamalı.
- Her yeni token için bir kayıt aç ve Dev at launch kontrolünü hemen çalıştır.
- Trade olaylarıyla curve yüzdesini ve alıcı sayısını takip et. Eşiğe (%10 veya 20 alıcı) ulaşınca creator history'yi oku ve ilk tam taramayı tetikle.
- Önerilen yeniden tarama noktaları: curve %25, %50, %80 ve graduate anı. Bunlar config'de tutulsun.
- Grid kolonları: token, yaş, curve %, holder, MC, Shield rozeti, son skor/bant, başlık metni.
- Rate limit ve kuyruk: aynı anda çok sayıda lansman olabilir. Taramalar kuyruğa alınır ve eşzamanlılık sınırı uygulanır.

### B13. Callback ve alarmlar
- **Webhook:** `POST` ile JSON gövde gönderilir: `{ event, token, band, score, headline, shield, guard, scanUrl, ts }`. İstek `X-Signature: HMAC-SHA256` başlığıyla imzalanır. Başarısız gönderimler üstel bekleme ile yeniden denenir (ör. 5 deneme). Her gönderim bir idempotency anahtarı taşır.
- **Olay tipleri:** `launch.shield_held`, `scan.danger`, `scan.band_changed`, `token.graduated`
- **Telegram botu:** Kullanıcı `/watch <adres>` ile token takibe alır. Filtre seçenekleri: sadece DANGER, sadece Shield PASS, vb.
- Alarm metni her zaman bandı, başlığı ve rapor linkini içerir. Yatırım tavsiyesi dili kullanılmaz.

### B14. Rapor sayfası (Scan)
Yukarıdan aşağıya sırayla:
1. Bant rozeti, skor ve başlık metni
2. Guard rozeti (PASS, PASS so far veya HELD ve gerekçesi)
3. Operatör tablosu: her operatör için cüzdan sayısı, tipi (kanıtlı, pack, tekil), ham pay, ağırlıklı pay ve satarsa fiyat etkisi. Satır açılınca link kanıtları görünür (tx hash'leri)
4. Beş skor parçası: ham değer, eşikler ve alınan puan
5. Tetiklenen kırmızı bayraklar ve cap'ler
6. DANGER ise satış senaryosu
7. Contract kartı (owner yetkileri, LP, vergi)
8. Creator geçmişi
9. Veri kalitesi: unread cüzdanlar, `null` alanlar, tarama zamanı, blok numarası

### B15. Testler (zorunlu)
- `engine` paketi için %100 dal kapsamı hedeflenir. Tüm eşik sınırları test edilir (tam eşik değeri, hemen altı ve hemen üstü).
- **Golden fixture'lar:** gerçek tokenlardan anonimleştirilmiş `ScanInput` JSON'ları ve beklenen çıktılar (`expected.json`).
- **Regresyon testleri:**
  - (1) Kanıtlı grup çıkarıldıktan sonra 2 cüzdan kalınca pack oluşmamalı.
  - (2) Bir cüzdan iki pack'e girmemeli. Pay çift sayılmamalı.
  - (3) Likidite `null` iken cap uygulanmamalı.
  - (4) Unread cüzdan hiçbir kuralda kanıt sayılmamalı.
  - (5) q = R olduğunda drop = 0.75 olmalı.
- Curve ve AMM için fiyat etkisi testleri ayrı yazılır.

### B16. Geliştirme sırası
1. `engine`: saf skor motoru, `rules.ts` ve testler. Zincir bağlantısı olmadan, sadece fixture'larla çalışır.
2. `chain` ve `fourmeme`: holder çözümleme, deep read, fiyat etkisi, creator geçmişi.
3. CLI: `scan <address> --json` ile uçtan uca rapor alınabilmeli.
4. `apps/web`: rapor sayfası.
5. `radar`: canlı izleme ve Shield.
6. `notify`: webhook ve Telegram.

Her adımın sonunda: testler yeşil olmalı, `README` güncellenmeli ve bilinen sınırlamalar listelenmeli.

### B17. Ajan için çalışma kuralları
- Kontrat adresi, ABI veya API uç noktası **uydurma**. Kaynak bulamıyorsan dur ve sor.
- Bu dokümandaki bir kuralı değiştirmen gerekirse önce kodda yorum olarak değil, `docs/DECISIONS.md` dosyasına tarih ve gerekçeyle yaz.
- Doküman ile kod arasında fark bulursan raporla. Sessizce birini seçme.
- Hiçbir modül private key okumaz ve işlem imzalamaz.