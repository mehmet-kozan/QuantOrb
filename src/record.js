/* Lansman kaydı: iki launchpad'in create olaylarından { platform, token, creator, block, ts, tx } satırları,
   tek bir JSON dosyasında. Bir taramada creator'ı ve yaratılış zamanını, creator geçmişini buradan okuruz.
   `node src/cli.js index` kaydı doldurur; public RPC yaklaşık son iki günü verir, eskisi için arşiv RPC gerekir.
   Radar yazıldığında kaydı canlı besleyecek olan da budur. */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import cfg from './config/rules.js';
import * as four from './sources/fourmeme.js';
import * as flap from './sources/flap.js';

const low = a => (a || '').toLowerCase();

export function openRecord(file = cfg.launchpad.recordFile) {
  let data = { from: null, to: null, launches: [] };
  try { data = JSON.parse(readFileSync(file, 'utf8')); } catch { /* dosya yoksa boş kayıt */ }
  const byToken = new Map(data.launches.map(x => [low(x.token), x]));
  return {
    data, file,
    get size() { return data.launches.length; },
    get since() { return data.launches.length ? Math.min(...data.launches.map(x => x.ts)) : null; },   // kaydın başı
    find: token => byToken.get(low(token)) || null,
    byCreator: creator => data.launches.filter(x => low(x.creator) === low(creator)),
    add(x) { if (!byToken.has(low(x.token))) { byToken.set(low(x.token), x); data.launches.push(x); } },
    save() { mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, JSON.stringify(data)); }
  };
}

/* [from, to] blok aralığını parça parça tarar; four.meme'nin TokenCreate'i zaman taşımaz, blok başlığından alınır */
export async function indexLaunches(record, rpc, from, to, onChunk = () => {}) {
  for (let a = from; a <= to; a += cfg.launchpad.logChunk) {
    const b = Math.min(a + cfg.launchpad.logChunk - 1, to);
    const [f, l] = await Promise.all([rpc.logs(four.TOKEN_MANAGER2, [four.TOPIC.create], a, b), rpc.logs(flap.PORTAL, [flap.TOPIC.create], a, b)]);
    const items = [...f.map(four.decodeCreate), ...l.map(flap.decodeCreate)], times = new Map();
    for (const x of items) {
      if (!x.ts) { if (!times.has(x.block)) times.set(x.block, parseInt((await rpc.block(x.block)).timestamp) * 1000); x.ts = times.get(x.block); }
      record.add({ platform: x.platform, token: x.token, creator: x.creator, block: x.block, ts: x.ts, tx: x.tx });
    }
    onChunk(b, items.length);
  }
  record.data.from = Math.min(record.data.from ?? from, from);
  record.data.to = Math.max(record.data.to ?? to, to);
  record.save();
}
