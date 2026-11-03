# Skor kuralları

Kod: [`src/rules/`](../src/rules). Eşikler: [`src/config/rules.js`](../src/config/rules.js). Bu sayfa
koddan çıkarılmıştır; ikisi ayrışırsa kod kazanır ve bu sayfa düzeltilir.

## 1. Tarama sırası

İlk eşleşen durum sonucu belirler. Guard ve kontrat kapıları her durumda eklenir.

1. **TOO ESTABLISHED** → skor yok. Üç koşul birden: yaş > 30 gün, likidite > $500K, market cap (bilinmiyorsa FDV) > $10M.
2. **TOO EARLY** → skor yok. Havuz, curve, borsa ve burn adresleri dışında 10'dan az cüzdan.
3. **Operatörler** kurulur.
4. **Skor** hesaplanır.

## 2. Beş parça, toplam 100

Her parça top 20 holder üzerinden ölçülür. İlk eşikte tam puan, ikinci eşikte sıfır, arada doğrusal.
Parçalar 0.1'e, toplam tam sayıya yuvarlanır.

| Parça | Puan | Tam puan | Sıfır | Ölçülen |
|---|---:|---|---|---|
| Biggest operator | 35 | drop ≤ %10 | drop ≥ %60 | En büyük operatör her şeyi satarsa fiyat düşüşü |
| Fresh wallets | 25 | ≤ %10 | ≥ %80 | Okunan top cüzdanlar içinde token'dan önce aktivitesi olmayanların **sayı** oranı |
| Received, not bought | 20 | ≤ %1 | ≥ %10 | Float'ın swap yerine transferle gelen **payı** |
| Unsold snipers | 10 | ≤ %1 | ≥ %15 | İlk 30 saniyede alıp satmamış cüzdanların payı |
| Top-20 share | 10 | ≤ %25 | ≥ %70 | Top 20'nin toplam float payı |

```
parça = puan × (sıfır − x) / (sıfır − tam)      0 ile 1 arasına kırpılır
```

- Dev cüzdanı fresh ve sniper hesabına girmez.
- Okunamayan (unread) cüzdan fresh oranının paydasına girmez.
- **Ölçülemeyen parça** (`unmeasured`) `null` olur, toplam kalan ağırlıklara göre 100'e ölçeklenir ve rapor
  hangi parçanın ölçülemediğini söyler. Ölçülemeyen parça bayrak da vermez.

### Fiyat etkisi

Sabit çarpım havuzu; R havuzdaki token, q satılan miktar:

```
drop = 1 − (R / (R + q))²            q = R → %75
```

En büyük operatör için q = ağırlıklı pay × float. Havuz bilinmiyorsa "operator" parçası ölçülemez.

## 3. Operatörler

- **Kanıtlı link** iki cüzdanı tek operatörde birleştirir ve zincirlenir (union-find): A–B ve B–C ise üçü
  bir operatör. BSC sürümünde kanıt: Bubblemaps cluster üyeliği ve iki top holder arasında doğrudan transfer.
- **Pack**: birlikte giren fresh cüzdanlar. Davranıştır, kanıt değil; payı **0.6** ile sayılır. Kanıtlı
  operatördeki cüzdan pack'e girmez; geriye **en az 3** cüzdan kalırsa pack oluşur. Bir cüzdan en fazla bir
  pack'tedir. (Bu kaynaklarda giriş zamanı olmadığı için pack linki üretilmiyor; kural hazır duruyor.)
- Diğer herkes tek başına operatördür.
- Sıralama ağırlıklı paya göre; en üstteki **biggest operator**.

## 4. Kırmızı bayraklar: skor ne olursa olsun DANGER

| Kural | Koşul |
|---|---|
| Bağlı operatör satışı | drop ≥ %50 ve operatörde 2+ cüzdan |
| Fresh yoğunluğu | okunan top cüzdanların ≥ %80'i fresh |
| Transferle gelen float | ≥ %10 |
| **Honeypot** (BSC) | GoPlus `is_honeypot` = 1, ya da `cannot_sell_all` = 1 |

## 5. Cap'ler: en iyi ihtimalle RISKY (skor 59'a çekilir)

| Kural | Koşul |
|---|---|
| Kanıtlı operatör | 3+ cüzdanlı kanıtlı operatör |
| Pack | herhangi bir pack |
| Tek balina | tek cüzdanlı en büyük holder drop ≥ %50: dürüst balina risktir, rug değil |
| Düşük likidite | likidite biliniyor ve < $1,000 |
| PARTIAL | 3+ cüzdan okunamadı |
| **Yüksek satış vergisi** (BSC) | GoPlus `sell_tax` ≥ %20 |

- Bilinmeyen likidite (`null`) cap uygulamaz.
- Float'ın %0.2'sinden küçük cüzdanlar derin okunmaz; okunamamaları PARTIAL'a sayılmaz.
- 1–2 okunamayan cüzdan sadece not düşer.

## 6. Bant ve senaryo

| Bant | Koşul |
|---|---|
| DANGER | herhangi bir kırmızı bayrak, ya da skor < 40 |
| RISKY | 40–59 |
| OK | 60–79 |
| CLEAN | 80+ |

**Satış senaryosu** sadece DANGER'da: bağlı operatördeki, transferle alan, fresh ve launch bloğunda alıp
satmamış cüzdanların toplam payı havuza satılırsa düşüş ≥ %40 ise gösterilir. Skoru değiştirmez.

## 7. Guard (token sayfası)

Üç kontrol; biri başarısızsa **HELD**, ilk başarısızın gerekçesi gösterilir. Okunmamış kontrol `null`'dır:
ne tutar ne geçer; hepsi geçip biri okunmamışsa **PASS so far** (GUARD · PARTIAL).

| Kontrol | HELD koşulu | BSC'de kaynak |
|---|---|---|
| Creator history | ≥ 10 lansman ve < %10 mezun | okunmuyor (four.meme olayları gerekir) |
| First-slot buyers | launch bloğunda alınan arz ≥ %30 | Bubblemaps `supply_stats.bundles` |
| Dev holdings | dev şu an arzın ≥ %15'ini tutuyor | GoPlus `creator_percent` |

## 8. Shield (Radar)

| Kontrol | HELD koşulu |
|---|---|
| Creator history | ≥ 10 lansman ve < %10 mezun; 0 lansman cevabı "unavailable", geçer değil |
| Dev at launch | create işleminde dev'in aldığı pay ≥ %15; arz bilinmiyorsa okunmadı |

Radar bu sürümde yok; kural hazır.

## 9. Tüm eşikler

| Anahtar | Değer |
|---|---|
| scan.topN / minHolders | 20 / 10 |
| scan.deepMinShare | %0.2 |
| scan.partialMinUnread | 3 |
| scan.lowLiquidityUsd | $1,000 |
| scan.establishedDays / Liq / Mcap | 30 / $500K / $10M |
| scan.capCeiling | 59 |
| scan.scenarioMinDrop | %40 |
| pack.minWallets / weight | 3 / 0.6 |
| guard.historyMinLaunched / historyMaxGradPct / historyMaxAliveRate | 10 / %10 / %20 |
| guard.slot0Max / devMax | %30 / %15 |
| shield.minLaunches / maxGradPct / devMax | 10 / %10 / %15 |
| contract.highSellTax | %20 |
| sources.bubblemapsLimit | 250 |
| sources.freshToleranceMs | 1 saat |
