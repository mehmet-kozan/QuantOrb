/* BSC'ye özgü kontrat kuralları. Girdi, adapter.js'in GoPlus cevabından çıkardığı kontrat kartı.
   Honeypot ve satış engeli kırmızı bayraktır; yüksek satış vergisi cap'tir.
   Bilinmeyen (null) alan hiçbir şey tetiklemez: okunamayan veri kanıt değildir. */
import cfg from '../config/rules.js';
import { pct } from './format.js';

export function contractGates(c) {
  if (!c) return [];
  const gates = [];
  if (c.honeypot === true) gates.push({ hard: true, text: 'honeypot: the contract blocks selling' });
  else if (c.cannotSellAll === true) gates.push({ hard: true, text: 'the contract blocks selling the whole balance' });
  if (c.sellTax != null && c.sellTax >= cfg.contract.highSellTax) gates.push({ hard: false, text: `sell tax is ${pct(c.sellTax, 0)} · verdict capped at RISKY` });
  return gates;
}
