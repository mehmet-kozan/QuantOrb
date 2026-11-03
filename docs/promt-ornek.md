BNB Chain (BSC) üzerindeki memecoin'lerin (özellikle four.meme lansmanlarının) gerçekten kimin elinde olduğunu göstermeye çalışan bir tarayıcı gelistirmeye calisiyorum. 
Bir token adresi yapıştırıyorsun, en büyük 20 cüzdanı zincirden okuyor ve birbirine bağlı cüzdanları tek "operatör" olarak birleştiriyor. 
Böylece "20 cüzdan var" görünen bir tokenın aslında 4 kişinin kontrolünde olduğunu ortaya çıkarıyor.

Bu bilgiden 0-100 arası bir skor üretiyor (CLEAN, OK, RISKY, DANGER) ve en büyük operatör satarsa fiyatın ne kadar düşeceğini hesaplıyor. 
Yanında owner yetkileri (mint, freeze), likiditeyi kimin çekebileceği ve tokenı yaratan cüzdanın geçmişi (seri lansmancı mı) gibi kontroller var.

Ürünün üç parçası var: scan yapılan bir site, her yeni four.meme lansmanını anlık izleyen bir Radar ve bunları alarm olarak gönderen bir callback. 
Amaç, trader'ın bir memecoin'e girmeden önce rug pull veya koordineli dump riskini görmesi.

risk kural seti aşağıdaki gibi olabiri fikir vermesi acisindan

## 1. Tarama sırası

Bir tarama şu sırayla ilerler, ilk eşleşen durum sonucu belirler:

1. **TOO ESTABLISHED** → skor yok. Üç koşul birden: yaş > 30 gün, likidite > $500K, market cap (bilinmiyorsa FDV) > $10M.
2. **TOO EARLY** → skor yok. Curve, havuz, locker ve burn adresleri dışında 10'dan az cüzdan.
3. **Operatörler** kurulur (bölüm 3).
4. **Skor** hesaplanır (bölüm 2, 4, 5, 6).

Guard her durumda ayrıca çalışır, skoru etkilemez.

## 2. Skor: beş parça, toplam 100

Her parça top 20 holder üzerinden ölçülür. İlk eşikte tam puan, ikinci eşikte sıfır, arada doğrusal.

| Parça | Puan | Tam puan | Sıfır | Ölçülen |
|---|---:|---|---|---|
| Biggest operator | 35 | drop ≤ %10 | drop ≥ %60 | En büyük operatör her şeyi satarsa fiyat düşüşü |
| Fresh wallets | 25 | ≤ %10 | ≥ %80 | Okunan top cüzdanlar içinde bu tokendan önce hiç işlem yapmamış olanların **sayı oranı** (pay değil) |
| Received, not bought | 20 | ≤ %1 | ≥ %10 | Float'ın swap yerine transferle gelen payı |
| Unsold snipers | 10 | ≤ %1 | ≥ %15 | İlk 30 saniyede alıp hâlâ satmamış cüzdanların float payı |
| Top-20 share | 10 | ≤ %25 | ≥ %70 | Top 20'nin toplam float payı |

```
parça = puan × (sıfır_eşiği − x) / (sıfır_eşiği − tam_eşiği)   // 0..1 arasına kırpılır
```

Ayrıntılar:
- Parçalar 0.1'e, toplam tam sayıya yuvarlanır.
- Dev cüzdanı fresh ve sniper hesabından çıkarılır.
- Okunamayan (unread) cüzdanlar fresh oranının paydasına girmez.
- Fresh oranı hesabında pay değil cüzdan sayısı kullanılır. Transfer, sniper ve top-20 ise pay üzerinden.

**Fiyat etkisi formülü** (sabit çarpım havuzu, R havuzdaki token, q satılan):

```
drop = 1 − (R / (R + q))²
```
Havuz kadar token satmak %75 düşüş demek. En büyük operatörün q değeri ağırlıklı payı × float.

## 3. Operatörler

- **Kanıtlı link** (aynı alım işlemi, aynı sıradan cüzdandan token, holder'lar arası direkt transfer) cüzdanları tek operatörde birleştirir. Linkler zincirlenir: A-B ve B-C ise üçü bir operatör (union-find).
- **Pack**: birlikte giren taze cüzdanlar. Davranış, kanıt değil. Payı sıralamada ve fiyat etkisinde **%60** ile sayılır.
- Kanıtlı operatörde olan cüzdan pack'e girmez.
- Diğer herkes tek başına operatördür.
- Operatörler ağırlıklı paya göre sıralanır; en üstteki "biggest operator".

Doküman ile kod farkı: doküman pack için "3 veya daha fazla" diyor, kod kanıtlı grup düşüldükten sonra **2 cüzdan kalsa da** pack üretiyor. Pack linkleri tek bir çapa cüzdana bağlı değilse bir cüzdan iki pack'e girebiliyor (önceki mesajda doğruladığım çift sayma).

## 4. Kırmızı bayraklar: skor ne olursa olsun DANGER

| Kural | Koşul |
|---|---|
| Bağlı operatör satışı | drop ≥ %50 ve operatördeki cüzdan sayısı > 1 |
| Taze cüzdan yoğunluğu | okunan top cüzdanların ≥ %80'i fresh (en az bir okunan cüzdan varsa) |
| Transferle gelen float | ≥ %10 |

## 5. Caplar: en iyi ihtimalle RISKY (skor 59'a çekilir)

| Kural | Koşul |
|---|---|
| Kanıtlı operatör | 3+ cüzdanlı kanıtlı operatör float'ta pay tutuyor |
| Pack | herhangi bir pack var |
| Tek balina | tek cüzdanlı en büyük holder drop ≥ %50 ("dürüst balina risk, rug değil") |
| Düşük likidite | likidite biliniyor ve < $1,000 |
| PARTIAL | 3+ cüzdan zamanında okunamadı |

Notlar:
- Bilinmeyen likidite (null) asla cap uygulamaz.
- Float'ın %0.2'sinden küçük cüzdanlar derin okunmaz; bunlar okunamasa da PARTIAL'a sayılmaz.
- 1 veya 2 okunamayan cüzdan yalnızca not düşer, cap uygulamaz.
- Okunamayan cüzdan hiçbir kuralda kanıt sayılmaz.

## 6. Bant ve senaryo

| Bant | Koşul |
|---|---|
| DANGER | herhangi bir kırmızı bayrak, ya da skor < 40 |
| RISKY | 40–59 |
| OK | 60–79 |
| CLEAN | 80+ |

Kırmızı bayrak olmadan skor 80+ ama cap varsa skor 59'a düşer, bant RISKY olur.

**Satış senaryosu**: yalnızca DANGER'da hesaplanır. Şüpheli küme = bağlı operatördeki + transferle alan + fresh + launch slotunda alıp satmamış cüzdanlar. Bunların toplam payı havuza satılırsa düşüş ≥ %40 ise gösterilir. Skoru değiştirmez, "tahmin değil senaryo" diye etiketlenir.

**Başlık**: "N wallets → M operators, biggest holds X% of float" ve drop ≥ %1 ise ", could move price −Y% if sold".

## 7. Guard (token sayfası ve tarama)

Üç kontrol, herhangi biri başarısızsa HELD, ilk başarısızın gerekçesi gösterilir. Okunmamış kontrol ok=null: ne tutar ne geçer, PASS yerine "PASS so far" veya "GUARD · PARTIAL".

| Kontrol | HELD koşulu |
|---|---|
| Creator history (zincirden) | ≥ 10 lansman ve mezun olanlar < %10 |
| Creator history (sunucunun kendi kaydı) | ≥ 10 lansman ve hayatta olanlar < %20. Yalnızca aleyhe kanıt olarak kullanılır; seri değilse "not read" |
| Creator history (eski kaynak, alive) | ≥ 10 lansman ve alive oranı < %20 |
| First-slot buyers | launch slotunda alınan supply ≥ %30 |
| Dev holdings | dev şu an supply'ın ≥ %15'ini tutuyor |

## 8. Shield (Radar, grid, bot alarmları)

| Kontrol | HELD koşulu |
|---|---|
| Creator history | ≥ 10 lansman ve mezun < %10 (Guard ile aynı kural). Curve'ün %10'una veya 20 alıcıya ulaşınca okunur. 0 lansman cevabı "unavailable", geçer sayılmaz |
| Dev at launch | create işleminde dev'in aldığı pay ≥ %15 (supply varsayılan 1 milyar) |

## Tüm eşikler tek tabloda

| Anahtar | Değer |
|---|---|
| minHolders | 10 |
| deepMinShare | %0.2 |
| lowLiquidityUsd | $1,000 |
| establishedDays / Liq / Mcap | 30 gün / $500K / $10M |
| sniper penceresi | 30 saniye (kapalı tarafta işaretlenir) |
| pack ağırlığı | 0.6 |
| guard.historyMinLaunched | 10 |
| guard.historyMaxAliveRate | 0.2 |
| guard.slot0Max | 0.30 |
| guard.devMax | 0.15 |
| shield.minLaunches / maxGradPct / devMax | 10 / %10 / 0.15 |
| curve.totalSupply | 1e9 |

