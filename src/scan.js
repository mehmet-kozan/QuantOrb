/* Bir adres için uçtan uca tarama: üç HTTP kaynağını paralel oku, launchpad'i zincirden sor, girdiye çevir,
   verdict üret. Bubblemaps olmadan holder yok, tarama yapılamaz; diğerleri düşerse rapor eksik alanları söyler. */
import { fetchMap } from './sources/bubblemaps.js';
import { fetchTokenSecurity } from './sources/goplus.js';
import { fetchPairs } from './sources/dexscreener.js';
import { fetchLaunch, creatorHistory } from './sources/launchpad.js';
import { makeRpc } from './sources/rpc.js';
import { openRecord } from './record.js';
import { toScanInput } from './adapter.js';
import { scanVerdict } from './rules/index.js';

const settle = p => p.then(value => ({ value, error: null }), e => ({ value: null, error: e.message }));

export async function scan(address, { apiKey = process.env.BUBBLEMAPS_API_KEY, rpc = makeRpc(), record = openRecord(), fetchers = {} } = {}) {
  const { map = fetchMap, security = fetchTokenSecurity, pairs = fetchPairs, launch = fetchLaunch, history = creatorHistory } = fetchers;
  const [m, s, p] = await Promise.all([settle(map(address, apiKey)), settle(security(address)), settle(pairs(address))]);
  const l = await settle(launch(address, { rpc, record, pairs: p.value || [] }));
  const human = l.value?.creator && l.value.creatorIsContract === false;   // kontrat üzerinden lansmanın creator'ı bilinmez
  const h = human ? await settle(history(l.value.creator, { rpc, record })) : { value: null, error: null };
  const sources = {
    bubblemaps: m.error || 'ok', goplus: s.error || 'ok', dexscreener: p.error || 'ok',
    launchpad: l.error || (l.value ? l.value.platform : 'not a four.meme or flap.sh token'),
    record: h.error || (h.value ? `${h.value.launched} launches by this creator` : l.value?.creatorIsContract ? 'creator is a contract, history not read' : record.size ? `${record.size} launches, creator not in it` : 'empty')
  };
  if (!m.value) return { address, state: 'unavailable', band: 'UNAVAILABLE', headline: `holders could not be read: ${m.error}`, sources };
  const input = toScanInput({ address, map: m.value, security: s.value, pairs: p.value, launch: l.value, history: h.value });
  return { address, ...scanVerdict(input), input, sources };
}
