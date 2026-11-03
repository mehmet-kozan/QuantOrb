/* Skor: beş parça, kırmızı bayraklar, cap'ler, bant ve satış senaryosu.
   Saf fonksiyon: ağ çağrısı yapmaz, girdisi verdict.js'in normalize ettiği holder listesidir.
   Ölçülemeyen bir parça (ctx.unmeasured) null kalır ve kalan ağırlıklar 100'e ölçeklenir. */
import cfg from '../config/rules.js';
import { pct, usd, sum } from './format.js';

export const WEIGHTS = { operator: 35, virgin: 25, transfer: 20, sniper: 10, concentration: 10 };
/* [tam puan eşiği, sıfır puan eşiği] */
export const SCALE = { operator: [0.10, 0.60], virgin: [0.10, 0.80], transfer: [0.01, 0.10], sniper: [0.01, 0.15], concentration: [0.25, 0.70] };

/* ilk eşikte tam puan, ikincide sıfır, arası doğrusal; 0.1'e yuvarlanır */
export const part = (k, x) => {
  if (x == null) return null;
  const [full, zero] = SCALE[k];
  const q = x <= full ? 1 : x >= zero ? 0 : (zero - x) / (zero - full);
  return Math.round(WEIGHTS[k] * q * 10) / 10;
};

/* sabit çarpım havuzuna q token satılınca fiyat düşüşü; R havuzdaki token. q = R → %75 */
export const impact = (q, R) => (q <= 0 || !(R > 0)) ? 0 : 1 - (R / (R + q)) ** 2;

/* H: holder'lar, ops: ağırlıklı paya göre sıralı operatörler,
   ctx: { floatTokens, reserveTokens, liquidityUsd, unread, unmeasured?: Set, extraGates?: [] } */
export function score(H, ops, ctx) {
  const { floatTokens: F, reserveTokens: R, unread } = ctx;
  const unmeasured = ctx.unmeasured || new Set();
  const real = ops.filter(o => o.wallets.length > 1);
  const big = ops[0];
  const imp = big && !unmeasured.has('operator') ? impact(big.weighted * F, R) : 0;
  const nonDev = H.filter(h => !h.dev), readW = nonDev.filter(h => !h.unread);

  const m = {
    impact: imp, operator: big ? big.weighted : 0, unread,
    virgin: unmeasured.has('virgin') ? null : readW.filter(h => h.virgin).length / Math.max(1, readW.length),
    transfer: sum(H.filter(h => h.kind === 'transfer'), h => h.share),
    sniper: unmeasured.has('sniper') ? null : sum(nonDev.filter(h => h.sniper && !h.sold), h => h.share),
    concentration: sum(H, h => h.share)
  };
  const parts = {
    operator: unmeasured.has('operator') ? null : part('operator', imp),
    virgin: part('virgin', m.virgin),
    transfer: part('transfer', m.transfer),
    sniper: part('sniper', m.sniper),
    concentration: part('concentration', m.concentration)
  };
  const known = Object.keys(parts).filter(k => parts[k] != null);
  let total = Math.round(sum(known, k => parts[k]) * 100 / sum(known, k => WEIGHTS[k]));

  /* kırmızı bayraklar (hard) ve cap'ler (soft); kontrat kapıları dışarıdan gelir */
  const gates = [...(ctx.extraGates || [])];
  if (big && imp >= 0.5 && big.wallets.length > 1) gates.push({ hard: true, text: `biggest operator could move price −${Math.round(imp * 100)}% if sold (${pct(big.share)} of float, ${big.wallets.length} linked wallets)` });
  if (m.virgin != null && m.virgin >= 0.8 && readW.length) gates.push({ hard: true, text: `${Math.round(m.virgin * 100)}% of the top wallets never traded before this token` });
  if (m.transfer >= 0.10) gates.push({ hard: true, text: `${pct(m.transfer)} of float was received by transfer, not bought` });
  real.forEach(o => {
    if (o.level === 'pack' || o.wallets.length >= 3) gates.push({ hard: false, text: `${o.level === 'pack' ? 'pack of' : 'proven operator of'} ${o.wallets.length} wallets holds ${pct(o.share)} of float` });
  });
  if (big && imp >= 0.5 && big.wallets.length === 1) gates.push({ hard: false, text: `one holder could move price −${Math.round(imp * 100)}% (thin liquidity)` });
  if (ctx.liquidityUsd != null && ctx.liquidityUsd < cfg.scan.lowLiquidityUsd) gates.push({ hard: false, text: `liquidity is only ${usd(ctx.liquidityUsd)} · verdict capped at RISKY` });
  if (unread >= cfg.scan.partialMinUnread) gates.push({ hard: false, text: `${unread} of ${H.length} wallets could not be read in time · verdict capped at RISKY` });
  else if (unread > 0) gates.push({ hard: false, note: true, text: `${unread} wallet${unread > 1 ? 's' : ''} could not be read in time · not counted as evidence` });

  const hard = gates.some(g => g.hard), soft = gates.some(g => !g.hard && !g.note);
  if (soft) total = Math.min(total, cfg.scan.capCeiling);
  const band = hard ? 'DANGER' : total >= 80 ? 'CLEAN' : total >= 60 ? 'OK' : total >= 40 ? 'RISKY' : 'DANGER';

  /* satış senaryosu: sadece DANGER'da; bağlı, taze, transferle almış ve satmamış launch alıcıları satarsa */
  let scenario = null;
  if (band === 'DANGER') {
    const realIds = new Set(real.map(o => o.id));
    const linked = h => h.op && realIds.has(h.op);
    const sus = H.filter(h => linked(h) || h.kind === 'transfer' || h.virgin || (h.bundle && !h.sold));
    const q = sum(sus, h => h.share), d = unmeasured.has('operator') ? 0 : impact(q * F, R);
    if (d >= cfg.scan.scenarioMinDrop) scenario = { drop: d, share: q, wallets: sus.length, parts: [
      { k: 'linked', share: sum(sus.filter(linked), h => h.share) },
      { k: 'fresh', share: sum(sus.filter(h => !linked(h) && h.virgin), h => h.share) },
      { k: 'transfer', share: sum(sus.filter(h => !linked(h) && !h.virgin && h.kind === 'transfer'), h => h.share) }
    ] };
  }

  const headline = `${H.length} wallets → ${ops.length} operators, biggest holds ${pct(big ? big.share : 0)} of float` + (imp >= 0.01 ? `, could move price −${Math.round(imp * 100)}% if sold` : '');
  return { score: total, band, parts, metrics: m, gates, scenario, headline, unmeasured: [...unmeasured] };
}
