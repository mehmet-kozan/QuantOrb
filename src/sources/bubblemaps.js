/* Bubblemaps Data API: holder'lar, cluster'lar ve cüzdanlar arası transferler tek çağrıda.
   Şema: https://docs.bubblemaps.io/openapi.json (MapDataV0). API anahtarı X-ApiKey başlığıyla gider. */
import cfg from '../config/rules.js';
import { getJson } from './http.js';

const BASE = 'https://api.bubblemaps.io/v0';

/* map endpoint'i: nodes (top_holders, magic_nodes, time_nodes), relationships, clusters, metrics */
export async function fetchMap(address, apiKey, chain = 'bsc') {
  if (!apiKey) throw new Error('BUBBLEMAPS_API_KEY is not set');
  const q = new URLSearchParams({ limit: String(cfg.sources.bubblemapsLimit), return_nodes: 'true', return_relationships: 'true', return_clusters: 'true' });
  return getJson(`${BASE}/tokens/map/${chain}/${address}?${q}`, { headers: { 'X-ApiKey': apiKey } });
}
