# QuantumOrb · BSC

**BNB Chain memecoin'leri için holder tarayıcısı.** 20 cüzdan 4 kişi olabilir. QuantumOrb bir token'ı
gerçekte kimin tuttuğunu gösterir.

Bir token adresi verirsin. QuantumOrb en büyük holder'ları, aralarındaki bağları ve kontratın
yapabileceklerini üç hazır kaynaktan okur, birbirine bağlı cüzdanları tek **operatör** olarak birleştirir ve
0–100 arası bir skorla bir verdict üretir: **CLEAN**, **OK**, **RISKY** ya da **DANGER**.

| Kaynak | Ne verir | Anahtar |
|---|---|---|
| [Bubblemaps Data API](https://docs.bubblemaps.io/data/api/introduction.md) | Holder'lar, cluster'lar (bağlı cüzdanlar), cüzdanlar arası transferler, ilk aktivite tarihleri | `BUBBLEMAPS_API_KEY` (zorunlu) |
| [GoPlus Token Security](https://docs.gopluslabs.io/reference/response-details) | Honeypot, vergiler, owner yetkileri, LP kilidi, creator payı | isteğe bağlı `GOPLUS_TOKEN` |
| [DexScreener](https://docs.dexscreener.com/api/reference) | Likidite, market cap, FDV, pair yaşı | yok |

Kurallar Solana sürümünden birebir taşındı; BSC için iki ekleme var: **honeypot** kırmızı bayrak, **yüksek
satış vergisi** cap. Tamamı [`docs/skor.md`](docs/skor.md) içinde.

## Çalıştır

Node 18 veya üstü, bağımlılık yok.

```bash
git clone https://github.com/QuantumOrb/QuantOrb && cd QuantOrb
npm test                                              # kurallar, eşleme ve örnekler

BUBBLEMAPS_API_KEY=... node src/cli.js 0xTokenAdresi  # canlı tarama
node src/cli.js 0xTokenAdresi --json                  # tam sonuç
node src/cli.js examples/site-example.json            # hazır bir girdi, ağ yok
```

```
score 12 / 100 · DANGER
  Biggest operator        0.0 / 35
  Fresh wallets           9.8 / 25
  Received, not bought    0.0 / 20
  Unsold snipers          0.8 / 10
  Top-20 share            1.7 / 10
RED FLAG · biggest operator could move price −67% if sold (41.1% of float, 6 linked wallets)
RED FLAG · 14.0% of float was received by transfer, not bought
CAP · proven operator of 6 wallets holds 41.1% of float
CAP · pack of 3 wallets holds 9.9% of float
```

Kod içinde de kullanılabilir:

```js
import { scan } from './src/scan.js';
const r = await scan('0x...');          // { score, band, gates, operators, guard, contract, sources, ... }

import { scanVerdict } from './src/rules/index.js';
scanVerdict(input);                     // saf kural motoru, ağ yok; girdi biçimi examples/ içinde
```

## Bir tarama ne söyler

| Soru | Okunan |
|---|---|
| **Gerçekte kim tutuyor?** | Float'a göre en büyük 20 cüzdan. Havuz, bonding curve, borsa ve burn adresleri dışarıda. Bubblemaps'in bağlı saydığı cüzdanlar ve birbirine transfer yapanlar tek operatör. |
| **Satarlarsa ne olur?** | En büyük operatör her şeyi havuza satarsa fiyat ne kadar düşer; DANGER'da şüpheli kümenin toplu satış senaryosu. |
| **Kontrat ne yapabilir?** | Honeypot, alım/satım vergisi, owner yetkileri (mint, pause, blacklist), LP kilidi ve yakımı, creator'ın payı. |

Her tarama bir skor ve verdict ile biter. Bazı desenler ağırlıklı toplam için fazla nettir: skor ne olursa
olsun DANGER verirler. Ölçülemeyen bir parça varsa (bu kaynaklarda sniper zamanlaması yok) rapor bunu söyler
ve kalan parçalar 100'e ölçeklenir. **Okunamayan veri hiçbir zaman kanıt değildir**: ne lehte, ne aleyhte.

## Depo

| Klasör | |
|---|---|
| [`src/rules/`](src/rules) | Saf kural motoru: skor, operatörler, Guard, Shield, kontrat kapıları |
| [`src/config/rules.js`](src/config/rules.js) | Her eşik, tek yerde |
| [`src/sources/`](src/sources) | Bubblemaps, GoPlus, DexScreener istemcileri |
| [`src/adapter.js`](src/adapter.js) | Kaynak cevapları → kural motorunun girdisi |
| [`src/scan.js`](src/scan.js) · [`src/cli.js`](src/cli.js) | Uçtan uca tarama ve komut satırı |
| [`examples/`](examples) | Beklenen verdict'iyle tarama girdileri |
| [`test/`](test) | `npm test`: kurallar sınırlarında, eşleme fixture'larla, örnekler sonuçlarıyla |
| [`docs/`](docs) | [Mimari](docs/mimari.md) · [Skor kuralları](docs/skor.md) · [Kaynak eşlemesi](docs/kaynaklar.md) · [Kararlar](docs/kararlar.md) |

## Sınırlar

- Sadece herkese açık zincir verisi okunur. Private key istenmez, işlem imzalanmaz, alım/satım yoktur.
- Cüzdan görür, insan görmez. Zincirde bağı olmayan iki cüzdan bağımsız görünür.
- Creator geçmişi ve sniper zamanlaması bu üç kaynakta yoktur; Guard'ın ilk kontrolü "okunmadı" kalır.
  four.meme olaylarının okunması [`docs/kararlar.md`](docs/kararlar.md) içinde sıradaki iş olarak duruyor.
- Bonding curve aşamasındaki token'larda fiyat etkisi sabit çarpım formülüyle yaklaşıktır.
- CLEAN bir söz değildir. Hiçbir şey yatırım tavsiyesi değildir.

<sub>`assets/` klasöründeki görseller Solana sürümüne aittir ve henüz yenilenmedi. © 2026 QuantumOrb.</sub>
