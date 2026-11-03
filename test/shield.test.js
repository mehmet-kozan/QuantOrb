/* Shield: her lansmandaki hafif kontrol. */
import test from 'node:test';
import assert from 'node:assert';
import { shield, evaluateCreator, shieldCreatorCheck, shieldDevCheck } from '../src/rules/index.js';

const supply = 1e9;

test('a serial creator: 10+ launches and under 10% graduated', () => {
  assert.deepStrictEqual(evaluateCreator({ launched: 10, graduated: 0 }), { launches: 10, graduated: 0, serial: true });
  assert.strictEqual(evaluateCreator({ launched: 10, graduated: 1 }).serial, false);
  assert.strictEqual(evaluateCreator({ launched: 279, graduated: 3 }).serial, true);
  assert.strictEqual(evaluateCreator({ launched: 9, graduated: 0 }).serial, false);
  assert.strictEqual(evaluateCreator(null), null);
});

test('0 launches for the creator of a launchpad token is an incomplete answer, never a pass', () => {
  assert.strictEqual(shieldCreatorCheck({ launched: 0, graduated: 0 }).ok, null);
  assert.strictEqual(shieldCreatorCheck(null).ok, null);
});

test('dev at launch: buying 15% of supply or more in the create transaction is held', () => {
  assert.strictEqual(shieldDevCheck({ devAtLaunch: 149e6, supply }).ok, true);
  assert.strictEqual(shieldDevCheck({ devAtLaunch: 150e6, supply }).ok, false);
  assert.strictEqual(shieldDevCheck({ devAtLaunch: 32e6, supply }).text, 'dev bought 3.2% of supply at launch');
  assert.strictEqual(shieldDevCheck({ supply }).ok, null);
  assert.strictEqual(shieldDevCheck({ devAtLaunch: 1e6 }).ok, null);   /* arz bilinmiyorsa pay da bilinmez */
});

test('the Shield verdict: HELD with the first reason, PASS when both checks pass', () => {
  const held = shield({ creator: { launched: 2500, graduated: 4 }, devAtLaunch: 1e6, supply });
  assert.strictEqual(held.pass, false);
  assert.strictEqual(held.reason, 'serial creator: 2500 launches, 4 graduated');
  const ok = shield({ creator: { launched: 3, graduated: 1 }, devAtLaunch: 20e6, supply });
  assert.strictEqual(ok.pass, true);
  assert.strictEqual(ok.pending, undefined);
  const early = shield({ creator: null, devAtLaunch: 20e6, supply });
  assert.strictEqual(early.pass, true);
  assert.strictEqual(early.pending, true);
});
