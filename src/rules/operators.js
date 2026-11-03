/* Linklerden operatörlere.
   Kanıtlı linkler cüzdanları tek operatörde birleştirir ve zincirlenir (A–B, B–C → üçü bir operatör).
   Pack: birlikte giren taze cüzdanlar. Davranıştır, kanıt değil; payı cfg.pack.weight ile sayılır.
   Kanıtlı operatördeki cüzdan pack'e alınmaz; geriye en az cfg.pack.minWallets cüzdan kalırsa pack olur.
   Her cüzdan en fazla bir grupta bulunur, pay hiçbir zaman iki kez sayılmaz. */
import cfg from '../config/rules.js';
import { sum } from './format.js';

/* küçük bir union-find: union(a, b) ve bütün grupları listeleme */
const unionFind = n => {
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = i => parent[i] === i ? i : (parent[i] = find(parent[i]));
  return {
    union: (a, b) => { parent[find(a)] = find(b); },
    groups: () => {
      const byRoot = new Map();
      parent.forEach((_, i) => { const r = find(i); byRoot.set(r, [...(byRoot.get(r) || []), i]); });
      return [...byRoot.values()];
    }
  };
};

/* hs: holder'lar (index = sıra), links: [{ a, b, kind, level: 'proven' | 'pack' }] */
export function operators(hs, links) {
  const proven = unionFind(hs.length);
  links.filter(l => l.level === 'proven').forEach(l => proven.union(l.a, l.b));
  const out = proven.groups().filter(g => g.length > 1).map(wallets => ({ wallets, level: 'proven' }));
  const taken = new Set(out.flatMap(o => o.wallets));

  const packs = unionFind(hs.length);
  links.filter(l => l.level === 'pack').forEach(l => packs.union(l.a, l.b));
  packs.groups()
    .map(g => g.filter(i => !taken.has(i)))
    .filter(g => g.length >= cfg.pack.minWallets)
    .forEach(wallets => { out.push({ wallets, level: 'pack' }); wallets.forEach(i => taken.add(i)); });

  hs.forEach((_, i) => { if (!taken.has(i)) out.push({ wallets: [i], level: null }); });

  out.forEach(o => {
    o.share = sum(o.wallets, i => hs[i].share);
    o.weighted = o.share * (o.level === 'pack' ? cfg.pack.weight : 1);
  });
  out.sort((a, b) => b.weighted - a.weighted);

  let n = 0;
  return out.map(o => {
    const id = o.wallets.length > 1 ? `OP-${++n}` : null;
    if (id) o.wallets.forEach(i => { hs[i].op = id; });
    return { id, wallets: [...o.wallets].sort((a, b) => a - b), share: o.share, level: id ? o.level : null, weighted: o.weighted };
  });
}
