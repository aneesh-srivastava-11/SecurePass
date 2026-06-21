import * as ed from '@noble/ed25519';

export interface AuditPayload {
  action: string;
  userId: string;
  secretId: string | null;
  targetUserId: string | null;
  timestamp: string;
  ipAddress: string | null;
}

export async function signAuditEntry(payload: AuditPayload): Promise<string> {
  const privKeyHex = process.env.SERVER_SIGNING_PRIVATE_KEY;
  if (!privKeyHex) {
    throw new Error('SERVER_SIGNING_PRIVATE_KEY environment variable is not set.');
  }
  
  const privKey = Buffer.from(privKeyHex, 'hex');
  const msg = new TextEncoder().encode(JSON.stringify(payload));
  const sig = await ed.signAsync(msg, privKey);
  return Buffer.from(sig).toString('hex');
}
