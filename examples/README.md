# examples/

Kural motoru için tarama girdileri; her biri alması gereken verdict'i (`expect`) taşır. `npm test` hepsini
kontrol eder. Girdi biçimi `src/rules/verdict.js` başında, kaynaklardan nasıl üretildiği
[`docs/kaynaklar.md`](../docs/kaynaklar.md) içinde.

| Dosya | Nereden | Verdict |
|---|---|---|
| `site-example.json` | Solana sürümünün ana sayfa örneği | DANGER · 12 |
| `bundle-and-pack.json` | Solana sunucusunun simüle zincirde yaptığı tarama | DANGER · 18 |
| `received-not-bought.json` | aynı | DANGER · 35 |
| `all-fresh-wallets.json` | aynı | DANGER · 65 (kırmızı bayrak) |
| `graduated-ok.json` | aynı | OK · 76 |
| `experienced-holders-clean.json` | aynı | CLEAN · 87 |
| `too-early.json` | aynı | EARLY · skor yok |
| `serial-creator-too-early.json` | aynı: seri lansmancının yeni token'ı | EARLY · Guard HELD |
| `too-established.json` | aynı | ESTABLISHED · skor yok |
| `clean.json` | tek kural için uydurma: temiz dağılım | CLEAN · 93 |
| `one-whale.json` | tek kural için uydurma: dürüst balina risktir, rug değil | RISKY · 58 |
| `partial.json` | tek kural için uydurma: üç cüzdan okunamadı | RISKY · 59 |

İlk dokuzu Solana sürümünün kapalı sunucusunun ürettiği sonuçlardır. Burada geçmeleri, BSC sürümüne
taşınan kuralların değişmediğini gösterir. Her token, cüzdan ve rakam uydurmadır.

Kendi girdini dene: bir dosyayı kopyala, değiştir, `node src/cli.js dosyan.json` çalıştır. Canlı bir
token'ın girdisini görmek için `node src/cli.js 0xAdres --json` çıktısındaki `input` alanına bak.
