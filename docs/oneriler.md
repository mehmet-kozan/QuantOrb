# BSC Launchpad & Holder-Scanner Konuşma Özeti (3 Kasım 2026)

## 1. Launchpad'lerin güncel durumu

| Platform | Zincir | Durum | Kaynak rakamlar |
|---|---|---|---|
| **Pump.fun** | Solana | Açık ara lider | Kümülatif ~1,31 Mlr $ gelir; Ekim 2026'da ~47,7 M $ ücret; %79 token ilk günden sonra ölüyor |
| **Flap.sh** | BSC (+ X Layer, Robinhood, Monad) | BSC'nin tek anlamlı oyuncusu, çok oynak | Ağustos'ta günlük 1,18 M $ ile Pump.fun'ı geçti, 8 gün sonra 6,5 K $'a düştü; Eylül'de bStocks "meme trade et, hisse kazan" modeliyle yeniden zirve; **31 Ekim DNS hijack** — resmi "temiz" açıklaması gelmeden siteye girme |
| **Four.meme** | BSC | Ciddi düşüşte | Ekim 2025 zirvesinde günlük 1,4 M $; şimdi günlük ~7 K $ (Flap'in ~1/125'i); 4Stock ile geç cevap verdi |

**DefiLlama BSC launchpad tablosu** (`defillama.com/protocols/launchpad/bsc`): Flap 7 günlük 9,55 M $ ücret ile BSC ücretlerinin ~%97'si; Four.meme 94 K $; Genius.fun 152 K $; PinkSale/DxSale/DeepLock TVL'de yüksek ama ücret sıfır (eski tip presale/lock servisleri). **Sıralarken TVL'ye değil Fees 24h/7d'ye bak.**

**Popülerlik:** Pump.fun >> Flap > Four.meme. Scanner için BSC'de yeni token akışının neredeyse tamamı Flap kontratlarından; Four.meme ikincil.

## 2. DefiLlama kullanımı
- Kategori sayfası: `/protocols/launchpad`, `/protocols/launchpad/bsc`; sütun başlığına tıklayarak sırala, "Columns" ile gereksizleri gizle, .csv indir.
- Tek protokol: `/protocol/flap`, `/protocol/four.meme`, `/protocol/pump.fun`.
- API: `https://api.llama.fi/overview/fees` → `category == "Launchpad"` filtrele, `total24h`'e göre sırala.
- Fees ≠ Revenue: Fees kullanıcıların ödediği toplam, Revenue protokolün tuttuğu. Popülerlik için Fees.

## 3. Bubblemaps'in yaptığı iş (DIY tarifi)
1. Token'ın tüm `Transfer` event'lerini çek (`eth_getLogs`).
2. Güncel bakiyeleri türet / `balanceOf`.
3. Büyük holder'ların BNB **funding source**'unu bul (BscScan `txlist`).
4. Kümele: aynı funding source, aynı blokta alım, holder→holder transfer, gas/nonce deseni.
5. Skor: en büyük kümenin arz yüzdesi.

Bubblemaps'te olup sende olmayacak tek şey tarihsel etiket veritabanı → GoPlus/Arkham etiketleriyle kapat.

## 4. Veri kaynağı seçenekleri ve önerilerim

### Kendi node
- Resmi gereksinimler: Fast 16c/32GB/2TB, Full 16c/64GB/3TB, Archive 16c/128GB/10TB NVMe.
- Senin iş için **archive gereksiz**, fast node yetmez (eski receipt'leri tutmaz), full node yeterli.
- **Geriye dönük 1 yıl bile gerekmiyor**: node'u kurduğun günden sonra doğan her token'ın geçmişi eksiksiz olur. Geçmiş test için Dune, funding-source için BscScan.
- bsc-erigon kullanılmıyor → **reth-bsc** (`--full`, archive 10,6 TB; deneysel, snapshot ile kur). Reth `--full` receipt'leri de budar; pencereyi `[prune.segments] receipts = { distance = N }` ile sen tanımlarsın (BSC ≈ 42 M blok/yıl).
- Tahmini disk: 1 yıllık receipt penceresiyle 3–4 TB; 7–14 günlük pencereyle 1,5–2 TB.
- **Öneri:** Uzun pencereyi node'da değil ClickHouse'da tut; node sadece "indexer düşerse geri dön" tamponu (7–14 gün).

### Public RPC (ChainList)
- Prototip için evet, üretim için hayır: rate limit, `eth_getLogs` ~5 K blok sınırı, SLA yok.
- **Öneri:** 4–5 public endpoint round-robin + retry; ücretli anahtarı sadece fallback olarak.

### Ücretli RPC
| | Ücretsiz | İlk plan | Not |
|---|---|---|---|
| NodeReal | 10 M CU/ay | Growth 39 $/ay, 500 M CU | BSC için en ucuz, archive açık |
| QuickNode | 10 M kredi deneme | Build 49 $/ay, 80 M kredi | Streams (log push) güçlü ama pahalı |
| Alchemy | 30 M CU/ay | 0,52 $/1M CU | `eth_getLogs` 75 CU, pahalı |

**Öneri:** Prototip public RPC → canlı taramaya geçince **NodeReal Growth (39 $)**. Kendi node'u bu kurgunun hiçbir aşamasında kurman şart değil; 1,5 TB NVMe makineyi 7/24 tutmak ilk yıl abonelikten pahalıya gelebilir.

### Dune
SQL ile tüm BSC transferleri (`erc20_bnb.evt_Transfer`), dakikalar gecikmeli. Araştırma ve algoritma doğrulama için; canlı tarama için değil.

### Codex.io
- Verir: `onLaunchpadTokenEvent` (yeni token push), `holders`/`onHoldersUpdated`, `top10HoldersPercent`, `tokenWalletStats` (sniper/bundler/insider), `risk` verdict, cüzdan PnL/etiket.
- Vermez: **tarihsel düz transfer sorgusu** (kümeleme için şart), **Flap desteği** (sadece Four.meme), tarihsel bakiye.
- Plan: "Almost free" 10 K istek/ay, Growth 1 M'den başlar; abonelikte her mesaj bir istek.

## 5. Önerdiğim mimari

```
[Codex onLaunchpadTokenEvent]  (Four.meme)   ─┐
[Kendi RPC: Flap TokenCreate event]          ─┼→ token listesi
                                              │
[newHeads abonesi] → her blokta eth_getLogs(Transfer, token listesi)
        │   (reorg: latest-2 işle; reconnect'te boşluğu getLogs ile doldur)
        ▼
[ClickHouse]  PARTITION BY gün, ORDER BY (token, block, log_index), TTL 30 gün
        │     batch insert (1–5 sn), satır ≈ 50–70 B sıkıştırılmış
        │     1 aylık pencere ≈ 10–25 GB (günde 2–10 M transfer)
        ▼
[Kümeleme + risk skoru]  ← Codex tokenWalletStats/risk ile çapraz doğrulama
                         ← BscScan txlist ile funding source
                         ← GoPlus/Arkham etiketleri
```

**İş bölümü:** Codex = holder listesi, konsantrasyon metrikleri, fiyat/likidite, Four.meme akışı. Kendi indexer = Transfer grafı, funding-source, kümeleme (farklılaştırıcı kısım). Dune = geçmiş rug'larda backtest.

**`newHeads`:** WebSocket üzerinden her yeni blok başlığını push eden abonelik; blok başına ~1 KB. `logs` aboneliğini `Transfer` topic'iyle açık bırakmak yerine `newHeads` + hedefli `eth_getLogs` ikilisi daha kontrollü; kendi node'da bedava, ücretli RPC'de günde ~115 K çağrı.

## 6. Dikkat edilecekler
- Flap hack'i taze; resmi X açıklamasını bekle, approve'ları iptal et.
- reth-bsc deneysel; prune segmentlerini testnet'te doğrula.
- ClickHouse'da satır satır insert yapma ("too many parts").
- Budanmış pencere öncesi `eth_getLogs` boş döner, hata vermez → indexer "transfer yok" sanmasın, fallback koy.
- Launchpad geliri günlük bazda çok oynak; sıralama aylar içinde değişebilir.

İstersen bunu düzenleyip paylaşabileceğin bir doc olarak da hazırlayabilirim.