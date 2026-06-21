# SecurePass 🔐 — Zero-Knowledge Team Secret Vault

SecurePass is a **zero-knowledge, decentralized secret manager** for development teams to share credentials (API keys, database passwords, private keys) without any server-side visibility. Secrets are encrypted locally in the browser using the Web Crypto API before leaving the device. The server only sees and stores ciphertext.

---

## 🚀 Key Features (Demo Moments)

1. **Client-Side ECIES Encryption**: Generates P-256 ECDH keys natively in your browser. Raw private key bytes are stored as **non-extractable** in IndexedDB, preventing extraction via malicious JS scripts.
2. **Secure Team Sharing**: Secrets are re-encrypted client-side for recipients. Decrypting a shared secret only requires the recipient's private key.
3. **Immutable Audit Trail**: Key events (secret creation, share, revocation) are cryptographically signed by the server using an Ed25519 private key. Users can verify these signatures client-side using the server's public key.
4. **Instant Revocation**: Real-time revocation sync via Supabase Realtime. When access is revoked, recipient clients clear their local cache and deny access within 1 second.
5. **Decentralized Backup**: Generates passphrase-encrypted JSON backups of cryptographic keys on signup, allowing vault recovery on new browsers.

---

## 🛡️ Zero-Knowledge Crypto Architecture

SecurePass implements **Elliptic Curve Integrated Encryption Scheme (ECIES)** client-side:

```
[Plaintext Secret]
       │
       ▼
1. Generate ephemeral ECDH P-256 keypair
       │
       ▼
2. Ephemeral Private Key + Recipient Public Key ──► ECDH derivation ──► Raw Shared Secret
                                                                           │
                                                                           ▼
                                                                     HKDF-SHA256
                                                                           │
                                                                           ▼
                                                                     AES-GCM-256 Key
                                                                           │
                                                                           ▼
3. Encrypt Plaintext with AES-GCM-256 Key ───────────────────────────► [Ciphertext]

Resulting payload sent to DB:
{
  "ephemeralPublicKey": "base64 SPKI key",
  "iv": "base64 12-byte IV",
  "ciphertext": "base64 encrypted value"
}
```

### Opaque IndexedDB Private Keys (SubtleCrypto)
When keys are generated, `privateKey.extractable` is set to `false`. Browser engines enforce that the private key bytes cannot be read by any JavaScript thread:
```javascript
// Web Crypto API blocks this call (throws DOMException)
const rawKey = await crypto.subtle.exportKey('pkcs8', privateKey); 
```
This guarantees that keys are sandboxed at the browser level.

---

## 🗄️ Database Schema (Supabase PostgreSQL)

- **`users`**: Extends Supabase auth, holds base64 public keys.
- **`secrets`**: Stores owners' secrets. The `encrypted_blob` column is a JSONB payload containing the owner's ECIES ciphertext.
- **`shares`**: Maps secret IDs to recipients. Contains `encrypted_key` which is the secret re-encrypted using the recipient's public key.
- **`audit_log`**: Append-only log of mutations signed by the server's private key.
- **`pending_invites`**: Records email shares for users who haven't registered yet.

---

## ⚙️ Local Setup Instructions

### Prerequisites
- Node.js (v18+)
- A fresh [Supabase](https://supabase.com) project

### 1. Database Migrations
Run the SQL script located in [supabase/migrations/001_schema.sql](file:///e:/hackathons/SecurePass/supabase/migrations/001_schema.sql) directly inside the **SQL Editor** of your Supabase project dashboard.

### 2. Environment Configuration
Create a `.env.local` file at the root of the project with the following keys:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Server Audit Signing Keypair (Ed25519)
SERVER_SIGNING_PRIVATE_KEY=686eaee9cd881ee5fde7638b6bc9c80a87a143e86e1e7f5e1f9bb8eea779582e
NEXT_PUBLIC_SERVER_SIGNING_PUBLIC_KEY=74dfce2e3fc80bd5ffce8d4a7c8ce073153ae10fee84cc5e7070ebd88c5bfdaf
```

### 3. Install & Start Dev Server
```bash
# Install dependencies
npm install

# Run next dev server
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Demo Script Walkthrough

### Setup
1. Open **Tab A** (Normal window) and **Tab B** (Incognito window).
2. Register **Alice** (`alice@test.com`) on Tab A. Enter a login password and a separate Vault Passphrase (e.g. `passphrase123`). 
3. *Download the backup JSON file when prompted!*
4. Register **Bob** (`bob@test.com`) on Tab B. Download Bob's backup file.

### Demo 1: Local E2E Encryption
1. On Tab A (Alice), click **"Add Secret"**.
2. Enter Name `Stripe Live Key` and Value `sk_live_alice12345`.
3. Submit.
4. **Show judges the Network Tab**: Inspect the POST request to `/api/secrets`. Point out that the payload contains only the `encrypted_blob` JSON (ephemeral public key, IV, and ciphertext). The plaintext `sk_live_alice12345` never left Alice's browser.

### Demo 2: Team Secret Sharing
1. On Tab A, click `Stripe Live Key` to open detail page.
2. Click **"Decrypt Secret"** to show it decrypts locally.
3. Click **"Share Secret"**, search for `bob@test.com`, and click **"Re-encrypt & Share"**.
4. Bob's client will decrypt Alice's ciphertext in-memory, re-encrypt it with Bob's public key, and post the new ECIES key.
5. On Tab B (Bob), watch Bob's dashboard update **instantly** (within 1 second) via Supabase Realtime.
6. Bob clicks the shared secret and decrypts it using his own browser-bound P-256 private key.

### Demo 3: Instant Revocation
1. Open Tab A and Tab B side-by-side.
2. On Tab B, click the shared secret to view the decryption page.
3. On Tab A, click **"Revoke Access"** next to Bob's email.
4. On Tab B, Bob's screen will show a **"🔒 Access Revoked" toast** and automatically redirect him to the dashboard within 1 second. If he tries to navigate back to the secret, access is blocked.

### Demo 4: Audit Log Verification
1. On Tab A, click **"Audit Log"**.
2. Note the timeline of events: Created, Shared, Revoked.
3. Click **"Verify All Signatures"**.
4. The client will query the server's public key and run Ed25519 signature checks on the timeline entries. You will see green **"Signature Valid"** checkmarks appear, proving the server cannot fake or modify audit entries retrospectively.

---

## 🛸 Production Roadmap
1. **WebAuthn Key-Wrapping**: Bind the vault key derivation to biometric passkeys (Face ID / Windows Hello) for absolute device auth.
2. **Offline Local Storage**: Cache decrypted secrets in memory-only service workers to support offline workflows securely.
3. **Hardware Key Escrow**: Integrate physical security keys (YubiKey) to enforce hardware-based access policies.
