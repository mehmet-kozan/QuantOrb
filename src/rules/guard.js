/* Guard: token sayfasındaki üç kontrol. Sadece kanıtla HELD; okunmamış kontrol ok:null'dır,
   ne tutar ne geçer. Veriyi okumak (creator geçmişi, launch bloğu, dev bakiyesi) kaynak katmanının işi. */
import cfg from '../config/rules.js';
import { pct } from './format.js';

const G = cfg.guard;
const check = (k, name, ok, text, reason) => ({ k, name, ok, text, reason });
const serial = h => h.launched >= G.historyMinLaunched && h.graduated * 100 < G.historyMaxGradPct * h.launched;
const day = ms => new Date(ms).toISOString().slice(0, 10);

/* h: creator'ın lansmanları.
     { launched, graduated, chain: true }          zincirden okunmuş tam kayıt
     { launched, graduated, since, local: true }   kendi lansman kaydımız: kısmi, yalnızca aleyhe kanıt
     { contract: true }                            lansmanı bir kontrat yaptı (vault, bundler): cüzdan bilinmez
     { launched, alive, local: true }              eski sunucunun kendi gördüğü lansmanlar (hayatta olanlarla)
     { launched, alive }                           hangi lansmanların hayatta olduğunu bilen eski bir kaynak */
export function historyCheck(h) {
  const name = 'Creator history';
  if (!h) return check('history', name, null, 'read once the launch gets traction');
  if (h.unavailable) return check('history', name, null, 'launch history not available right now');
  if (h.contract) return check('history', name, null, 'launched through a contract · creator wallet not known');
  const plural = h.launched === 1 ? '' : 's';
  if (h.chain) {
    return check('history', name, !serial(h), `${h.launched} token${plural} launched, ${h.graduated} graduated · from the chain`, `serial creator: ${h.launched} launches, ${h.graduated} graduated`);
  }
  if (h.local && h.graduated != null) {
    /* kendi kaydımız kaydın başladığı günden beri: seri lansmancıyı gösterebilir, temize çıkaramaz */
    if (serial(h)) return check('history', name, false, `${h.launched} launches in our record, ${h.graduated} graduated`, `serial creator: ${h.launched} launches we saw, ${h.graduated} graduated`);
    return check('history', name, null, `${h.launched} launch${plural.replace('s', 'es')} in our record${h.since ? ` since ${day(h.since)}` : ''} · full history not read`);
  }
  const bad = h.launched >= G.historyMinLaunched && h.alive / Math.max(1, h.launched) < G.historyMaxAliveRate;
  if (h.local) {
    if (bad) return check('history', name, false, `${h.launched} launches recorded by us, ${h.alive} still alive`, `creator launched ${h.launched} tokens we saw, ${h.alive} alive`);
    return check('history', name, null, h.launched <= 1 ? 'creator check unavailable: the public RPC did not answer' : `${h.launched} launches in our own record · full history not read`);
  }
  return check('history', name, !bad, `${h.launched} token${plural} launched, ${h.alive} still alive`, `creator launched ${h.launched} tokens, ${h.alive} alive`);
}

/* share: launch bloğunda alınan arz payı (null = okunmadı) */
export function slot0Check(share) {
  if (share == null) return check('slot0', 'First-slot buyers', null, 'launch slot not read');
  return check('slot0', 'First-slot buyers', share < G.slot0Max, `${pct(share, 0)} of supply bought in the launch slot`, `${pct(share, 0)} bought in the first slot`);
}

/* share: dev cüzdanının tuttuğu arz payı; after: token işlem görmeye başladıysa */
export function devCheck(share, after) {
  if (share == null) return check('dev', 'Dev holdings', null, 'dev balance not read');
  const text = `dev holds ${pct(share, share < 0.1 && after ? 1 : 0)} of supply${after ? ' now' : ''}`;
  return check('dev', 'Dev holdings', share < G.devMax, text, `dev still holds ${pct(share, 0)} after launch`);
}

/* kontroller → sitenin gösterdiği Guard nesnesi: ilk başarısız kontrolün gerekçesiyle HELD */
export function verdict(checks) {
  const failed = checks.filter(c => c.ok === false);
  return {
    pass: failed.length === 0,
    reason: failed.length ? failed[0].reason : null,
    checks: checks.map(({ k, name, ok, text }) => ({ k, name, ok, text })),
    pending: checks.some(c => c.ok === null) || undefined
  };
}

/* üçü bir arada: { history, slot0Share, devShare, traded } */
export const guard = x => verdict([historyCheck(x.history || null), slot0Check(x.slot0Share ?? null), devCheck(x.devShare ?? null, !!x.traded)]);
