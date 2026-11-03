/* Launchpad katmanı: ABI yardımcıları, four.meme ve flap.sh çözücüleri, yaratılış ve launch bloğu okuması,
   creator geçmişi. Fixture'lar 3 Kasım 2026'da canlı BSC'den alınmış ham cevaplardır (test/fixtures/launchpad.json). */
import test from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { keccak256, selector, encodeCall, str } from '../src/sources/abi.js';
import * as four from '../src/sources/fourmeme.js';
import * as flap from '../src/sources/flap.js';
import { readState, fetchLaunch, readLaunchBlock, creatorHistory } from '../src/sources/launchpad.js';
import { openRecord } from '../src/record.js';

const fx = JSON.parse(readFileSync(new URL('./fixtures/launchpad.json', import.meta.url), 'utf8'));
const near = (a, b, tol) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));

/* fixture'dan cevap veren sahte RPC: eth_call hedefine ve seçiciye göre, loglar token adresine göre */
const fakeRpc = (over = {}) => ({
  calls: [],
  async call(to, data) {
    this.calls.push(to.toLowerCase() + data.slice(0, 10));
    const sel = data.slice(0, 10), token = '0x' + data.slice(34, 74);
    if (to.toLowerCase() === four.HELPER3.toLowerCase()) {
      if (sel === selector('tryBuy(address,uint256,uint256)')) return fx.fourmeme.tryBuy;
      return token === fx.fourmeme.token ? fx.fourmeme.getTokenInfo : fx.notLaunchpad.getTokenInfo;
    }
    if (token === fx.flap.token) return fx.flap.getTokenV8Safe;
    throw new Error('execution reverted');   // Portal flap olmayan token için revert eder
  },
  async logs(address, topics, from, to) {
    if (address.toLowerCase() === fx.fourmeme.token) return fx.fourmeme.blockTransfers;
    if (address.toLowerCase() === fx.flap.token) return fx.flap.blockTransfers;
    if (address === four.TOKEN_MANAGER2) return from <= 131415093 && 131415093 <= to ? [fx.fourmeme.createLog] : [];
    return [];
  },
  async blockAt() { return 131415093; },
  async code(a) { return a.toLowerCase() === '0x90497450f2a706f1951b5bdda52b4e5d16f34c06' ? '0x6080' : '0x'; },   // flap VaultPortal kontrattır
  ...over
});

test('keccak256 matches the known vectors; selectors and topics are computed from signatures', () => {
  assert.strictEqual(keccak256(''), '0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470');
  assert.strictEqual(keccak256('Transfer(address,address,uint256)'), '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef');
  assert.strictEqual(selector('balanceOf(address)'), '0x70a08231');
  assert.strictEqual(encodeCall('getTokenInfo(address)', fx.fourmeme.token), '0x1f69565f000000000000000000000000' + fx.fourmeme.token.slice(2));
  assert.strictEqual(fx.fourmeme.createLog.topics[0], four.TOPIC.create);     // canlı logun konusu imzadan hesaplananla aynı
  assert.strictEqual(fx.flap.createLog.topics[0], flap.TOPIC.create);
  assert.strictEqual(str(fx.flap.createLog.data, 4), 'Leomaxi');
});

test('four.meme: getTokenInfo decodes; version 0 is not a four.meme token; the curve is constant-product', () => {
  const s = four.decodeState(fx.fourmeme.getTokenInfo);
  assert.strictEqual(s.platform, 'four.meme');
  assert.strictEqual(s.graduated, false);
  assert.ok(near(s.lastPrice, 4.559951964e-9, 1e-9));
  assert.ok(s.progress > 0 && s.progress < 1e-6);                 // 1.6e-6 BNB toplanmış / 14.3 BNB hedef
  assert.strictEqual(four.decodeState(fx.notLaunchpad.getTokenInfo), null);
  /* tryBuy(1e8 token) kotası + son fiyat → sanal token rezervi ≈ 1.0746 milyar (canlıda 5 kotayla uyumlu) */
  assert.ok(near(four.virtualReserve(s, fx.fourmeme.tryBuy), 1.0746e9, 0.002));
  const c = four.decodeCreate(fx.fourmeme.createLog);
  assert.deepStrictEqual([c.creator, c.token, c.symbol, c.supply, c.ts, c.block], ['0x1e4a6f4a089721dbe445703006037cc31e972c06', fx.fourmeme.token, 'TRUTH', 1e9, null, 131415093]);
});

test('flap.sh: getTokenV8Safe decodes; the virtual reserve reproduces the on-chain price; taxes are in basis points', () => {
  const s = flap.decodeState(fx.flap.getTokenV8Safe);
  assert.strictEqual(s.platform, 'flap.sh');
  assert.strictEqual(s.status, 'Tradable');
  assert.strictEqual(s.graduated, false);
  assert.strictEqual(s.pool, null);
  assert.ok(near(s.buyTax, 0.09, 1e-9) && near(s.sellTax, 0.09, 1e-9));
  assert.ok(near(s.virtualReserveTokens, 1107036410.94, 1e-6));
  /* fiyat = k / Rv² : zincirdeki 5546341412 wei ile karşılaştır */
  const k = Number(BigInt('0x' + fx.flap.getTokenV8Safe.slice(2 + 64 * 7, 2 + 64 * 8))) / 1e18;
  assert.ok(near(k / s.virtualReserveTokens ** 2 * 1e18, 5546341412, 1e-6));
  const c = flap.decodeCreate(fx.flap.createLog);
  assert.deepStrictEqual([c.creator, c.token, c.symbol, c.ts], ['0x641c1c78c256d4aa6d7e73c5fc0cddef035c6666', fx.flap.token, 'LEOMAXI', 1793700658000]);
});

test('readState asks both launchpads and returns the one that knows the token; a four.meme curve gets a reserve probe', async () => {
  const rpc = fakeRpc();
  const f = await readState(fx.fourmeme.token, rpc);
  assert.strictEqual(f.platform, 'four.meme');
  assert.ok(f.virtualReserveTokens > 1e9);
  const l = await readState(fx.flap.token, rpc);
  assert.strictEqual(l.platform, 'flap.sh');
  assert.strictEqual(await readState('0x' + 'ab'.repeat(20), rpc), null);
});

test('launch block: buyers and the dev buy from the token transfers of that block', async () => {
  const fm = await readLaunchBlock(fx.fourmeme.token, 131415093, '0x1e4a6f4a089721dbe445703006037cc31e972c06', fakeRpc());
  assert.strictEqual(fm.slot0.buyers.length, 1);                     // tek alıcı: creator
  assert.ok(near(fm.devAtLaunch, fm.slot0.tokens, 1e-12) && fm.slot0.tokens > 0);
  const fl = await readLaunchBlock(fx.flap.token, 131414582, '0x641c1c78c256d4aa6d7e73c5fc0cddef035c6666', fakeRpc());
  assert.ok(near(fl.devAtLaunch, 341.06, 1e-3));                     // FlapTokenCirculatingSupplyChanged ile aynı
});

test('fetchLaunch: creation from our record first, else (four.meme) from the DexScreener time via the chain', async () => {
  const pairs = [{ pairCreatedAt: 1793700888000 }];
  const viaChain = await fetchLaunch(fx.fourmeme.token, { rpc: fakeRpc(), record: null, pairs });
  assert.strictEqual(viaChain.creator, '0x1e4a6f4a089721dbe445703006037cc31e972c06');
  assert.strictEqual(viaChain.createdAt, 1793700888000);
  assert.strictEqual(viaChain.supply, 1e9);
  assert.ok(viaChain.slot0.tokens > 0);
  const record = openRecord('/nonexistent/launches.json');
  record.add({ platform: 'flap.sh', token: fx.flap.token, creator: '0x641c1c78c256d4aa6d7e73c5fc0cddef035c6666', block: 131414582, ts: 1793700658000, tx: '0x1' });
  const viaRecord = await fetchLaunch(fx.flap.token, { rpc: fakeRpc(), record, pairs: [] });
  assert.strictEqual(viaRecord.creator, '0x641c1c78c256d4aa6d7e73c5fc0cddef035c6666');
  assert.strictEqual(viaRecord.createdAt, 1793700658000);
  assert.strictEqual(viaRecord.creatorIsContract, false);
  record.add({ platform: 'flap.sh', token: '0x' + 'cd'.repeat(20), creator: '0x90497450f2a706f1951b5bdda52b4e5d16f34c06', block: 131414582, ts: 1793700658000, tx: '0x2' });
  const vault = await fetchLaunch('0x' + 'cd'.repeat(20), { rpc: fakeRpc({ async call(to, data) { if (to === flap.PORTAL) return fx.flap.getTokenV8Safe; return fx.notLaunchpad.getTokenInfo; } }), record, pairs: [] });
  assert.strictEqual(vault.creatorIsContract, true);                 // VaultPortal üzerinden: cüzdan bilinmez
  const noClue = await fetchLaunch(fx.flap.token, { rpc: fakeRpc(), record: null, pairs: [] });
  assert.strictEqual(noClue.creator, null);                           // flap curve token'ı DexScreener'da yok: okunmadı
  assert.strictEqual(noClue.platform, 'flap.sh');
  assert.strictEqual(await fetchLaunch('0x' + 'ab'.repeat(20), { rpc: fakeRpc() }), null);
});

test('creator history from the record is partial: it can show a serial creator, never clear one', async () => {
  const record = openRecord('/nonexistent/launches.json');
  for (let i = 0; i < 12; i++) record.add({ platform: 'four.meme', token: `0x${String(i).padStart(40, '0')}`, creator: '0xDEV', block: 100 + i, ts: 1793700000000 + i, tx: '0x' });
  const h = await creatorHistory('0xdev', { rpc: fakeRpc(), record });
  assert.deepStrictEqual([h.launched, h.graduated, h.local, h.since], [12, 0, true, 1793700000000]);
  assert.strictEqual(await creatorHistory('0xnobody', { rpc: fakeRpc(), record }), null);
});
