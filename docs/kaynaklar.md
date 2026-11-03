# Kaynak eşlemesi

`src/adapter.js` üç kaynağın ham cevabını kural motorunun girdisine (`ScanInput`) çevirir. Bu sayfa her
alanın nereden geldiğini ve hangi varsayımla okunduğunu yazar. Fixture'lar: [`test/fixtures/`](../test/fixtures).

## Endpoint'ler

| Kaynak | Çağrı | Şema |
|---|---|---|
| Bubblemaps | `GET https://api.bubblemaps.io/v0/tokens/map/bsc/{token}?limit=250&return_nodes=true&return_relationships=true&return_clusters=true` · başlık `X-ApiKey` | [openapi.json](https://docs.bubblemaps.io/openapi.json) → `MapDataV0` |
| GoPlus | `GET https://api.gopluslabs.io/api/v1/token_security/56?contract_addresses={token}` · isteğe bağlı `Authorization: Bearer` | [response-details](https://docs.gopluslabs.io/reference/response-details) |
| DexScreener | `GET https://api.dexscreener.com/token-pairs/v1/bsc/{token}` | [api/reference](https://docs.dexscreener.com/api/reference) |

## ScanInput alanları

| Alan | Kaynak | Nasıl |
|---|---|---|
| `holders[]` | Bubblemaps `nodes.top_holders` | `address_details.is_contract / is_dex / is_cex` olanlar ve burn adresleri (`0x0…0`, `0x…dEaD`) çıkarılır; kalan ilk 20 |
| `holders[].share` | `holder_data.share` | float'a göre yeniden hesaplanır: `share / (1 − dışlananların payı)` |
| `holders[].kind` | `relationships` | `to_address` bu holder ve `from_address` sıradan bir cüzdansa (top holder ya da magic node; kontrat, DEX, borsa, burn veya time node değilse) `transfer`, yoksa `buy` |
| `holders[].virgin` | `address_details.first_activity_date` + DexScreener `pairCreatedAt` | ilk aktivite ≥ en eski pair − 1 saat ise fresh |
| `holders[].unread` | aynı | token yaşı biliniyor ama cüzdanın ilk aktivitesi `null` ise okunmadı |
| `holders[].dev` | GoPlus `creator_address` | adres eşleşirse |
| `holders[].sniper / bundle / sold` | — | bu kaynaklarda yok; `sniper` parçası `unmeasured` |
| `links[]` kind `cluster` | Bubblemaps `clusters[].holders` | cluster üyeleri ardışık çiftler halinde kanıtlı link; union-find hepsini birleştirir |
| `links[]` kind `direct` | `relationships` | iki top holder arasındaki transfer kanıtlı link |
| `floatTokens` | GoPlus `total_supply` (yoksa Bubblemaps amount/share) × float payı | |
| `reserveTokens` | Bubblemaps top listesinde havuz adresi | önce GoPlus `dex[].pair` ile eşleşen, yoksa en büyük `is_dex`, yoksa en büyük kontrat (bonding curve); hiçbiri yoksa `operator` parçası `unmeasured` |
| `liquidityUsd` | DexScreener en likit pair `liquidity.usd`, yoksa GoPlus `dex[].liquidity` en büyüğü | ikisi de yoksa `null`: cap uygulanmaz |
| `market` | DexScreener | `ageDays` en eski `pairCreatedAt`'ten, `mcap`, `fdv` en likit pair'den |
| `stage` | DexScreener `dexId` | pair yoksa `curve` |
| `slot0Share` | Bubblemaps `metrics.supply_stats.bundles` | Bubblemaps'in launch bloğunda koordineli alım payı |
| `devShare` | GoPlus `creator_percent` | |
| `creator` | — | okunmuyor, Guard'ın ilk kontrolü `null` |
| `contract` | GoPlus | aşağıdaki kart |
| `unmeasured` | hesaplanır | her zaman `sniper`; token yaşı yoksa `virgin`; havuz yoksa `operator` |

## Kontrat kartı (GoPlus → `contract`)

GoPlus alanları `"1"` / `"0"` string'dir; olmayan alan **bilinmiyor** demektir ve `null` olur. `null` hiçbir
kapıyı tetiklemez.

| Kart alanı | GoPlus alanı |
|---|---|
| `honeypot`, `cannotBuy`, `cannotSellAll` | `is_honeypot`, `cannot_buy`, `cannot_sell_all` |
| `buyTax`, `sellTax`, `transferTax` | `buy_tax`, `sell_tax`, `transfer_tax` (0–1) |
| `openSource`, `proxy`, `mintable`, `selfdestruct` | `is_open_source`, `is_proxy`, `is_mintable`, `selfdestruct` |
| `ownerAddress`, `hiddenOwner`, `takeBackOwnership`, `ownerChangeBalance` | `owner_address`, `hidden_owner`, `can_take_back_ownership`, `owner_change_balance` |
| `pausable`, `blacklist`, `tradingCooldown`, `airdropScam` | `transfer_pausable`, `is_blacklisted`, `trading_cooldown`, `is_airdrop_scam` |
| `creatorAddress`, `holderCount` | `creator_address`, `holder_count` |
| `lpLockedShare` | `lp_holders[]` içinde `is_locked` = 1 olanların `percent` toplamı |
| `lpBurnedShare` | `lp_holders[]` içinde burn adreslerinin `percent` toplamı |

## Varsayımlar

Spec'in söylemediği, canlı veride doğrulanması gereken noktalar. Her biri için `adapter.js` savunmacı davranır.

1. **Bubblemaps pay birimi.** `holder_data.share` ve `supply_stats.*` için spec birim vermiyor. Listede 1'den
   büyük bir değer görülürse yüzde kabul edilip 100'e bölünür.
2. **`clusters[].holders` içeriği.** Spec sadece "string dizisi" diyor. Önce adres olarak eşlenir; eşleşmezse
   ve sayıysa `top_holders` sırası olarak okunur.
3. **`relationships` kapsamı.** Sadece haritadaki düğümler (top holder, magic node, time node) arasındaki
   transferler gelir varsayılır. Tanınmayan bir `from_address` yok sayılır.
4. **`supply_stats.bundles` anlamı.** Bubblemaps'in launch bloğunda koordineli alınan arz payı. Guard'ın
   "first-slot buyers" kontrolü bu değere bağlanmıştır.
5. **Token yaşı = en eski DexScreener pair'i.** Bonding curve aşamasındaki four.meme token'ları DexScreener'da
   listelenmiyorsa yaş bilinmez, fresh ölçülemez. four.meme `create` olayı okunduğunda bu düzelir.
6. **GoPlus `percent` ve `creator_percent`** 0–1 aralığında string'dir (dokümandaki "1 = 100%").
