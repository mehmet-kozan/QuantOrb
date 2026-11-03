/* BSC JSON-RPC: eth_call ve log okuma, bağımlılıksız. Varsayılan uç anahtarsız bir public node'dur;
   BSC_RPC_URL ile değiştirilir. Public node'lar yaklaşık son iki günün loglarını verir, eskisi arşiv ister. */
import cfg from '../config/rules.js';

const hex = n => '0x' + Number(n).toString(16);

export function makeRpc(url = process.env.BSC_RPC_URL || cfg.sources.rpcUrl) {
  let id = 0;
  const send = async (method, params) => {
    const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params }), signal: AbortSignal.timeout(cfg.sources.timeoutMs) });
    const body = await res.json();
    if (body.error) throw new Error(`${method}: ${body.error.message}`);
    return body.result;
  };
  const rpc = {
    url,
    call: (to, data) => send('eth_call', [{ to, data }, 'latest']),
    logs: (address, topics, from, to) => send('eth_getLogs', [{ address, topics, fromBlock: hex(from), toBlock: hex(to) }]),
    block: n => send('eth_getBlockByNumber', [hex(n), false]),
    code: a => send('eth_getCode', [a, 'latest']),   // '0x' ise sıradan cüzdan, değilse kontrat
    latest: async () => parseInt(await send('eth_blockNumber', [])),
    /* zaman damgası (saniye) ≥ ts olan ilk blok; blok başlıkları üzerinde ikili arama (~27 çağrı) */
    async blockAt(ts) {
      let lo = 0, hi = await rpc.latest();
      while (lo < hi) { const mid = (lo + hi) >> 1; if (parseInt((await rpc.block(mid)).timestamp) < ts) lo = mid + 1; else hi = mid; }
      return lo;
    }
  };
  return rpc;
}
