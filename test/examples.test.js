/* examples/ içindeki her dosya alması gereken verdict'i (expect) taşır. İlk dokuzu Solana sürümünün
   kapalı sunucusunun ürettiği sonuçlardır; burada geçmeleri kuralların değişmediğini gösterir. */
import test from 'node:test';
import assert from 'node:assert';
import { readdirSync, readFileSync } from 'node:fs';
import { scanVerdict, historyCheck } from '../src/rules/index.js';

const DIR = new URL('../examples/', import.meta.url);
const files = readdirSync(DIR).filter(f => f.endsWith('.json')).sort();

test('there are examples to check', () => assert.ok(files.length >= 12));

for (const f of files) {
  test(`examples/${f}`, () => {
    const x = JSON.parse(readFileSync(new URL(f, DIR), 'utf8'));
    const r = scanVerdict(x);
    assert.strictEqual(r.state, x.expect.state);
    assert.strictEqual(r.band, x.expect.band);
    assert.strictEqual(r.score, x.expect.score);
    assert.deepStrictEqual(r.parts || null, x.expect.parts);
    assert.strictEqual(r.headline, x.expect.headline);
    assert.deepStrictEqual((r.gates || []).map(g => g.text), x.expect.gates);
    assert.strictEqual(r.scenario ? +r.scenario.drop.toFixed(4) : null, x.expect.scenarioDrop);
    if (x.expect.creatorCheck) {
      const c = historyCheck(x.creator);
      assert.strictEqual(c.ok, x.expect.creatorCheck.ok);
      assert.strictEqual(c.text, x.expect.creatorCheck.text);
    }
  });
}
