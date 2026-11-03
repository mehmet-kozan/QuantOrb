# test/

`npm test`, Node'un kendi test koşucusuyla. Bağımlılık yok, ağ yok.

| Dosya | Ne kontrol eder |
|---|---|
| `score.test.js` | Her parça eşiklerinde, bantlar, her bayrak ve cap, okunamayan cüzdanlar, bilinmeyen likidite, ölçülemeyen parça, senaryo, skorsuz durumlar, kontrat kapıları |
| `operators.test.js` | Kanıtlı linkler birleştirir, pack 0.6 ile sayılır, en az 3 cüzdan, hiçbir cüzdan iki kez sayılmaz (regresyon) |
| `guard.test.js` · `shield.test.js` | Kontroller eşiklerinde; okunmamış kontrol asla geçer değil |
| `launchpad.test.js` | keccak256 bilinen vektörlerle; four.meme ve flap çözücüleri canlı hex cevaplarla; sanal rezerv zincirdeki fiyatı verir; platform tespiti; launch bloğu; yaratılış kayıttan ve zincirden; kontrat creator; creator geçmişi kısmi |
| `adapter.test.js` | `fixtures/` içindeki Bubblemaps, GoPlus ve DexScreener cevaplarından `ScanInput`'a eşleme; launchpad'li ve launchpad'siz girdi; `scan()` kaynak hataları |
| `examples.test.js` | `examples/` içindeki her dosya beklenen verdict'i alır |

`fixtures/bubblemaps-map.json`, `goplus.json`, `dexscreener.json` uydurma bir token için üç kaynağın cevabıdır;
şekilleri kaynakların yayımladığı şemalara göre yazıldı, canlı veriyle henüz doğrulanmadı.
`fixtures/launchpad.json` ise **gerçektir**: 3 Kasım 2026'da BSC'den alınmış ham `eth_call` cevapları, create
olayları ve yaratılış bloğu Transfer logları (bkz. `docs/kaynaklar.md`).
