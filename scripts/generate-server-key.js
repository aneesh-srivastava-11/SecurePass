const ed = require('@noble/ed25519');
const crypto = require('crypto');

async function main() {
  // A private key is just 32 random bytes
  const privKey = crypto.randomBytes(32);
  
  // ed.getPublicKeyAsync accepts Uint8Array or hex string
  const pubKey = await ed.getPublicKeyAsync(privKey);
  
  console.log('SERVER_SIGNING_PRIVATE_KEY=' + privKey.toString('hex'));
  console.log('NEXT_PUBLIC_SERVER_SIGNING_PUBLIC_KEY=' + Buffer.from(pubKey).toString('hex'));
}

main().catch(console.error);
