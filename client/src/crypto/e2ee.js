/**
 * SAIRO Client-Side End-to-End Encryption (Web Crypto API)
 *
 * Security Model:
 * 1. The raw secret passcode NEVER leaves the browser.
 * 2. Room Lookup Identity (`roomHash`) and Authentication Proof (`authVerifier`)
 *    are derived via PBKDF2-SHA256 with a domain-separated lookup salt.
 * 3. Message Encryption Key (`AES-256-GCM`) is derived independently via
 *    PBKDF2-SHA256 using the room's random 128-bit `salt` + separate domain label.
 * 4. Every message is encrypted with a fresh random 96-bit IV (AES-256-GCM).
 *    Even the sender's ephemeral alias is encrypted inside the ciphertext!
 */

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const SOOTHING_ADJECTIVES = [
  'amber', 'cedar', 'misty', 'quiet', 'velvet', 'silver', 'still', 'soft',
  'lunar', 'mossy', 'gentle', 'dusk', 'calm', 'sage', 'hushed', 'pine',
  'river', 'cloud', 'meadow', 'drift', 'willow', 'pebble', 'dawn', 'fern',
];

const SOOTHING_NOUNS = [
  'lotus', 'harbor', 'grove', 'breeze', 'hollow', 'lantern', 'stream', 'cove',
  'feather', 'horizon', 'shore', 'canopy', 'glade', 'spark', 'tide', 'ridge',
  'echo', 'petal', 'valley', 'haven', 'aurora', 'ember', 'solace', 'zephyr',
];

const FINGERPRINT_GLYPHS = [
  '🌿', '🌙', '🌊', '🕊️', '🍃', '✨', '🪷', '☁️',
  '🪨', '🌬️', '🐚', '🌾', '🌌', '🕯️', '🦋', '🌲',
];

function bytesToHex(bytes) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function bytesToBase64(bytes) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function randomInt(max) {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] % max;
}

export function normalizePasscode(raw) {
  return String(raw || '').trim();
}

export function generateSecretPasscode() {
  const adj = SOOTHING_ADJECTIVES[randomInt(SOOTHING_ADJECTIVES.length)];
  const noun = SOOTHING_NOUNS[randomInt(SOOTHING_NOUNS.length)];
  const num = 1000 + randomInt(9000);
  return `${adj}-${noun}-${num}`;
}

export function generateSaltHex() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

export function evaluatePasscodeStrength(raw) {
  const code = normalizePasscode(raw);
  if (!code) return { score: 0, label: 'Enter a secret passcode', tone: 'muted' };
  let score = 0;
  if (code.length >= 6) score += 1;
  if (code.length >= 10) score += 1;
  if (code.length >= 14) score += 1;
  const variety =
    (/[a-z]/.test(code) ? 1 : 0) +
    (/[A-Z]/.test(code) ? 1 : 0) +
    (/[0-9]/.test(code) ? 1 : 0) +
    (/[^a-zA-Z0-9]/.test(code) ? 1 : 0);
  if (variety >= 2) score += 1;
  if (variety >= 3) score += 1;

  if (code.length < 4) return { score: 1, label: 'Too short (minimum 4 characters)', tone: 'warn' };
  if (score <= 2) return { score: 2, label: 'Basic — try adding a few more characters', tone: 'fair' };
  if (score === 3) return { score: 3, label: 'Good passcode', tone: 'good' };
  return { score: 4, label: 'Strong passcode', tone: 'strong' };
}

async function importPasscodeMaterial(passcode) {
  if (!globalThis.crypto?.subtle) {
    throw new Error(
      'Encryption requires a secure connection (HTTPS or localhost). Please open SAIRO over HTTPS.'
    );
  }
  return crypto.subtle.importKey(
    'raw',
    textEncoder.encode(passcode),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );
}

async function sha256Hex(input) {
  const digest = await crypto.subtle.digest('SHA-256', textEncoder.encode(input));
  return bytesToHex(new Uint8Array(digest));
}

/**
 * Derives the server-safe lookup hash (`roomHash`) and verification token (`authVerifier`)
 * without exposing the original passcode or the message encryption key.
 */
export async function deriveRoomIdentity(rawPasscode) {
  const passcode = normalizePasscode(rawPasscode);
  if (passcode.length < 4) {
    throw new Error('Secret passcode must be at least 4 characters long.');
  }

  const keyMaterial = await importPasscodeMaterial(passcode);
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: textEncoder.encode('SAIRO::ROOM_LOOKUP_DOMAIN::v1'),
      iterations: 120_000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );

  const roomHash = bytesToHex(new Uint8Array(derivedBits));
  const authVerifier = await sha256Hex(`SAIRO::AUTH_VERIFIER::v1::${roomHash}`);

  return { roomHash, authVerifier };
}

/**
 * Derives a non-extractable AES-256-GCM CryptoKey + human-verifiable Safety Fingerprint
 * from the secret passcode and the room's unique random salt.
 */
export async function deriveRoomEncryption(rawPasscode, saltHex) {
  const passcode = normalizePasscode(rawPasscode);
  const keyMaterial = await importPasscodeMaterial(passcode);

  const aesKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: textEncoder.encode(`SAIRO::AES256GCM_KEY::v1::${saltHex}`),
      iterations: 180_000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false, // Non-extractable key stays locked in Web Crypto engine
    ['encrypt', 'decrypt']
  );

  // Separate domain-separated derivation for visual safety fingerprint
  const fpBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: textEncoder.encode(`SAIRO::SAFETY_FINGERPRINT::v1::${saltHex}`),
      iterations: 60_000,
      hash: 'SHA-256',
    },
    keyMaterial,
    128
  );

  const fpBytes = new Uint8Array(fpBits);
  const glyphs = [
    FINGERPRINT_GLYPHS[fpBytes[0] % FINGERPRINT_GLYPHS.length],
    FINGERPRINT_GLYPHS[fpBytes[1] % FINGERPRINT_GLYPHS.length],
    FINGERPRINT_GLYPHS[fpBytes[2] % FINGERPRINT_GLYPHS.length],
    FINGERPRINT_GLYPHS[fpBytes[3] % FINGERPRINT_GLYPHS.length],
  ];
  const hexCode = `${bytesToHex(fpBytes.subarray(4, 6)).toUpperCase()} · ${bytesToHex(
    fpBytes.subarray(6, 8)
  ).toUpperCase()}`;

  return {
    aesKey,
    fingerprint: {
      glyphs,
      hexCode,
    },
  };
}

/**
 * Encrypts a JSON message payload with AES-256-GCM and a fresh 96-bit IV.
 */
export async function encryptMessagePayload(aesKey, payload) {
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);

  const plaintextBytes = textEncoder.encode(JSON.stringify(payload));
  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    plaintextBytes
  );

  return {
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(encryptedBuffer)),
  };
}

/**
 * Decrypts a received AES-256-GCM payload back into its structured message object.
 */
export async function decryptMessagePayload(aesKey, ivBase64, ciphertextBase64) {
  const iv = base64ToBytes(ivBase64);
  const ciphertext = base64ToBytes(ciphertextBase64);

  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    ciphertext
  );

  const json = textDecoder.decode(decryptedBuffer);
  return JSON.parse(json);
}
