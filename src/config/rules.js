/* Tüm eşikler tek yerde. Her anahtarın açıklaması docs/skor.md içinde. */
export default {
  scan: {
    topN: 20,                  // skor en büyük 20 cüzdan üzerinden hesaplanır
    minHolders: 10,            // daha az holder: TOO EARLY, skor yok
    deepMinShare: 0.002,       // float'ın %0.2'sinden küçük cüzdanlar derin okunmaz; okunamamaları PARTIAL saymaz
    partialMinUnread: 3,       // bu kadar cüzdan okunamadıysa tarama PARTIAL, verdict en iyi RISKY
    lowLiquidityUsd: 1000,     // likidite bunun altındaysa verdict RISKY'ye sabitlenir
    establishedDays: 30,       // TOO ESTABLISHED: bundan yaşlı …
    establishedLiq: 500000,    // … likiditesi bundan fazla …
    establishedMcap: 10000000, // … ve market cap'i (yoksa FDV) bundan büyük
    capCeiling: 59,            // cap uygulanınca skorun tavanı
    scenarioMinDrop: 0.4       // satış senaryosu bu düşüşün altındaysa gösterilmez
  },
  pack: {
    minWallets: 3,             // kanıtlı gruptakiler çıkarıldıktan sonra en az bu kadar cüzdan kalırsa pack
    weight: 0.6                // pack payı sıralamada ve fiyat etkisinde bu ağırlıkla sayılır
  },
  guard: {
    historyMinLaunched: 10,    // creator en az bu kadar token çıkarmışsa …
    historyMaxGradPct: 10,     // … ve yüzde olarak bundan azı mezun olduysa seri lansmancı (zincir kaydı)
    historyMaxAliveRate: 0.2,  // … ya da bundan azı hayattaysa (eski kaynak)
    slot0Max: 0.30,            // launch bloğunda arzın bu kadarı alındıysa HELD
    devMax: 0.15               // dev şu an arzın bu kadarını tutuyorsa HELD
  },
  shield: {
    minLaunches: 10,
    maxGradPct: 10,
    devMax: 0.15               // dev create işleminde arzın bu kadarını aldıysa HELD
  },
  contract: {
    highSellTax: 0.20          // BSC: satış vergisi bu ve üstüyse verdict RISKY'ye sabitlenir
  },
  launchpad: {
    probeTokens: 1e8,          // four.meme curve'ünde sanal rezervi çözmek için sorulan alım kotası (token)
    createWindow: 2,           // DexScreener zamanından bulunan bloğun ± bu kadar komşusunda TokenCreate aranır
    historyMaxReads: 20,       // creator geçmişi için en çok bu kadar lansmanın durumu okunur
    logChunk: 2000,            // kayıt doldururken bir eth_getLogs çağrısının blok aralığı (public node sınırı)
    recordFile: 'data/launches.json'
  },
  sources: {
    bubblemapsLimit: 250,      // map endpoint'inden istenen holder sayısı (80, 250 veya 500)
    freshToleranceMs: 3600e3,  // cüzdanın ilk aktivitesi token yaratılışından en fazla bu kadar önceyse fresh
    rpcUrl: 'https://bsc-rpc.publicnode.com',   // anahtarsız; BSC_RPC_URL ile değiştirilir
    timeoutMs: 15000
  }
};
