/* GoPlus Token Security API: honeypot, vergiler, owner yetkileri, LP holder'ları, creator payı.
   Referans: https://docs.gopluslabs.io/reference/response-details. Anahtarsız çağrı çalışır, limitlidir;
   GOPLUS_TOKEN verilirse Bearer olarak gönderilir. Alanlar "1"/"0" string'dir, olmayan alan bilinmiyor demektir. */
import { getJson } from './http.js';

const BASE = 'https://api.gopluslabs.io/api/v1/token_security';
const BSC_CHAIN_ID = 56;

/* cevap zarfı: { code, message, result: { [adres küçük harf]: {...} } } → sadece token'ın kaydı */
export async function fetchTokenSecurity(address, token = process.env.GOPLUS_TOKEN) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const body = await getJson(`${BASE}/${BSC_CHAIN_ID}?contract_addresses=${address}`, { headers });
  const result = body?.result || {};
  const rec = result[address.toLowerCase()] || Object.values(result)[0];
  if (!rec) throw new Error(`GoPlus: no record (${body?.message || 'empty result'})`);
  return rec;
}
