import crypto from 'crypto';

const ALGO = 'aes-256-gcm';

function getKey() {
  const k = process.env.FIELD_ENCRYPTION_KEY;
  if (!k) throw new Error('FIELD_ENCRYPTION_KEY not set');
  const buf = Buffer.from(k, 'base64');
  if (buf.length !== 32) throw new Error('FIELD_ENCRYPTION_KEY must decode to 32 bytes (base64)');
  return buf;
}

// Returns { iv, authTag, ciphertext } (all base64) or undefined for empty input.
export function encryptField(plaintext) {
  if (plaintext == null || plaintext === '') return undefined;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const ct = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  return {
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
    ciphertext: ct.toString('base64'),
  };
}

// Throws if the ciphertext or tag has been tampered with (GCM auth).
export function decryptField(blob) {
  if (!blob || !blob.ciphertext) return undefined;
  const decipher = crypto.createDecipheriv(ALGO, getKey(), Buffer.from(blob.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(blob.authTag, 'base64'));
  const pt = Buffer.concat([
    decipher.update(Buffer.from(blob.ciphertext, 'base64')),
    decipher.final(),
  ]);
  return pt.toString('utf8');
}

// Generate a key for .env (run: node -e "import('./src/lib/encryption.js').then(m=>console.log(m.generateKey()))")
export function generateKey() {
  return crypto.randomBytes(32).toString('base64');
}
