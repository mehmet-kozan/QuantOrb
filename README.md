# QuantumOrb · BSC

**BNB Chain memecoin'leri için holder tarayıcısı.** 20 cüzdan 4 kişi olabilir. QuantumOrb bir token'ı
gerçekte kimin tuttuğunu gösterir.

Bir token adresi verirsin. QuantumOrb en büyük holder'ları, aralarındaki bağları, kontratın yapabileceklerini
ve token'ın hangi launchpad'den çıktığını okur, birbirine bağlı cüzdanları tek **operatör** olarak birleştirir
ve 0–100 arası bir skorla bir verdict üretir: **CLEAN**, **OK**, **RISKY** ya da **DANGER**.

| Kaynak | Ne verir | Anahtar |
|---|---|---|
| [Bubblemaps Data API](https://docs.bubblemaps.io/data/api/introduction.md) | Holder'lar, cluster'lar (bağlı cüzdanlar), cüzdanlar arası transferler, ilk aktivite tarihleri | `BUBBLEMAPS_API_KEY` (zorunlu) |
| [GoPlus Token Security](https://docs.gopluslabs.io/reference/response-details) | Honeypot, vergiler, owner yetkileri, LP kilidi | isteğe bağlı `GOPLUS_TOKEN` |
| [DexScreener](https://docs.dexscreener.com/api/reference) | Likidite, market cap, FDV, pair yaşı | yok |
| **four.meme** ve **flap.sh** kontratları (BSC RPC) | Curve'de mi mezun mu, ilerleme, creator, yaratılış zamanı, launch bloğu alıcıları, dev'in aldığı, flap vergileri, curve'ün kendi fiyat etkisi | yok; `BSC_RPC_URL` ile başka node |

Kurallar Solana sürümünden birebir taşındı; BSC için iki ekleme var: **honeypot** kırmızı bayrak, **yüksek
satış vergisi** cap. Tamamı [`docs/skor.md`](docs/skor.md) içinde.

## Çalıştır

Node 18 veya üstü, bağımlılık yok.

```bash
git clone https://github.com/QuantumOrb/QuantOrb && cd QuantOrb
npm test                                              # kurallar, eşleme, launchpad çözücüleri, örnekler

BUBBLEMAPS_API_KEY=... node src/cli.js 0xTokenAdresi  # canlı tarama
node src/cli.js 0xTokenAdresi --json                  # tam sonuç
node src/cli.js examples/site-example.json            # hazır bir girdi, ağ yok
node src/cli.js index 20000                           # lansman kaydı: son 20.000 bloğun lansmanları (anahtarsız)
```

```
score 45 / 100 · DANGER
  Biggest operator       22.5 / 35
  Fresh wallets          17.9 / 25
  Received, not bought    0.0 / 20
  Unsold snipers          n/a / 10
  Top-20 share            0.0 / 10
  not measured: sniper · the rest is scaled to 100
RED FLAG · 11.8% of float was received by transfer, not bought
CAP · proven operator of 3 wallets holds 37.3% of float

Launchpad · four.meme · on the curve · 20.0% filled
  creator 0x1e4a… · created 2026-11-03 10:14 UTC
  launch slot 12.0% of supply to 2 wallets · dev bought 6.0%

Guard · HELD · serial creator: 12 launches we saw, 0 graduated
  ✕ Creator history   12 launches in our record, 0 graduated
  ✓ First-slot buyers 12% of supply bought in the launch slot
  ✓ Dev holdings      dev holds 6.0% of supply now
```

Kod içinde de kullanılabilir:

```js
import { scan } from './src/scan.js';
const r = await scan('0x...');          // { score, band, gates, operators, launch, guard, shield, contract, sources, ... }

import { fetchLaunch } from './src/sources/launchpad.js';
await fetchLaunch('0x...');             // sadece launchpad katmanı: anahtarsız, { platform, graduated, creator, ... } ya da null

import { scanVerdict } from './src/rules/index.js';
scanVerdict(input);                     // saf kural motoru, ağ yok; girdi biçimi examples/ içinde
```

## Bir tarama ne söyler

| Soru | Okunan |
|---|---|
| **Gerçekte kim tutuyor?** | Float'a göre en büyük 20 cüzdan. Havuz, bonding curve, borsa ve burn adresleri dışarıda. Bubblemaps'in bağlı saydığı cüzdanlar ve birbirine transfer yapanlar tek operatör. |
| **Satarlarsa ne olur?** | En büyük operatör her şeyi satarsa fiyat ne kadar düşer; curve'de launchpad'in kendi eğrisiyle, mezun token'da havuzla. DANGER'da şüpheli kümenin toplu satış senaryosu. |
| **Kim çıkardı, nasıl başladı?** | four.meme ya da flap.sh; creator cüzdanı, yaratılış zamanı, launch bloğunda kim ne kadar aldı, dev ne kadar aldı. Creator'ın kayıttaki lansmanları ve kaçının mezun olduğu (Guard, Shield). |
| **Kontrat ne yapabilir?** | Honeypot, alım/satım vergisi (flap tax token'larında Portal'dan), owner yetkileri (mint, pause, blacklist), LP kilidi ve yakımı. |

Her tarama bir skor ve verdict ile biter. Bazı desenler ağırlıklı toplam için fazla nettir: skor ne olursa
olsun DANGER verirler. Ölçülemeyen bir parça varsa (sniper zamanlaması okunmuyor) rapor bunu söyler ve kalan
parçalar 100'e ölçeklenir. **Okunamayan veri hiçbir zaman kanıt değildir**: ne lehte, ne aleyhte. Lansman
kaydı da öyle: kısmi kayıt bir seri lansmancıyı tutabilir, kimseyi temize çıkaramaz.

## Depo

| Klasör | |
|---|---|
| [`src/rules/`](src/rules) | Saf kural motoru: skor, operatörler, Guard, Shield, kontrat kapıları |
| [`src/config/rules.js`](src/config/rules.js) | Her eşik, tek yerde |
| [`src/sources/`](src/sources) | Bubblemaps, GoPlus, DexScreener istemcileri; BSC RPC ve ABI; four.meme ve flap.sh okuyucuları |
| [`src/record.js`](src/record.js) | Lansman kaydı (`data/launches.json`): create olaylarından yerel kayıt |
| [`src/adapter.js`](src/adapter.js) | Kaynak cevapları → kural motorunun girdisi |
| [`src/scan.js`](src/scan.js) · [`src/cli.js`](src/cli.js) | Uçtan uca tarama ve komut satırı |
| [`examples/`](examples) | Beklenen verdict'iyle tarama girdileri |
| [`test/`](test) | `npm test`: kurallar sınırlarında, eşleme fixture'larla, launchpad çözücüleri canlı zincir cevaplarıyla, örnekler sonuçlarıyla |
| [`docs/`](docs) | [Mimari](docs/mimari.md) · [Skor kuralları](docs/skor.md) · [Kaynak eşlemesi](docs/kaynaklar.md) · [Kararlar](docs/kararlar.md) |

## Sınırlar

- Sadece herkese açık zincir verisi okunur. Private key istenmez, işlem imzalanmaz, alım/satım yoktur.
- Cüzdan görür, insan görmez. Zincirde bağı olmayan iki cüzdan bağımsız görünür. Bir kontrat üzerinden
  (flap VaultPortal, bundler) çıkan lansmanın creator cüzdanı bilinmez; rapor bunu söyler.
- Creator geçmişi yalnızca lansman kaydının gördüğü kadardır; kayıt `node src/cli.js index` ile dolar ve
  anahtarsız public RPC yaklaşık son iki günü verir. Sniper zamanlaması okunmaz.
- Flap curve token'ları DexScreener'da olmadığından kayıtta yoksa creator ve yaş okunmaz.
- CLEAN bir söz değildir. Hiçbir şey yatırım tavsiyesi değildir.

<sub>`assets/` klasöründeki görseller Solana sürümüne aittir ve henüz yenilenmedi. © 2026 QuantumOrb.</sub>
