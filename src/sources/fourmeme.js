/* four.meme (BSC): salt okunur. Adresler ve imzalar resmi four-meme-ai skill'inden
   (references/contract-addresses.md, event-listening.md, scripts/get-token-info.ts) alındı ve 3 Kasım 2026'da
   canlı zincirde doğrulandı; bkz. docs/kaynaklar.md. Hiçbir adres ya da imza uydurulmadı. */
import cfg from '../config/rules.js';
import { encodeCall, topic, uint, addr, num, str } from './abi.js';

export const PLATFORM = 'four.meme';
export const TOKEN_MANAGER2 = '0x5c952063c7fc8610FFDB798152D69F0B9550762b';   // create ve trade olayları
export const HELPER3 = '0xF251F83e40a78868FcfA3FA4599Dad6494E46034';          // getTokenInfo, tryBuy, trySell
export const TOPIC = {
  create: topic('TokenCreate(address,address,uint256,string,string,uint256,uint256,uint256)'),
  purchase: topic('TokenPurchase(address,address,uint256,uint256,uint256,uint256,uint256,uint256)')
};

/* eth_call çağrıları: [to, data] */
export const calls = {
  state: token => [HELPER3, encodeCall('getTokenInfo(address)', token)],
  tryBuy: (token, q = cfg.launchpad.probeTokens) => [HELPER3, encodeCall('tryBuy(address,uint256,uint256)', token, BigInt(q) * 10n ** 18n, 0n)]
};

/* getTokenInfo → durum; version 0 ise token four.meme'nin değil (null).
   Sıra: version, tokenManager, quote, lastPrice, tradingFeeRate, minTradingFee, launchTime, offers, maxOffers,
   funds, maxFunds, liquidityAdded */
export function decodeState(hex) {
  if (!hex || hex.length < 66 + 64 * 11 || uint(hex, 0) === 0n) return null;
  const maxFunds = num(hex, 10);
  return {
    platform: PLATFORM, graduated: uint(hex, 11) === 1n,
    lastPrice: Number(uint(hex, 3)) / 1e18,                                  // BNB / token
    progress: maxFunds > 0 ? Math.min(1, num(hex, 9) / maxFunds) : null,     // toplanan BNB / hedef
    launchTime: Number(uint(hex, 6)) * 1000 || null,                         // çoğu lansmanda 0: zaman create bloğundan
    feeRate: Number(uint(hex, 4)) / 1e4, pool: null, buyTax: null, sellTax: null, supply: null
  };
}

/* Curve sabit çarpımdır (canlıda tryBuy kotalarıyla doğrulandı): maliyet(q) = Y·q / (Rv − q), son fiyat p = Y / Rv.
   Bir kota ve son fiyattan sanal token rezervi çözülür: Rv = q·c / (c − p·q). Skor motoru impact(q, Rv) ile
   curve'ün kendi fiyat düşüşünü hesaplar. tryBuy çıktısı: tokenManager, quote, estimatedAmount, estimatedCost, … */
export function virtualReserve(state, tryBuyHex, q = cfg.launchpad.probeTokens) {
  if (!tryBuyHex || !(state?.lastPrice > 0)) return null;
  const cost = num(tryBuyHex, 3), extra = cost - state.lastPrice * q;
  return extra > 0 ? q * cost / extra : null;
}

/* TokenCreate(creator, token, requestId, name, symbol, totalSupply, launchTime, launchFee); indexed alan yok */
export const decodeCreate = log => ({
  platform: PLATFORM, creator: addr(log.data, 0), token: addr(log.data, 1), name: str(log.data, 3), symbol: str(log.data, 4),
  supply: num(log.data, 5), ts: Number(uint(log.data, 6)) * 1000 || null, block: parseInt(log.blockNumber), tx: log.transactionHash
});
