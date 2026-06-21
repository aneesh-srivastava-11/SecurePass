import { vi, describe, it, expect, beforeAll } from 'vitest';
import { 
  generateKeypair, 
  importBackupKey, 
  hasKeypair, 
  clearKeypair, 
  exportPublicKey, 
  encryptSecret, 
  decryptSecret, 
  reEncryptForShare 
} from './crypto';

// Mock IndexedDB ('idb') to execute key operations in Node.js environment
vi.mock('idb', () => {
  const store = new Map();
  return {
    openDB: vi.fn().mockResolvedValue({
      put: vi.fn().mockImplementation((storeName, value, key) => {
        store.set(key, value);
        return Promise.resolve();
      }),
      get: vi.fn().mockImplementation((storeName, key) => {
        return Promise.resolve(store.get(key));
      }),
      delete: vi.fn().mockImplementation((storeName, key) => {
        store.delete(key);
        return Promise.resolve();
      }),
    }),
  };
});

describe('Zero-Knowledge ECIES Cryptography Suite', () => {
  const passphrase = 'correct passphrase 123!';
  const secretPlaintext = 'stripe_sk_live_abc123';

  beforeAll(async () => {
    await clearKeypair();
  });

  it('should initially have no keypair stored', async () => {
    const exists = await hasKeypair();
    expect(exists).toBe(false);
  });

  it('should generate a valid keypair and backup structure', async () => {
    const { publicKeyBase64, backup } = await generateKeypair(passphrase);
    
    expect(publicKeyBase64).toBeTypeOf('string');
    expect(backup).toHaveProperty('publicKey');
    expect(backup).toHaveProperty('salt');
    expect(backup).toHaveProperty('iv');
    expect(backup).toHaveProperty('ciphertext');
    expect(await hasKeypair()).toBe(true);
  });

  it('should encrypt and decrypt a secret locally', async () => {
    const myPubKey = await exportPublicKey();
    const encrypted = await encryptSecret(secretPlaintext, myPubKey);

    expect(encrypted).toHaveProperty('ephemeralPublicKey');
    expect(encrypted).toHaveProperty('iv');
    expect(encrypted).toHaveProperty('ciphertext');

    const decrypted = await decryptSecret(encrypted);
    expect(decrypted).toBe(secretPlaintext);
  });

  it('should restore keys from a backup and decrypt successfully', async () => {
    const { backup } = await generateKeypair(passphrase);
    
    // Clear current keys
    await clearKeypair();
    expect(await hasKeypair()).toBe(false);

    // Restore keys from backup
    const { publicKeyBase64 } = await importBackupKey(backup, passphrase);
    expect(await hasKeypair()).toBe(true);

    // Encrypt with restored key
    const encrypted = await encryptSecret(secretPlaintext, publicKeyBase64);
    const decrypted = await decryptSecret(encrypted);
    expect(decrypted).toBe(secretPlaintext);
  });

  it('should fail to restore key with incorrect passphrase', async () => {
    const { backup } = await generateKeypair(passphrase);
    await clearKeypair();

    await expect(
      importBackupKey(backup, 'wrong passphrase')
    ).rejects.toThrow('Incorrect passphrase or corrupted backup.');
  });

  it('should re-encrypt a secret for sharing with a recipient', async () => {
    // 1. Setup Alice keys
    const aliceKeys = await generateKeypair(passphrase);
    const alicePubKey = aliceKeys.publicKeyBase64;

    // 2. Setup Bob keys (mocked database simulation)
    const bobKeys = await generateKeypair('bob passphrase');
    const bobPubKey = bobKeys.publicKeyBase64;
    const bobBackup = bobKeys.backup;

    // Restore Alice keys back to client session
    await importBackupKey(aliceKeys.backup, passphrase);

    // 3. Alice encrypts secret for herself
    const encryptedForAlice = await encryptSecret(secretPlaintext, alicePubKey);

    // 4. Alice re-encrypts the secret ECIES payload for Bob
    const encryptedForBob = await reEncryptForShare(encryptedForAlice, bobPubKey);

    // 5. Restore Bob keys to simulate Bob's client session decrypting the secret
    await importBackupKey(bobBackup, 'bob passphrase');
    const decryptedByBob = await decryptSecret(encryptedForBob);

    expect(decryptedByBob).toBe(secretPlaintext);
  });
});
