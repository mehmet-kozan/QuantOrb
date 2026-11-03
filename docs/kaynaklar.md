# Kaynak eşlemesi

`src/adapter.js` kaynakların ham cevabını kural motorunun girdisine (`ScanInput`) çevirir. Bu sayfa her alanın
nereden geldiğini ve hangi varsayımla okunduğunu yazar. Fixture'lar: [`test/fixtures/`](../test/fixtures).

## Endpoint'ler

| Kaynak | Çağrı | Şema |
|---|---|---|
| Bubblemaps | `GET https://api.bubblemaps.io/v0/tokens/map/bsc/{token}?limit=250&return_nodes=true&return_relationships=true&return_clusters=true` · başlık `X-ApiKey` | [openapi.json](https://docs.bubblemaps.io/openapi.json) → `MapDataV0` |
| GoPlus | `GET https://api.gopluslabs.io/api/v1/token_security/56?contract_addresses={token}` · isteğe bağlı `Authorization: Bearer` | [response-details](https://docs.gopluslabs.io/reference/response-details) |
| DexScreener | `GET https://api.dexscreener.com/token-pairs/v1/bsc/{token}` | [api/reference](https://docs.dexscreener.com/api/reference) |
| BSC JSON-RPC | `eth_call`, `eth_getLogs`, `eth_getBlockByNumber`, `eth_getCode` · varsayılan `https://bsc-rpc.publicnode.com`, `BSC_RPC_URL` ile değişir | anahtarsız; loglar yaklaşık son iki gün, eskisi arşiv ister |

## Launchpad'ler (zincirden, `src/sources/`)

İki launchpad da doğrudan kontratlarından okunur; REST API kullanılmaz (four.meme'nin `meme-api`'si
script'lere Cloudflare ile 403 döner, flap'in herkese açık API'si yok). Adresler ve imzalar resmi kaynaklardan
alındı, **3 Kasım 2026'da canlı zincirde doğrulandı**; fixture'daki hex cevaplar o doğrulamanın kaydıdır.

| Platform | Ne | Kaynak |
|---|---|---|
| four.meme | `TokenManager2` `0x5c952063c7fc8610FFDB798152D69F0B9550762b` · `TokenManagerHelper3` `0xF251F83e40a78868FcfA3FA4599Dad6494E46034` | [four-meme-ai › contract-addresses.md](https://github.com/four-meme-community/four-meme-ai/blob/main/skills/four-meme-integration/references/contract-addresses.md) |
| four.meme | `getTokenInfo(address) → (version, tokenManager, quote, lastPrice, tradingFeeRate, minTradingFee, launchTime, offers, maxOffers, funds, maxFunds, liquidityAdded)` · `tryBuy(address,uint256,uint256)` | aynı repo › `scripts/get-token-info.ts`, SDK ABI |
| four.meme | `TokenCreate(address creator, address token, uint256 requestId, string name, string symbol, uint256 totalSupply, uint256 launchTime, uint256 launchFee)` · indexed alan yok | aynı repo › `references/event-listening.md` |
| flap.sh | `Portal` `0xe2cE6ab80874Fa9Fa2aAE65D277Dd6B8e65C9De0` (v5.23.1) | [docs.flap.sh › Deployed Contract Addresses](https://docs.flap.sh/flap/developers/deployed-contract-addresses) |
| flap.sh | `getTokenV8Safe(address) → (status, reserve, circulatingSupply, price, tokenVersion, r, h, k, dexSupplyThresh, quoteTokenAddress, nativeToQuoteSwapEnabled, extensionID, buyTaxRate, sellTaxRate, pool, progress, lpFeeProfile, dexId)` · `status`: 0 Invalid, 1 Tradable, 2 InDuel, 3 Killed, 4 DEX, 5 Staged | [Inspect A Token](https://docs.flap.sh/flap/developers/wallet-and-terminal-and-bot-developers/inspect-a-token) |
| flap.sh | `TokenCreated(uint256 ts, address creator, uint256 nonce, address token, string name, string symbol, string meta)` · indexed alan yok | [Index Token Created Events](https://docs.flap.sh/flap/developers/wallet-and-terminal-and-bot-developers/index-token-created-events), `four-flap-meme-sdk` |
| ikisi | token'ın `Transfer(address,address,uint256)` logları (launch bloğu) | ERC-20 |

Seçiciler ve olay konuları depoda yazılı değildir; `src/sources/abi.js` imzadan keccak256 ile hesaplar ve test
canlı logların konusunun bu hesapla aynı olduğunu kontrol eder.

**Canlıda doğrulananlar (3 Kasım 2026):**

- four.meme `getTokenInfo` bir four.meme token'ında `version = 2`, başka token'da `version = 0` döner.
  Flap `getTokenV8Safe` flap olmayan token'da revert eder.
- four.meme curve'ü **sabit çarpımdır**: beş farklı `tryBuy` kotası `maliyet(q) = Y·q / (Rv − q)` ile 4 haneye
  uyuştu, lansman anında Rv ≈ 1.0746 milyar token. Adapter bir kota ve `lastPrice` ile Rv'yi çözer.
- flap curve'ü dokümandaki `fiyat = k / (h + 1e9 − S)²` ile zincirdeki `price`'ı birebir verir; sanal token
  rezervi `Rv = h + 1e9 − S`. Vergiler baz puandır (`900` = %9).
- Her iki create olayı da indexed alan taşımaz; filtre yalnızca `topics[0]` ile yapılır.
- four.meme `TokenCreate.launchTime` canlı örnekte 0; zaman blok başlığından alınır. DexScreener'ın
  `pairCreatedAt`'i (dexId `fourmeme`) aynı bloğun zamanıdır.
- GoPlus, launchpad token'ında `owner_address` olarak launchpad kontratını verir, `creator_address` ilk
  saatlerde boştur: launchpad token'ında GoPlus'ın creator alanları kullanılmaz.
- Flap'te `TokenCreated.creator` bir kontrat olabilir (`VaultPortal` `0x9049…4C06`, bundler'lar).
  `eth_getCode` ile ayrılır; kontratsa insan cüzdanı bilinmez.
- Public node `eth_getLogs`'u 2000 bloklu aralıklarda cevaplar; yaklaşık 2 günden eski aralık "archive" ister.

## ScanInput alanları

| Alan | Kaynak | Nasıl |
|---|---|---|
| `holders[]` | Bubblemaps `nodes.top_holders` | `address_details.is_contract / is_dex / is_cex` olanlar ve burn adresleri (`0x0…0`, `0x…dEaD`) çıkarılır; kalan ilk 20 |
| `holders[].share` | `holder_data.share` | float'a göre yeniden hesaplanır: `share / (1 − dışlananların payı)` |
| `holders[].kind` | `relationships` | `to_address` bu holder ve `from_address` sıradan bir cüzdansa (top holder ya da magic node; kontrat, DEX, borsa, burn veya time node değilse) `transfer`, yoksa `buy` |
| `holders[].virgin` | `address_details.first_activity_date` + yaratılış zamanı | ilk aktivite ≥ yaratılış − 1 saat ise fresh. Yaratılış: launchpad create olayı, yoksa en eski DexScreener pair'i |
| `holders[].unread` | aynı | yaratılış biliniyor ama cüzdanın ilk aktivitesi `null` ise okunmadı |
| `holders[].dev` | launchpad `creator` (cüzdansa); launchpad yoksa GoPlus `creator_address` | adres eşleşirse |
| `holders[].bundle` | launch bloğundaki token `Transfer` logları | o blokta token alan cüzdanlar (mint ve launchpad kontratları hariç) |
| `holders[].sniper / sold` | — | bu kaynaklarda yok; `sniper` parçası `unmeasured` |
| `links[]` kind `cluster` | Bubblemaps `clusters[].holders` | cluster üyeleri ardışık çiftler halinde kanıtlı link; union-find hepsini birleştirir |
| `links[]` kind `direct` | `relationships` | iki top holder arasındaki transfer kanıtlı link |
| `floatTokens` | GoPlus `total_supply`, yoksa launchpad arzı (flap 1e9, four.meme `TokenCreate.totalSupply`), yoksa Bubblemaps amount/share; × float payı | |
| `reserveTokens` | curve'de launchpad'in **sanal token rezervi**; mezunsa havuz adresinin Bubblemaps'teki bakiyesi | havuz: önce launchpad `pool`, sonra GoPlus `dex[].pair`, sonra en büyük `is_dex`, sonra en büyük kontrat. Hiçbiri yoksa `operator` parçası `unmeasured` |
| `liquidityUsd` | DexScreener en likit pair `liquidity.usd`, yoksa GoPlus `dex[].liquidity` en büyüğü | ikisi de yoksa `null`: cap uygulanmaz |
| `market` | DexScreener + yaratılış zamanı | `ageDays` yaratılıştan, `mcap`, `fdv` en likit pair'den |
| `stage` | launchpad / DexScreener | curve'deyse `curve`, mezunsa DexScreener `dexId` ya da `pool` |
| `slot0Share` | launch bloğu `Transfer` toplamı / arz | okunamadıysa Bubblemaps `supply_stats.bundles` |
| `devShare` | creator'ın Bubblemaps listesindeki payı | listede yoksa ve liste doluysa (≥ 250) 0; liste kısaysa `null`. Launchpad yoksa GoPlus `creator_percent` |
| `creator` | lansman kaydı (`data/launches.json`) | `{ launched, graduated, since, local: true }`; creator kontratsa `{ contract: true }`; kayıtta yoksa `null` |
| `devAtLaunch`, `supply` | launch bloğunda creator'a giden token; arz | Shield |
| `contract` | GoPlus; vergi yoksa flap Portal `buyTaxRate / sellTaxRate` | aşağıdaki kart |
| `launch` | launchpad | rapordaki kart: platform, curve/mezun, ilerleme, creator, yaratılış, launch bloğu payı, dev'in aldığı, vergiler |
| `unmeasured` | hesaplanır | her zaman `sniper`; yaratılış zamanı yoksa `virgin`; rezerv yoksa `operator` |

## Kontrat kartı (GoPlus → `contract`)

GoPlus alanları `"1"` / `"0"` string'dir; olmayan alan **bilinmiyor** demektir ve `null` olur. `null` hiçbir
kapıyı tetiklemez.

| Kart alanı | GoPlus alanı |
|---|---|
| `honeypot`, `cannotBuy`, `cannotSellAll` | `is_honeypot`, `cannot_buy`, `cannot_sell_all` |
| `buyTax`, `sellTax`, `transferTax` | `buy_tax`, `sell_tax`, `transfer_tax` (0–1); boşsa flap Portal vergisi |
| `openSource`, `proxy`, `mintable`, `selfdestruct` | `is_open_source`, `is_proxy`, `is_mintable`, `selfdestruct` |
| `ownerAddress`, `hiddenOwner`, `takeBackOwnership`, `ownerChangeBalance` | `owner_address`, `hidden_owner`, `can_take_back_ownership`, `owner_change_balance` |
| `pausable`, `blacklist`, `tradingCooldown`, `airdropScam` | `transfer_pausable`, `is_blacklisted`, `trading_cooldown`, `is_airdrop_scam` |
| `creatorAddress`, `holderCount` | `creator_address`, `holder_count` |
| `lpLockedShare` | `lp_holders[]` içinde `is_locked` = 1 olanların `percent` toplamı |
| `lpBurnedShare` | `lp_holders[]` içinde burn adreslerinin `percent` toplamı |

## Lansman kaydı (`data/launches.json`)

`node src/cli.js index [blok]` iki launchpad'in create olaylarını tarar ve `{ platform, token, creator, block,
ts, tx }` satırlarını yazar. Taramada creator ve yaratılış zamanı önce buradan okunur; creator geçmişi
yalnızca buradan gelir (son 20 lansmanın durumu zincirden okunarak kaçının mezun olduğu sayılır). Kayıt
kısmidir: seri lansmancıyı gösterebilir, kimseyi temize çıkaramaz; Guard bunu `local: true` ile bilir. Dosya
`.gitignore` içindedir. Radar yazıldığında kaydı canlı besleyecek olan da budur.

## Varsayımlar

Spec'in söylemediği, canlı veride doğrulanması gereken noktalar. Her biri için `adapter.js` savunmacı davranır.

1. **Bubblemaps pay birimi.** `holder_data.share` ve `supply_stats.*` için spec birim vermiyor. Listede 1'den
   büyük bir değer görülürse yüzde kabul edilip 100'e bölünür.
2. **`clusters[].holders` içeriği.** Spec sadece "string dizisi" diyor. Önce adres olarak eşlenir; eşleşmezse
   ve sayıysa `top_holders` sırası olarak okunur.
3. **`relationships` kapsamı.** Sadece haritadaki düğümler (top holder, magic node, time node) arasındaki
   transferler gelir varsayılır. Tanınmayan bir `from_address` yok sayılır.
4. **`supply_stats.bundles` anlamı.** Bubblemaps'in launch bloğunda koordineli alınan arz payı. Launch bloğu
   zincirden okunamadığında Guard'ın "first-slot buyers" kontrolü buna düşer.
5. **GoPlus `percent` ve `creator_percent`** 0–1 aralığında string'dir (dokümandaki "1 = 100%").
6. **four.meme curve'ü her token'da sabit çarpım.** Lansman anındaki bir token'da beş kotayla doğrulandı;
   curve'ün ortasında ve "Tax Token" şablonunda yeniden doğrulanmalı. Rv çözülemezse (`tryBuy` revert, fiyat 0)
   rezerv `null` olur ve `operator` parçası ölçülemez.
7. **Flap curve token'ının yaratılış zamanı.** DexScreener flap curve token'larını listelemiyor; kayıtta yoksa
   creator ve yaş okunmaz. Flap'in `TokenCreated.creator`'ı insan cüzdanı olmayabilir (VaultPortal, bundler).
8. **Public RPC penceresi.** Yaklaşık 2 günden eski bloklarda `eth_getLogs` arşiv ister; eski token'larda
   yaratılış zincirden bulunamaz, kayıt gerekir. Arşiv RPC `BSC_RPC_URL` ile verilebilir.
