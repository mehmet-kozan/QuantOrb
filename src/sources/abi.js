/* Bağımlılıksız ABI yardımcıları: keccak256 (Ethereum), fonksiyon seçicisi, olay konusu ve statik tiplerin
   kodlanıp çözülmesi. Seçiciler ve konular burada imzadan hesaplanır; depoda elle yazılmış hash yoktur. */
const RC = ['0x1', '0x8082', '0x800000000000808a', '0x8000000080008000', '0x808b', '0x80000001', '0x8000000080008081', '0x8000000000008009', '0x8a', '0x88', '0x80008009', '0x8000000a', '0x8000808b', '0x800000000000008b', '0x8000000000008089', '0x8000000000008003', '0x8000000000008002', '0x8000000000000080', '0x800a', '0x800000008000000a', '0x8000000080008081', '0x8000000000008080', '0x80000001', '0x8000000080008008'].map(BigInt);
const ROT = [[0, 36, 3, 41, 18], [1, 44, 10, 45, 2], [62, 6, 43, 15, 61], [28, 55, 25, 21, 56], [27, 20, 39, 8, 14]];
const M = (1n << 64n) - 1n;
const rotl = (x, n) => n ? ((x << BigInt(n)) | (x >> BigInt(64 - n))) & M : x;

/* Keccak-f[1600]: 5×5 şerit, 24 tur */
function permute(s) {
  for (let r = 0; r < 24; r++) {
    const c = [0, 1, 2, 3, 4].map(x => s[x] ^ s[x + 5] ^ s[x + 10] ^ s[x + 15] ^ s[x + 20]);
    for (let x = 0; x < 5; x++) { const d = c[(x + 4) % 5] ^ rotl(c[(x + 1) % 5], 1); for (let y = 0; y < 25; y += 5) s[x + y] ^= d; }
    const b = new Array(25);
    for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) b[y + 5 * ((2 * x + 3 * y) % 5)] = rotl(s[x + 5 * y], ROT[x][y]);
    for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) s[x + 5 * y] = b[x + 5 * y] ^ (~b[(x + 1) % 5 + 5 * y] & M & b[(x + 2) % 5 + 5 * y]);
    s[0] ^= RC[r];
  }
}

/* metin (utf8) ya da bayt dizisi → '0x…' 32 bayt */
export function keccak256(input) {
  const bytes = typeof input === 'string' ? Buffer.from(input, 'utf8') : Buffer.from(input);
  const rate = 136, padded = Buffer.alloc(Math.ceil((bytes.length + 1) / rate) * rate);
  bytes.copy(padded); padded[bytes.length] ^= 0x01; padded[padded.length - 1] ^= 0x80;
  const s = new Array(25).fill(0n);
  for (let off = 0; off < padded.length; off += rate) {
    for (let i = 0; i < 17; i++) s[i] ^= padded.readBigUInt64LE(off + 8 * i);
    permute(s);
  }
  const out = Buffer.alloc(32);
  for (let i = 0; i < 4; i++) out.writeBigUInt64LE(s[i], 8 * i);
  return '0x' + out.toString('hex');
}

export const topic = sig => keccak256(sig);                 // olay konusu (topics[0])
export const selector = sig => keccak256(sig).slice(0, 10); // fonksiyon seçicisi (4 bayt)
/* adres, bigint ya da hex → 32 baytlık sözcük */
export const pad = v => (typeof v === 'bigint' ? v.toString(16) : String(v).replace(/^0x/, '')).padStart(64, '0');
export const encodeCall = (sig, ...args) => selector(sig) + args.map(pad).join('');

/* çözme: i. sözcük */
export const word = (hex, i) => hex.slice(2 + 64 * i, 66 + 64 * i);
export const uint = (hex, i) => BigInt('0x' + word(hex, i));
export const addr = (hex, i) => '0x' + word(hex, i).slice(24);
export const num = (hex, i, decimals = 18) => Number(uint(hex, i)) / 10 ** decimals;   // ondalık düşülmüş sayı
export function str(hex, i) {
  const off = Number(uint(hex, i)) / 32, len = Number(uint(hex, off));   // dinamik tip: ofset → uzunluk → baytlar
  return Buffer.from(hex.slice(66 + 64 * off, 66 + 64 * off + len * 2), 'hex').toString('utf8');
}
