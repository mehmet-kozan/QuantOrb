/* Shield: her yeni lansmanda çalışan hafif kontrol (Radar ve alarmlar için). İki kontrol:
     creator history  seri lansmancı: 10+ lansman ve %10'dan azı mezun
     dev at launch    create işleminde dev'in aldığı pay arzın %15'i veya daha fazla
   Okunmamış kontrol ok:null'dır ve lansmanı tutmaz. */
import cfg from '../config/rules.js';
import { verdict } from './guard.js';
import { pct } from './format.js';

const SH = cfg.shield;

/* { launched, graduated } → { launches, graduated, serial } */
export function evaluate(r) {
  if (!r || r.launched == null) return null;
  const serial = r.launched >= SH.minLaunches && r.graduated * 100 < SH.maxGradPct * r.launched;
  return { launches: r.launched, graduated: r.graduated, serial };
}

/* rec: zincirden { launched, graduated } ya da okunmadıysa null. Bir launchpad token'ının creator'ı için
   0 lansman eksik cevaptır (lansmanın kendisi de sayılmalıydı): "unavailable", geçer değil. */
export function creatorCheck(rec) {
  const r = rec && rec.launched > 0 ? evaluate(rec) : null;
  if (r) return { k: 'history', name: 'Creator history', ok: !r.serial, text: `${r.launches} token${r.launches === 1 ? '' : 's'} launched, ${r.graduated} graduated`, reason: `serial creator: ${r.launches} launches, ${r.graduated} graduated` };
  if (rec && rec.launched === 0) return { k: 'history', name: 'Creator history', ok: null, text: 'creator check unavailable (incomplete answer)' };
  return { k: 'history', name: 'Creator history', ok: null, text: 'read once the launch gets traction' };
}

/* x: { devAtLaunch (create işleminde dev'in aldığı token), supply (toplam arz) } */
export function devCheck(x) {
  if (x.devAtLaunch == null || !(x.supply > 0)) return { k: 'dev', name: 'Dev at launch', ok: null, text: 'dev buy not known' };
  const share = x.devAtLaunch / x.supply;
  return { k: 'dev', name: 'Dev at launch', ok: share < SH.devMax, text: `dev bought ${pct(share, share < 0.1 ? 1 : 0)} of supply at launch`, reason: `dev bought ${pct(share, 0)} at launch` };
}

/* bir lansmanın Shield sonucu: { creator: { launched, graduated } | null, devAtLaunch, supply } */
export const shield = x => verdict([creatorCheck(x.creator), devCheck(x)]);
