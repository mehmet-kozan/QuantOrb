/* Operatörler: kanıtlı linkler birleştirir, pack 0.6 ile sayılır, hiçbir cüzdan iki kez sayılmaz. */
import test from 'node:test';
import assert from 'node:assert';
import { operators } from '../src/rules/index.js';

const hs = shares => shares.map((s, i) => ({ i, share: s }));
const link = (a, b, level) => ({ a, b, level });

test('without links every wallet is its own operator, biggest first', () => {
  const ops = operators(hs([0.05, 0.2, 0.1]), []);
  assert.deepStrictEqual(ops.map(o => o.wallets), [[1], [2], [0]]);
  assert.ok(ops.every(o => o.id === null && o.level === null));
});

test('proven links merge wallets, even through a chain', () => {
  const h = hs([0.1, 0.1, 0.1, 0.05]);
  const ops = operators(h, [link(0, 1, 'proven'), link(1, 2, 'proven')]);
  assert.deepStrictEqual(ops[0].wallets, [0, 1, 2]);
  assert.strictEqual(ops[0].id, 'OP-1');
  assert.ok(Math.abs(ops[0].share - 0.3) < 1e-12);
  assert.strictEqual(h[0].op, 'OP-1');
});

test('a pack counts at 60% of its share', () => {
  const ops = operators(hs([0.1, 0.1, 0.1, 0.25]), [link(0, 1, 'pack'), link(0, 2, 'pack')]);
  const pack = ops.find(o => o.level === 'pack');
  assert.deepStrictEqual(pack.wallets, [0, 1, 2]);
  assert.ok(Math.abs(pack.weighted - 0.18) < 1e-12);
  assert.deepStrictEqual(ops[0].wallets, [3]);             /* tek başına 0.25, ağırlıklı 0.18'lik pack'i geçer */
});

test('a wallet already in a proven operator is not counted again in a pack', () => {
  const links = [link(0, 1, 'proven'), link(1, 2, 'pack'), link(1, 3, 'pack'), link(1, 4, 'pack')];
  const ops = operators(hs([0.1, 0.1, 0.1, 0.1, 0.1]), links);
  assert.deepStrictEqual(ops.find(o => o.level === 'proven').wallets, [0, 1]);
  assert.deepStrictEqual(ops.find(o => o.level === 'pack').wallets, [2, 3, 4]);
});

test('regression: fewer than 3 wallets left after the proven ones are taken out is no pack', () => {
  const ops = operators(hs([0.1, 0.1, 0.1, 0.1]), [link(0, 1, 'proven'), link(1, 2, 'pack'), link(1, 3, 'pack')]);
  assert.ok(!ops.some(o => o.level === 'pack'));
  assert.strictEqual(ops.filter(o => o.wallets.length === 1).length, 2);
});

test('regression: chained pack links never put one wallet in two packs', () => {
  const h = hs([0.1, 0.1, 0.1, 0.1, 0.1]);
  const ops = operators(h, [link(0, 1, 'pack'), link(1, 2, 'pack'), link(2, 3, 'pack')]);
  assert.deepStrictEqual(ops.find(o => o.level === 'pack').wallets, [0, 1, 2, 3]);
  const total = ops.reduce((s, o) => s + o.share, 0);
  assert.ok(Math.abs(total - 0.5) < 1e-12);                 /* paylar toplamı holder toplamına eşit */
});
