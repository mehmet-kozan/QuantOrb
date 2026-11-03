# test/

`npm test`, Node'un kendi test koşucusuyla. Bağımlılık yok.

| Dosya | Ne kontrol eder |
|---|---|
| `score.test.js` | Her parça eşiklerinde, bantlar, her bayrak ve cap, okunamayan cüzdanlar, bilinmeyen likidite, ölçülemeyen parça, senaryo, skorsuz durumlar, kontrat kapıları |
| `operators.test.js` | Kanıtlı linkler birleştirir, pack 0.6 ile sayılır, en az 3 cüzdan, hiçbir cüzdan iki kez sayılmaz (regresyon) |
| `guard.test.js` · `shield.test.js` | Kontroller eşiklerinde; okunmamış kontrol asla geçer değil |
| `adapter.test.js` | `fixtures/` içindeki Bubblemaps, GoPlus ve DexScreener cevaplarından `ScanInput`'a eşleme; `scan()` kaynak hataları |
| `examples.test.js` | `examples/` içindeki her dosya beklenen verdict'i alır |

`fixtures/` uydurma bir token için üç kaynağın cevabıdır; şekilleri kaynakların yayımladığı şemalara göre
yazıldı, canlı veriyle henüz doğrulanmadı (bkz. `docs/kaynaklar.md` → Varsayımlar).
