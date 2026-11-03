/* Bir adres için uçtan uca tarama: üç kaynağı paralel oku, girdiye çevir, verdict üret.
   Bubblemaps olmadan holder yok, tarama yapılamaz; diğer ikisi düşerse rapor eksik alanları söyler. */
import { fetchMap } from './sources/bubblemaps.js';
import { fetchTokenSecurity } from './sources/goplus.js';
import { fetchPairs } from './sources/dexscreener.js';
import { toScanInput } from './adapter.js';
import { scanVerdict } from './rules/index.js';

const settle = p => p.then(value => ({ value, error: null }), e => ({ value: null, error: e.message }));

export async function scan(address, { apiKey = process.env.BUBBLEMAPS_API_KEY, fetchers = {} } = {}) {
  const { map = fetchMap, security = fetchTokenSecurity, pairs = fetchPairs } = fetchers;
  const [m, s, p] = await Promise.all([settle(map(address, apiKey)), settle(security(address)), settle(pairs(address))]);
  const sources = { bubblemaps: m.error || 'ok', goplus: s.error || 'ok', dexscreener: p.error || 'ok' };
  if (!m.value) return { address, state: 'unavailable', band: 'UNAVAILABLE', headline: `holders could not be read: ${m.error}`, sources };
  const input = toScanInput({ address, map: m.value, security: s.value, pairs: p.value });
  return { address, ...scanVerdict(input), input, sources };
}
