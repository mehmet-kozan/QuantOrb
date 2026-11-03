/* Tek bir JSON GET yardımcısı. Node 18+ global fetch; bağımlılık yok. */
export async function getJson(url, { headers = {}, timeoutMs = 15000 } = {}) {
  const res = await fetch(url, { headers: { accept: 'application/json', ...headers }, signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.json();
}
