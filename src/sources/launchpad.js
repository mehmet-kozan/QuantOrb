/* İki launchpad (four.meme, flap.sh) tek arayüzde. Bir token için:
     readState      hangi platformun, curve'de mi mezun mu, ilerleme, sanal rezerv, vergiler, havuz
     findCreation   creator ve yaratılış zamanı: önce kendi lansman kaydımız, yoksa four.meme için DexScreener'ın
                    pair zamanından blok bulunup TokenCreate okunur (flap curve token'ları DexScreener'da yok)
     readLaunchBlock launch bloğundaki alıcılar ve dev'in aldığı miktar (token'ın o bloktaki Transfer'leri)
   Çıktı (Launch): { platform, graduated, progress, pool, virtualReserveTokens, buyTax, sellTax, supply,
                     creator, creatorIsContract, createdAt, block, slot0: { tokens, buyers }, devAtLaunch }.
   Okunamayan alan null. creator bir kontratsa (flap VaultPortal, bundler) insan cüzdanı olaydan okunamaz:
   Guard ve Shield bunu "okunmadı" sayar, kontratın lansman sayısı kimseyi seri lansmancı yapmaz. */
import cfg from '../config/rules.js';
import * as four from './fourmeme.js';
import * as flap from './flap.js';
import { makeRpc } from './rpc.js';
import { topic, num } from './abi.js';

const TRANSFER = topic('Transfer(address,address,uint256)');
const ZERO = '0x0000000000000000000000000000000000000000';
const LAUNCHPADS = new Set([four.TOKEN_MANAGER2, four.HELPER3, flap.PORTAL].map(a => a.toLowerCase()));
const low = a => (a || '').toLowerCase();
const settle = p => Promise.resolve(p).then(v => v, () => null);   // kaynak hatası null olur, tarama durmaz
const PLATFORMS = { [four.PLATFORM]: four, [flap.PLATFORM]: flap };

/* iki platforma paralel sorulur; tanıyan döner. probe: four.meme curve'ünde sanal rezerv için bir alım kotası */
export async function readState(token, rpc, { platform = null, probe = true } = {}) {
  const ask = p => settle(rpc.call(...p.calls.state(token))).then(p.decodeState);
  const state = platform ? await ask(PLATFORMS[platform]) : (await Promise.all([ask(four), ask(flap)])).find(Boolean) || null;
  if (state?.platform === four.PLATFORM && !state.graduated && probe) {
    state.virtualReserveTokens = four.virtualReserve(state, await settle(rpc.call(...four.calls.tryBuy(token))));
  }
  return state;
}

export async function findCreation(token, state, { rpc, record, pairs }) {
  const known = record?.find(token);
  if (known) return known;
  if (state.platform !== four.PLATFORM) return null;
  const ts = (pairs || []).map(p => p.pairCreatedAt).filter(Boolean).reduce((a, b) => Math.min(a, b), Infinity);
  if (!isFinite(ts)) return null;
  const b = await rpc.blockAt(Math.floor(ts / 1000)), w = cfg.launchpad.createWindow;
  const logs = await rpc.logs(four.TOKEN_MANAGER2, [four.TOPIC.create], b - w, b + w);
  const c = logs.map(four.decodeCreate).find(x => low(x.token) === low(token));
  return c ? { ...c, ts: c.ts || ts } : null;
}

/* launch bloğunda token alan cüzdanlar (mint ve launchpad kontratları hariç) */
export async function readLaunchBlock(token, block, creator, rpc) {
  const buys = {};
  for (const l of await rpc.logs(token, [TRANSFER], block, block)) {
    const from = '0x' + l.topics[1].slice(26), to = '0x' + l.topics[2].slice(26);
    if (from === ZERO || LAUNCHPADS.has(to)) continue;
    buys[to] = (buys[to] || 0) + num(l.data, 0);
  }
  const tokens = Object.values(buys).reduce((a, b) => a + b, 0);
  return { slot0: { tokens, buyers: Object.keys(buys) }, devAtLaunch: creator ? buys[low(creator)] || 0 : null };
}

export async function fetchLaunch(token, { rpc = makeRpc(), record = null, pairs = [] } = {}) {
  const state = await readState(token, rpc);
  if (!state) return null;
  const c = await settle(findCreation(token, state, { rpc, record, pairs }));
  const launch = { ...state, creator: c?.creator || null, creatorIsContract: null, createdAt: c?.ts || null, block: c?.block || null, supply: state.supply ?? c?.supply ?? null, slot0: null, devAtLaunch: null };
  if (c?.creator) { const code = await settle(rpc.code(c.creator)); launch.creatorIsContract = code == null ? null : code !== '0x'; }
  if (c?.block) Object.assign(launch, await settle(readLaunchBlock(token, c.block, c.creator, rpc)) || {});
  return launch;
}

/* creator geçmişi kayıttan: lansman sayısı ve (son N'i okunarak) kaçının mezun olduğu. Kayıt kısmidir:
   seri lansmancıyı gösterebilir, temize çıkaramaz; Guard bunu local:true ile bilir. */
export async function creatorHistory(creator, { rpc = makeRpc(), record = null } = {}) {
  const mine = creator && record ? record.byCreator(creator) : [];
  if (!mine.length) return null;
  const recent = mine.slice(-cfg.launchpad.historyMaxReads);
  const states = await Promise.all(recent.map(x => settle(readState(x.token, rpc, { platform: x.platform, probe: false }))));
  return { launched: mine.length, graduated: states.filter(s => s?.graduated).length, read: states.filter(Boolean).length, since: record.since, local: true };
}
