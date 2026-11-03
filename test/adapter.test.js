/* Kaynak cevaplarından ScanInput'a eşleme. Fixture'lar test/fixtures içinde; şekilleri docs/kaynaklar.md anlatır. */
import test from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { toScanInput, contractCard } from '../src/adapter.js';
import { scanVerdict } from '../src/rules/index.js';
import { scan } from '../src/scan.js';

const fx = name => JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8'));
const NOW = 1760000000000 + 5 * 864e5;   // pair yaratılışından 5 gün sonra
const build = (over = {}) => toScanInput({ address: '0xt0ken', map: fx('bubblemaps-map'), security: fx('goplus'), pairs: fx('dexscreener'), now: NOW, ...over });
const at = (input, addr) => input.holders.find(h => h.address === addr);

test('pool, burn and exchange addresses are not holders; shares are re-based on the float', () => {
  const x = build();
  assert.deepStrictEqual(x.holders.map(h => h.address), ['0xw01', '0xw02', '0xw03', '0xw04', '0xw05', '0xw06', '0xw07', '0xw08', '0xw09', '0xw10', '0xw11', '0xw12']);
  assert.ok(Math.abs(at(x, '0xw01').share - 0.08 / 0.51) < 1e-12);
  assert.ok(Math.abs(x.floatTokens - 510e6) < 1);
});

test('a Bubblemaps cluster and a direct transfer between top holders are proven links', () => {
  const x = build();
  assert.deepStrictEqual(x.links.filter(l => l.kind === 'cluster').map(l => [l.a, l.b]), [[0, 1], [1, 2]]);
  assert.deepStrictEqual(x.links.filter(l => l.kind === 'direct').map(l => [l.a, l.b]), [[3, 5]]);
  const r = scanVerdict(x);
  assert.deepStrictEqual(r.operators[0].wallets, [0, 1, 2]);
  assert.strictEqual(r.operators[0].level, 'proven');
});

test('tokens from an ordinary wallet are received, not bought; via a pool, router or time node they are a buy', () => {
  const x = build();
  assert.strictEqual(at(x, '0xw06').kind, 'transfer');   // başka bir top holder'dan
  assert.strictEqual(at(x, '0xw07').kind, 'transfer');   // magic node'dan
  assert.strictEqual(at(x, '0xw09').kind, 'buy');        // time node (router)
  assert.strictEqual(at(x, '0xw10').kind, 'buy');        // havuz
});

test('fresh = first activity no earlier than the token; no first activity = unread; no token age = not measured', () => {
  const x = build();
  assert.strictEqual(at(x, '0xw02').virgin, true);
  assert.strictEqual(at(x, '0xw01').virgin, false);
  assert.strictEqual(at(x, '0xw05').virgin, true);       // dev de fresh ama skorda sayılmaz
  assert.strictEqual(at(x, '0xw05').dev, true);
  assert.strictEqual(at(x, '0xw08').unread, true);
  assert.deepStrictEqual(x.unmeasured, ['sniper']);
  assert.ok(Math.abs(scanVerdict(x).metrics.virgin - 0.3) < 1e-12);   // 10 okunan dev-dışı cüzdandan 3'ü
  const noAge = build({ pairs: [] });
  assert.deepStrictEqual(noAge.unmeasured, ['sniper', 'virgin']);
  assert.ok(noAge.holders.every(h => !h.unread));
  assert.strictEqual(scanVerdict(noAge).parts.virgin, null);
});

test('reserve from the pair GoPlus knows; liquidity, market cap and age from DexScreener', () => {
  const x = build();
  assert.strictEqual(x.reserveTokens, 400e6);
  assert.strictEqual(x.liquidityUsd, 12000.5);
  assert.strictEqual(x.market.mcap, 45000);
  assert.ok(Math.abs(x.market.ageDays - 5) < 1e-9);
  assert.strictEqual(x.stage, 'pancakeswap');
  const noPool = build({ map: { ...fx('bubblemaps-map'), nodes: { ...fx('bubblemaps-map').nodes, top_holders: fx('bubblemaps-map').nodes.top_holders.filter(h => h.address !== '0xpool') } }, security: null });
  assert.ok(noPool.unmeasured.includes('operator'));
  assert.strictEqual(scanVerdict(noPool).parts.operator, null);
});

test('Guard: creator history is not read here, launch slot from bundles, dev share from GoPlus', () => {
  const r = scanVerdict(build());
  assert.strictEqual(r.guard.checks[0].ok, null);
  assert.strictEqual(r.guard.checks[1].text, '12% of supply bought in the launch slot');
  assert.strictEqual(r.guard.checks[2].ok, true);
  assert.strictEqual(r.guard.pending, true);
});

test('the contract card: flags, taxes, LP; a honeypot is a red flag, a high sell tax a cap', () => {
  const c = contractCard(fx('goplus'));
  assert.strictEqual(c.honeypot, false);
  assert.strictEqual(c.sellTax, 0.05);
  assert.strictEqual(c.ownerAddress, null);
  assert.ok(Math.abs(c.lpLockedShare - 0.1) < 1e-12 && Math.abs(c.lpBurnedShare - 0.9) < 1e-12);
  assert.strictEqual(contractCard({}).honeypot, null);     // bilinmeyen alan null
  const honeypot = scanVerdict(build({ security: { ...fx('goplus'), is_honeypot: '1' } }));
  assert.strictEqual(honeypot.band, 'DANGER');
  assert.ok(honeypot.gates.some(g => g.hard && /honeypot/.test(g.text)));
  const taxed = scanVerdict({ ...build({ security: { ...fx('goplus'), sell_tax: '0.25' } }), links: [], holders: build().holders.map(h => ({ ...h, kind: 'buy', virgin: false })) });
  assert.ok(taxed.score <= 59 && taxed.gates.some(g => /sell tax is 25%/.test(g.text)));
});

test('shares given as percentages are normalised', () => {
  const map = fx('bubblemaps-map');
  map.nodes.top_holders.forEach(h => { h.holder_data.share *= 100; });
  const x = toScanInput({ address: '0xt0ken', map, security: null, pairs: [], now: NOW });
  assert.ok(Math.abs(at(x, '0xw01').share - 0.08 / 0.51) < 1e-12);
});

test('scan(): sources are read in parallel; without Bubblemaps there is no scan, the others may fail', async () => {
  const ok = await scan('0xt0ken', { apiKey: 'k', fetchers: { map: async () => fx('bubblemaps-map'), security: async () => { throw new Error('rate limited'); }, pairs: async () => fx('dexscreener') } });
  assert.strictEqual(ok.sources.goplus, 'rate limited');
  assert.strictEqual(ok.contract, undefined);
  assert.ok(ok.score != null);
  const none = await scan('0xt0ken', { apiKey: 'k', fetchers: { map: async () => { throw new Error('HTTP 401'); }, security: async () => fx('goplus'), pairs: async () => [] } });
  assert.strictEqual(none.state, 'unavailable');
});
