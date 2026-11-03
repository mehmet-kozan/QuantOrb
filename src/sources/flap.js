/* flap.sh (BSC): Portal üzerinden salt okunur. Adres docs.flap.sh "Deployed Contract Addresses", imzalar
   "Inspect A Token" ve "Index Token Created Events" sayfalarından; 3 Kasım 2026'da canlı zincirde doğrulandı
   (docs/kaynaklar.md). Hiçbir adres ya da imza uydurulmadı. */
import { encodeCall, topic, uint, addr, num, str } from './abi.js';

export const PLATFORM = 'flap.sh';
export const PORTAL = '0xe2cE6ab80874Fa9Fa2aAE65D277Dd6B8e65C9De0';
export const SUPPLY = 1e9;   // her flap token'ı 1 milyar (maxSupply)
export const STATUS = ['Invalid', 'Tradable', 'InDuel', 'Killed', 'DEX', 'Staged'];
export const TOPIC = {
  create: topic('TokenCreated(uint256,address,uint256,address,string,string,string)'),
  dex: topic('LaunchedToDEX(address,address,uint256,uint256)')
};
const ZERO = '0x0000000000000000000000000000000000000000';

export const calls = { state: token => [PORTAL, encodeCall('getTokenV8Safe(address)', token)] };

/* getTokenV8Safe → durum; flap token'ı değilse çağrı revert eder ya da status 0 döner (null).
   Sıra: status, reserve, circulatingSupply, price, tokenVersion, r, h, k, dexSupplyThresh, quoteTokenAddress,
   nativeToQuoteSwapEnabled, extensionID, buyTaxRate, sellTaxRate, pool, progress, lpFeeProfile, dexId */
export function decodeState(hex) {
  if (!hex || hex.length < 66 + 64 * 17 || uint(hex, 0) === 0n) return null;
  const status = Number(uint(hex, 0)), pool = addr(hex, 14);
  return {
    platform: PLATFORM, status: STATUS[status] || String(status), graduated: status === 4,
    progress: Math.min(1, num(hex, 15)),                              // 1e18 = %100
    /* curve: fiyat = k / (h + 1e9 − S)²  →  sabit çarpım, sanal token rezervi Rv = h + 1e9 − S */
    virtualReserveTokens: num(hex, 6) + SUPPLY - num(hex, 2),
    buyTax: num(hex, 12, 4), sellTax: num(hex, 13, 4),                // baz puan → oran
    pool: pool === ZERO ? null : pool, supply: SUPPLY
  };
}

/* TokenCreated(ts, creator, nonce, token, name, symbol, meta); indexed alan yok */
export const decodeCreate = log => ({
  platform: PLATFORM, ts: Number(uint(log.data, 0)) * 1000, creator: addr(log.data, 1), token: addr(log.data, 3),
  name: str(log.data, 4), symbol: str(log.data, 5), supply: SUPPLY, block: parseInt(log.blockNumber), tx: log.transactionHash
});
