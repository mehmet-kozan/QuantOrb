/* DexScreener: piyasa verisi (likidite, market cap, FDV, pair yaşı). Anahtarsız, ücretsiz.
   Referans: https://docs.dexscreener.com/api/reference → GET /token-pairs/v1/{chainId}/{tokenAddress} */
import { getJson } from './http.js';

const BASE = 'https://api.dexscreener.com';

/* bu token'ın BSC'deki pair'leri; cevap dizi ya da { pairs: [] } olabilir, ikisi de dizi olarak döner */
export async function fetchPairs(address, chain = 'bsc') {
  const body = await getJson(`${BASE}/token-pairs/v1/${chain}/${address}`);
  const pairs = Array.isArray(body) ? body : body?.pairs || [];
  return pairs.filter(p => (p.baseToken?.address || '').toLowerCase() === address.toLowerCase());
}
