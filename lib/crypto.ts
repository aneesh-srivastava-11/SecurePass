import { openDB } from 'idb';

const DB_NAME = 'securepass-vault';
const STORE = 'keys';

async function getDB() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      db.createObjectStore(STORE);
    },
  });
}

function getStorageKey(baseKey: 'privateKey' | 'publicKey'): string {
  if (typeof window !== 'undefined') {
    const email = localStorage.getItem('activeUserEmail');
    if (email) {
      return `${email.trim().toLowerCase()}:${baseKey}`;
    }
  }
  return baseKey;
}

export interface ECIESPayload {
  ephemeralPublicKey: string; // base64 SPKI
  iv: string;                 // base64 12-byte IV
  ciphertext: string;         // base64 AES-GCM ciphertext
}

export interface EncryptedBackup {
  publicKey: string;          // base64 SPKI
  salt: string;               // base64 salt
  iv: string;                 // base64 12-byte IV
  ciphertext: string;         // base64 AES-GCM ciphertext
}

// Helper to convert ArrayBuffer or Uint8Array to Base64
function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Helper to convert Base64 to ArrayBuffer
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// Derive a symmetric key from a passphrase using PBKDF2
async function derivePassphraseKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource, // Cast to BufferSource for TypeScript compiler compliance
      iterations: 100000,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// Generate new P-256 keypair and store non-extractable private key
export async function generateKeypair(passphrase: string): Promise<{ publicKeyBase64: string; backup: EncryptedBackup }> {
  // 1. Generate keypair as extractable temporarily so we can create a backup
  const keyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true, // extractable: true
    ['deriveKey', 'deriveBits']
  );

  // 2. Export private key as PKCS#8 format
  const privateKeyPkcs8 = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);

  // 3. Encrypt private key with passphrase for backup
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const aesKey = await derivePassphraseKey(passphrase, salt);
  const encryptedPrivKey = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    privateKeyPkcs8
  );

  // 4. Export public key as base64 SPKI
  const spki = await crypto.subtle.exportKey('spki', keyPair.publicKey);
  const publicKeyBase64 = arrayBufferToBase64(spki);

  const backup: EncryptedBackup = {
    publicKey: publicKeyBase64,
    salt: arrayBufferToBase64(salt),
    iv: arrayBufferToBase64(iv),
    ciphertext: arrayBufferToBase64(encryptedPrivKey),
  };

  // 5. Import the private key back as NON-EXTRACTABLE into IndexedDB
  const nonExtractablePrivateKey = await crypto.subtle.importKey(
    'pkcs8',
    privateKeyPkcs8,
    { name: 'ECDH', namedCurve: 'P-256' },
    false, // extractable: false
    ['deriveKey', 'deriveBits']
  );

  const db = await getDB();
  const privKeyName = getStorageKey('privateKey');
  const pubKeyName = getStorageKey('publicKey');
  await db.put(STORE, nonExtractablePrivateKey, privKeyName);
  await db.put(STORE, keyPair.publicKey, pubKeyName);

  return {
    publicKeyBase64,
    backup,
  };
}

// Restore keypair from backup using passphrase
export async function importBackupKey(backup: EncryptedBackup, passphrase: string): Promise<{ publicKeyBase64: string }> {
  const salt = new Uint8Array(base64ToArrayBuffer(backup.salt));
  const iv = new Uint8Array(base64ToArrayBuffer(backup.iv));
  const ciphertext = base64ToArrayBuffer(backup.ciphertext);

  // 1. Derive key from passphrase
  const aesKey = await derivePassphraseKey(passphrase, salt);

  // 2. Decrypt PKCS#8 private key bytes
  let privateKeyPkcs8: ArrayBuffer;
  try {
    privateKeyPkcs8 = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      aesKey,
      ciphertext
    );
  } catch (e) {
    throw new Error('Incorrect passphrase or corrupted backup.');
  }

  // 3. Import private key as NON-EXTRACTABLE
  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    privateKeyPkcs8,
    { name: 'ECDH', namedCurve: 'P-256' },
    false, // extractable: false
    ['deriveKey', 'deriveBits']
  );

  // 4. Import public key from backup
  const publicKey = await importPublicKey(backup.publicKey);

  const db = await getDB();
  const privKeyName = getStorageKey('privateKey');
  const pubKeyName = getStorageKey('publicKey');
  await db.put(STORE, privateKey, privKeyName);
  await db.put(STORE, publicKey, pubKeyName);

  return {
    publicKeyBase64: backup.publicKey,
  };
}

// Check if keypair exists in IndexedDB
export async function hasKeypair(): Promise<boolean> {
  const db = await getDB();
  const privKeyName = getStorageKey('privateKey');
  const pubKeyName = getStorageKey('publicKey');
  const pk = await db.get(STORE, privKeyName);
  const pub = await db.get(STORE, pubKeyName);
  return !!(pk && pub);
}

// Clear keypair from IndexedDB
export async function clearKeypair(): Promise<void> {
  const db = await getDB();
  const privKeyName = getStorageKey('privateKey');
  const pubKeyName = getStorageKey('publicKey');
  await db.delete(STORE, privKeyName);
  await db.delete(STORE, pubKeyName);
}

export async function getPrivateKey(): Promise<CryptoKey> {
  const db = await getDB();
  const privKeyName = getStorageKey('privateKey');
  const key = await db.get(STORE, privKeyName);
  if (!key) throw new Error('No private key found in this browser.');
  return key;
}

export async function exportPublicKey(): Promise<string> {
  const db = await getDB();
  const pubKeyName = getStorageKey('publicKey');
  const pubKey = await db.get(STORE, pubKeyName) as CryptoKey;
  if (!pubKey) throw new Error('No public key found in this browser.');
  const spki = await crypto.subtle.exportKey('spki', pubKey);
  return arrayBufferToBase64(spki);
}

export async function importPublicKey(base64Spki: string): Promise<CryptoKey> {
  const spki = base64ToArrayBuffer(base64Spki);
  return crypto.subtle.importKey(
    'spki',
    spki,
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    []
  );
}

// ECIES Encrypt
export async function encryptSecret(plaintext: string, recipientPublicKeyBase64: string): Promise<ECIESPayload> {
  // 1. Import recipient's public key
  const recipientPK = await importPublicKey(recipientPublicKeyBase64);

  // 2. Generate ephemeral keypair (for this encryption only)
  const ephemeral = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true, // ephemeral must be extractable to perform ECDH
    ['deriveKey', 'deriveBits']
  );

  // 3. ECDH: derive shared secret raw bits
  const sharedSecret = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: recipientPK },
    ephemeral.privateKey,
    256
  );

  // 4. Import shared secret as key for HKDF
  const hkdfKey = await crypto.subtle.importKey(
    'raw',
    sharedSecret,
    'HKDF',
    false,
    ['deriveKey']
  );

  // 5. Derive AES-GCM-256 key from HKDF
  const aesKey = await crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(),
      info: new TextEncoder().encode('SecurePass ECIES Key'),
    },
    hkdfKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  // 6. Encrypt plaintext
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    new TextEncoder().encode(plaintext)
  );

  // 7. Export ephemeral public key SPKI
  const ephemeralSpki = await crypto.subtle.exportKey('spki', ephemeral.publicKey);

  return {
    ephemeralPublicKey: arrayBufferToBase64(ephemeralSpki),
    iv: arrayBufferToBase64(iv),
    ciphertext: arrayBufferToBase64(ciphertext),
  };
}

// ECIES Decrypt
export async function decryptSecret(payload: ECIESPayload): Promise<string> {
  // 1. Get non-extractable private key
  const privateKey = await getPrivateKey();

  // 2. Import ephemeral public key
  const ephemeralPK = await importPublicKey(payload.ephemeralPublicKey);

  // 3. ECDH: derive shared secret raw bits
  const sharedSecret = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: ephemeralPK },
    privateKey,
    256
  );

  // 4. Import shared secret as key for HKDF
  const hkdfKey = await crypto.subtle.importKey(
    'raw',
    sharedSecret,
    'HKDF',
    false,
    ['deriveKey']
  );

  // 5. Derive AES-GCM-256 key from HKDF
  const aesKey = await crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(),
      info: new TextEncoder().encode('SecurePass ECIES Key'),
    },
    hkdfKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  // 6. Decrypt ciphertext
  const iv = new Uint8Array(base64ToArrayBuffer(payload.iv));
  const ciphertext = base64ToArrayBuffer(payload.ciphertext);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    ciphertext
  );

  return new TextDecoder().decode(decrypted);
}

// Re-encrypt for sharing (decrypt then re-encrypt with recipient's public key)
export async function reEncryptForShare(payload: ECIESPayload, recipientPublicKeyBase64: string): Promise<ECIESPayload> {
  const plaintext = await decryptSecret(payload);
  return encryptSecret(plaintext, recipientPublicKeyBase64);
}
