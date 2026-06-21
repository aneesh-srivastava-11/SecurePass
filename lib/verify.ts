import * as ed from '@noble/ed25519';

function hexToUint8Array(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error('Invalid hex string');
  }
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < arr.length; i++) {
    arr[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return arr;
}

export async function verifyAuditEntry(
  entry: {
    action: string;
    user_id: string;
    secret_id: string | null;
    target_user_id: string | null;
    created_at: string;
    ip_address: string | null;
    signature: string | null;
  }
): Promise<boolean> {
  try {
    if (!entry.signature) return false;
    
    const pubKeyHex = process.env.NEXT_PUBLIC_SERVER_SIGNING_PUBLIC_KEY;
    if (!pubKeyHex) {
      console.warn('NEXT_PUBLIC_SERVER_SIGNING_PUBLIC_KEY is not defined.');
      return false;
    }
    
    const pubKey = hexToUint8Array(pubKeyHex);
    const payload = {
      action: entry.action,
      userId: entry.user_id,
      secretId: entry.secret_id,
      targetUserId: entry.target_user_id,
      timestamp: entry.created_at,
      ipAddress: entry.ip_address
    };
    
    const msg = new TextEncoder().encode(JSON.stringify(payload));
    const sig = hexToUint8Array(entry.signature);
    
    return await ed.verifyAsync(sig, msg, pubKey);
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}
