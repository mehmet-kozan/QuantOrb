/* Kaynak cevaplarını skor motorunun girdisine (ScanInput) çevirir.
     Bubblemaps map   → holder'lar, float, havuz rezervi, cluster linkleri, transferle alanlar, fresh cüzdanlar
     GoPlus           → kontrat kartı, dev cüzdanı, dev payı, likidite yedeği, toplam arz
     DexScreener      → likidite, market cap, FDV, token yaşı (fresh ölçümü için yaratılış zamanı)
   Okunamayan her şey null kalır ya da "unmeasured" listesine girer; null hiçbir kuralda kanıt değildir.
   Eşleme kararları ve varsayımlar: docs/kaynaklar.md */
import cfg from './config/rules.js';
import { sum } from './rules/format.js';

const BURN = new Set(['0x0000000000000000000000000000000000000000', '0x000000000000000000000000000000000000dead']);
const low = a => (a || '').toLowerCase();
const flag = v => v === '1' ? true : v === '0' ? false : null;   // GoPlus "1" / "0" / yok
const num = v => (v === '' || v == null || isNaN(+v)) ? null : +v;
/* Bubblemaps pay birimi spec'te yazmıyor: 1'den büyük bir değer görülürse yüzde kabul edilir */
const unit = values => values.some(v => v > 1) ? 100 : 1;

/* curve, havuz, borsa, kontrat ve burn adresleri holder değildir */
const isExcluded = h => { const d = h.address_details || {}; return BURN.has(low(h.address)) || !!(d.is_contract || d.is_dex || d.is_cex); };

export function toScanInput({ address, map, security: sec, pairs, now = Date.now() }) {
  const all = map?.nodes?.top_holders || [];
  const u = unit(all.map(h => h.holder_data.share));
  const shareOf = h => h.holder_data.share / u;
  const excludedShare = sum(all.filter(isExcluded), shareOf);
  const floatShare = Math.max(1e-9, 1 - excludedShare);
  const top = all.filter(h => !isExcluded(h)).slice(0, cfg.scan.topN);
  const index = new Map(top.map((h, i) => [low(h.address), i]));
  const unmeasured = new Set(['sniper']);   // giriş zamanı bu kaynaklarda yok

  /* token yaratılış zamanı: en eski pair; bilinmiyorsa fresh ölçülemez */
  const createdAt = (pairs || []).map(p => p.pairCreatedAt).filter(Boolean).reduce((a, b) => Math.min(a, b), Infinity);
  if (!isFinite(createdAt)) unmeasured.add('virgin');

  /* transferler: sıradan bir cüzdandan (top holder ya da magic node) gelen token "received, not bought";
     iki top holder arasındaysa kanıtlı link. Borsa, havuz ve time node (altyapı üzerinden) transferleri alımdır. */
  const details = new Map([...all, ...(map?.nodes?.magic_nodes || [])].map(n => [low(n.address), n.address_details || {}]));
  const infra = new Set((map?.nodes?.time_nodes || []).map(t => low(t.address)));
  const received = new Set(), links = [];
  (map?.relationships || []).forEach(r => {
    const from = low(r.from_address), to = low(r.to_address);
    const d = details.get(from);
    if (!index.has(to) || infra.has(from) || !d || d.is_contract || d.is_dex || d.is_cex || BURN.has(from)) return;
    received.add(to);
    if (index.has(from)) links.push({ a: index.get(from), b: index.get(to), kind: 'direct', level: 'proven' });
  });

  /* cluster: Bubblemaps'in bağlı saydığı cüzdanlar tek operatör. holders alanı adres ya da sıra olabilir. */
  (map?.clusters || []).forEach(c => {
    const members = (c.holders || []).map(x => index.has(low(x)) ? index.get(low(x)) : /^\d+$/.test(String(x)) ? index.get(low(all[+x]?.address)) : undefined).filter(i => i != null);
    members.slice(1).forEach((b, k) => links.push({ a: members[k], b, kind: 'cluster', level: 'proven' }));
  });

  const dev = low(sec?.creator_address);
  const holders = top.map(h => {
    const first = h.address_details?.first_activity_date ? Date.parse(h.address_details.first_activity_date) : null;
    const virginKnown = isFinite(createdAt) && first != null;
    return {
      address: h.address, share: shareOf(h) / floatShare,
      kind: received.has(low(h.address)) ? 'transfer' : 'buy',
      virgin: virginKnown ? first >= createdAt - cfg.sources.freshToleranceMs : false,
      unread: isFinite(createdAt) && first == null,   // yaratılış biliniyor ama cüzdanın ilk aktivitesi okunamadı
      dev: !!dev && low(h.address) === dev
    };
  });

  /* havuz rezervi: GoPlus'ın bildiği pair, yoksa en büyük DEX, yoksa en büyük kontrat (bonding curve) */
  const pairs$ = new Set((sec?.dex || []).map(d => low(d.pair)));
  const pool = all.find(h => pairs$.has(low(h.address))) || all.find(h => h.address_details?.is_dex) || all.find(h => h.address_details?.is_contract && !BURN.has(low(h.address)));
  if (!pool) unmeasured.add('operator');
  const supply = num(sec?.total_supply) ?? (all[0] ? all[0].holder_data.amount / shareOf(all[0]) : null);

  const best = (pairs || []).reduce((a, p) => (p.liquidity?.usd || 0) > (a?.liquidity?.usd || 0) ? p : a, null);
  const liquidityUsd = best?.liquidity?.usd ?? (sec?.dex?.length ? Math.max(...sec.dex.map(d => num(d.liquidity) || 0)) : null);
  const stats = map?.metrics?.supply_stats || null;
  const su = stats ? unit([stats.bundles, stats.fresh_wallets, stats.dexs]) : 1;

  return {
    address, stage: best?.dexId || 'curve',
    holders, links,
    floatTokens: supply != null ? supply * floatShare : null,
    reserveTokens: pool ? pool.holder_data.amount : null,
    liquidityUsd,
    market: { ageDays: isFinite(createdAt) ? (now - createdAt) / 864e5 : null, liquidityUsd, mcap: best?.marketCap ?? null, fdv: best?.fdv ?? null },
    unmeasured: [...unmeasured],
    /* Guard: creator geçmişi bu kaynaklarda yok (four.meme olayları gerekir); launch bloğu Bubblemaps'in bundle payı */
    creator: null,
    slot0Share: stats ? stats.bundles / su : null,
    devShare: num(sec?.creator_percent),
    traded: !!best || flag(sec?.is_in_dex) === true,
    contract: sec ? contractCard(sec) : null,
    bubblemaps: stats ? { freshWallets: stats.fresh_wallets / su, bundles: stats.bundles / su, top10Adjusted: stats.top_10_adjusted / su, score: map.metrics.scores?.bubblemaps_score ?? null } : null
  };
}

/* GoPlus kaydından kontrat kartı; her alan true / false / null (bilinmiyor) */
export function contractCard(sec) {
  const lp = sec.lp_holders || [];
  return {
    honeypot: flag(sec.is_honeypot), cannotBuy: flag(sec.cannot_buy), cannotSellAll: flag(sec.cannot_sell_all),
    buyTax: num(sec.buy_tax), sellTax: num(sec.sell_tax), transferTax: num(sec.transfer_tax),
    openSource: flag(sec.is_open_source), proxy: flag(sec.is_proxy), mintable: flag(sec.is_mintable),
    ownerAddress: sec.owner_address || null, hiddenOwner: flag(sec.hidden_owner), takeBackOwnership: flag(sec.can_take_back_ownership),
    ownerChangeBalance: flag(sec.owner_change_balance), pausable: flag(sec.transfer_pausable), blacklist: flag(sec.is_blacklisted),
    tradingCooldown: flag(sec.trading_cooldown), airdropScam: flag(sec.is_airdrop_scam), selfdestruct: flag(sec.selfdestruct),
    creatorAddress: sec.creator_address || null, holderCount: num(sec.holder_count),
    lpLockedShare: lp.length ? sum(lp.filter(h => h.is_locked === 1 || h.is_locked === '1'), h => num(h.percent) || 0) : null,
    lpBurnedShare: lp.length ? sum(lp.filter(h => BURN.has(low(h.address))), h => num(h.percent) || 0) : null
  };
}
