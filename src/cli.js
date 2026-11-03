#!/usr/bin/env node
/* Komut satırı:
     node src/cli.js 0xTokenAdresi            canlı tarama (BUBBLEMAPS_API_KEY gerekir)
     node src/cli.js examples/clean.json      hazır bir ScanInput dosyası, ağ yok
     --json                                   tam sonucu JSON olarak yaz */
import { readFileSync } from 'node:fs';
import { scan } from './scan.js';
import { scanVerdict, WEIGHTS } from './rules/index.js';
import { pct, usd } from './rules/format.js';

const args = process.argv.slice(2), target = args.find(a => !a.startsWith('--'));
if (!target) { console.error('usage: node src/cli.js <0xaddress | scan.json> [--json]'); process.exit(2); }

const r = target.endsWith('.json')
  ? { ...scanVerdict(JSON.parse(readFileSync(target, 'utf8'))), input: JSON.parse(readFileSync(target, 'utf8')) }
  : await scan(target);

if (args.includes('--json')) { console.log(JSON.stringify(r, null, 2)); process.exit(0); }

const LABEL = { operator: 'Biggest operator', virgin: 'Fresh wallets', transfer: 'Received, not bought', sniper: 'Unsold snipers', concentration: 'Top-20 share' };
const mark = ok => ok === true ? '✓' : ok === false ? '✕' : '…';
const yn = v => v === true ? 'yes' : v === false ? 'no' : 'not read';
const out = [];

out.push((r.input?.name || r.address || target) + (r.input?.symbol ? ` · $${r.input.symbol}` : ''));
out.push(r.headline);
out.push('');
if (r.score == null) out.push(`${r.band} · no score`);
else {
  out.push(`score ${r.score} / 100 · ${r.band}${r.state === 'partial' ? ' · PARTIAL' : ''}`);
  Object.keys(WEIGHTS).forEach(k => out.push(`  ${LABEL[k].padEnd(22)}${(r.parts[k] == null ? 'n/a' : r.parts[k].toFixed(1)).padStart(5)} / ${WEIGHTS[k]}`));
  if (r.unmeasured?.length) out.push(`  not measured: ${r.unmeasured.join(', ')} · the rest is scaled to 100`);
}
(r.gates || []).forEach(g => out.push(`${g.note ? 'NOTE' : g.hard ? 'RED FLAG' : 'CAP'} · ${g.text}`));
if (r.scenario) out.push(`SCENARIO · if the linked, fresh and transferred wallets sold their ${pct(r.scenario.share)} of float into today's liquidity, the price would fall about ${Math.round(r.scenario.drop * 100)}%`);
const multi = (r.operators || []).filter(o => o.wallets.length > 1);
if (multi.length) out.push('operators · ' + multi.map(o => `${o.id} ${o.wallets.length} ${o.level === 'pack' ? 'fresh wallets (pack)' : 'wallets'} ${pct(o.share)}`).join(' · '));

if (r.guard) {
  out.push('', `Guard · ${r.guard.pass ? (r.guard.pending ? 'PASS so far' : 'PASS') : `HELD · ${r.guard.reason}`}`);
  r.guard.checks.forEach(c => out.push(`  ${mark(c.ok)} ${c.name.padEnd(18)}${c.text}`));
}
if (r.contract) {
  const c = r.contract;
  out.push('', 'Contract (GoPlus)');
  out.push(`  honeypot ${yn(c.honeypot)} · can't sell all ${yn(c.cannotSellAll)} · tax buy ${pct(c.buyTax, 0)} / sell ${pct(c.sellTax, 0)}`);
  out.push(`  owner ${c.ownerAddress || 'none'} · mintable ${yn(c.mintable)} · pausable ${yn(c.pausable)} · blacklist ${yn(c.blacklist)} · hidden owner ${yn(c.hiddenOwner)}`);
  out.push(`  open source ${yn(c.openSource)} · proxy ${yn(c.proxy)} · LP locked ${pct(c.lpLockedShare, 0)} · LP burned ${pct(c.lpBurnedShare, 0)} · holders ${c.holderCount ?? '—'}`);
}
if (r.input?.market) {
  const m = r.input.market;
  out.push('', `Market · liquidity ${usd(m.liquidityUsd)} · mcap ${usd(m.mcap)} · FDV ${usd(m.fdv)} · age ${m.ageDays == null ? '—' : m.ageDays.toFixed(1) + ' days'}`);
}
if (r.sources) out.push('', `Sources · bubblemaps ${r.sources.bubblemaps} · goplus ${r.sources.goplus} · dexscreener ${r.sources.dexscreener}`);
console.log(out.join('\n'));
