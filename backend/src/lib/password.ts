// Password hashing with WebCrypto PBKDF2 — native to Workers, zero deps.
// Stored format is one self-describing string: "pbkdf2$<iterations>$<saltB64>$<hashB64>".
// The iteration count lives in the string, so the cost can be raised later (and old
// hashes re-hashed on next login) with no migration.

const ITERATIONS = 100_000
const SALT_BYTES = 16 // 128-bit salt
const HASH_BITS = 256

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function deriveBits(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, key, HASH_BITS)
  return new Uint8Array(bits)
}

// Constant-time comparison: always inspects every byte so timing can't leak how much matched.
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  const hash = await deriveBits(password, salt, ITERATIONS)
  return `pbkdf2$${ITERATIONS}$${bytesToBase64(salt)}$${bytesToBase64(hash)}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$')
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false
  const iterations = Number(parts[1])
  if (!Number.isInteger(iterations) || iterations <= 0) return false
  const salt = base64ToBytes(parts[2])
  const expected = base64ToBytes(parts[3])
  const actual = await deriveBits(password, salt, iterations)
  return timingSafeEqual(actual, expected)
}
