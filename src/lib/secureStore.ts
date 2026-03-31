const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder();

const PBKDF2_ITERATIONS = 120000;
const KEY_LENGTH = 256;

export interface EncryptedPayload {
  v: 1;
  salt: string;
  iv: string;
  cipher: string;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function deriveKey(secret: string, salt: Uint8Array): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    "raw",
    TEXT_ENCODER.encode(secret),
    { name: "PBKDF2" },
    false,
    ["deriveKey"],
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt,
      iterations: PBKDF2_ITERATIONS,
    },
    material,
    { name: "AES-GCM", length: KEY_LENGTH },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptJson<T>(secret: string, value: T): Promise<EncryptedPayload> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(secret, salt);

  const plain = TEXT_ENCODER.encode(JSON.stringify(value));
  const cipherBuffer = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plain);

  return {
    v: 1,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    cipher: bytesToBase64(new Uint8Array(cipherBuffer)),
  };
}

export async function decryptJson<T>(secret: string, payload: EncryptedPayload): Promise<T> {
  const salt = base64ToBytes(payload.salt);
  const iv = base64ToBytes(payload.iv);
  const cipher = base64ToBytes(payload.cipher);

  const key = await deriveKey(secret, salt);
  const plainBuffer = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipher);
  const plainText = TEXT_DECODER.decode(plainBuffer);
  return JSON.parse(plainText) as T;
}
