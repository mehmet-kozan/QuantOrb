/* Bir tarama, baştan sona: holder'lar ve linklerden verdict'e.
   Sıra: too established → too early → operatörler → skor. Guard ve kontrat kapıları her durumda eklenir.

   Girdi (ScanInput):
     holders        float payına göre en büyük 20 cüzdan: { share, kind: 'buy'|'transfer', virgin, sniper, bundle, sold, dev, unread }
     links          [{ a, b, kind, level: 'proven'|'pack' }] holder sırasına göre
     floatTokens    curve, havuz, locker ve burn adresleri dışındaki arz
     reserveTokens  satışın gideceği havuzdaki token
     liquidityUsd   havuzun likiditesi (bilinmiyorsa null: cap uygulanmaz)
     stage          'curve' ya da havuz adı (sadece TOO EARLY başlığı için)
     market         { ageDays, liquidityUsd, mcap, fdv } (sadece TOO ESTABLISHED için)
     unmeasured     ölçülemeyen parçalar: ['virgin', 'sniper', 'operator'] alt kümesi
     contract       adapter.js'in çıkardığı kontrat kartı (BSC)
     creator, slot0Share, devShare, traded   Guard (isteğe bağlı) */
import cfg from '../config/rules.js';
import { sum } from './format.js';
import { operators } from './operators.js';
import { score } from './score.js';
import { guard } from './guard.js';
import { contractGates } from './contract.js';

const HOLDER = { kind: null, virgin: false, unread: false, sniper: false, bundle: false, dev: false, sold: false, op: null };
const hasGuard = x => x.creator !== undefined || x.slot0Share !== undefined || x.devShare !== undefined;

export function scanVerdict(input) {
  const SC = cfg.scan, mk = input.market || null;
  const extra = {
    guard: hasGuard(input) ? guard({ history: input.creator, slot0Share: input.slot0Share, devShare: input.devShare, traded: input.traded }) : undefined,
    contract: input.contract || undefined
  };
  const cGates = contractGates(input.contract);

  if (mk && mk.ageDays > SC.establishedDays && mk.liquidityUsd > SC.establishedLiq && (mk.mcap || mk.fdv) > SC.establishedMcap) {
    return { state: 'too_established', band: 'ESTABLISHED', score: null, operators: [], gates: cGates, scenario: null, headline: 'Too established for a holder scan', ...extra };
  }

  const hs = (input.holders || []).map((h, i) => ({ ...HOLDER, ...h, i, op: null }));
  if (hs.length < SC.minHolders) {
    /* az holder: paylar kendi aralarında normalize edilir, skor verilmez */
    const tot = sum(hs, h => h.share) || 1;
    hs.forEach(h => { h.share = h.share / tot; });
    const n = hs.length, where = (input.stage || 'curve') === 'curve' ? 'curve' : 'pools';
    return {
      state: 'too_early', band: 'EARLY', score: null, holders: hs, gates: cGates, scenario: null,
      operators: hs.map(h => ({ id: null, wallets: [h.i], share: h.share, level: null, weighted: h.share })),
      headline: `${n} wallet${n === 1 ? '' : 's'} hold${n === 1 ? 's' : ''} this token outside the ${where}`,
      ...extra
    };
  }

  const ops = operators(hs, input.links || []);
  const unread = hs.filter(h => h.unread && h.share >= SC.deepMinShare).length;
  const s = score(hs, ops, {
    floatTokens: input.floatTokens, reserveTokens: input.reserveTokens, liquidityUsd: input.liquidityUsd ?? null,
    unread, unmeasured: new Set(input.unmeasured || []), extraGates: cGates
  });
  return { state: unread >= SC.partialMinUnread ? 'partial' : 'ok', unread, holders: hs, operators: ops, ...s, ...extra };
}
