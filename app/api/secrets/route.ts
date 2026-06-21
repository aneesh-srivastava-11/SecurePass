import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/supabase/server';
import { signAuditEntry } from '@/lib/signing';

export async function GET(request: Request) {
  try {
    const session = await getSessionUser();
    if (session.errorResponse) return session.errorResponse;
    const { user, supabase } = session;

    // 1. Fetch owned secrets
    const { data: ownedSecrets, error: ownedError } = await supabase
      .from('secrets')
      .select('*')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false });

    if (ownedError) {
      console.error('Error fetching owned secrets:', ownedError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    // 2. Fetch shared secrets (joining shares and secrets)
    const { data: sharedShares, error: sharedError } = await supabase
      .from('shares')
      .select('encrypted_key, secrets(*, users(email))')
      .eq('user_id', user.id);

    if (sharedError) {
      console.error('Error fetching shared secrets:', sharedError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    // Map shared secrets to a clean format
    const sharedSecrets = sharedShares.map((share: any) => {
      const secret = share.secrets;
      return {
        id: secret.id,
        owner_id: secret.owner_id,
        owner_email: secret.users?.email || 'Unknown',
        name: secret.name,
        // For shared secrets, the encrypted blob Bob needs to decrypt is the specific encrypted key in the share record!
        // This is a crucial ECIES zero-knowledge detail!
        encrypted_blob: share.encrypted_key,
        created_at: secret.created_at,
        isShared: true,
      };
    });

    return NextResponse.json({
      owned: ownedSecrets.map(s => ({ ...s, isShared: false })),
      shared: sharedSecrets,
    });
  } catch (error: any) {
    console.error('Secrets GET API Error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSessionUser();
    if (session.errorResponse) return session.errorResponse;
    const { user, supabase } = session;

    const { name, encryptedBlob } = await request.json();
    if (!name || !encryptedBlob) {
      return NextResponse.json({ error: 'Missing name or encrypted blob' }, { status: 400 });
    }

    // Input validation for ECIESPayload structure
    if (
      typeof encryptedBlob !== 'object' ||
      typeof encryptedBlob.ephemeralPublicKey !== 'string' ||
      typeof encryptedBlob.iv !== 'string' ||
      typeof encryptedBlob.ciphertext !== 'string'
    ) {
      return NextResponse.json({ error: 'Invalid encrypted blob structure' }, { status: 400 });
    }

    // 1. Pre-generate secret ID and sign the transaction
    const secretId = crypto.randomUUID();
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0] || request.headers.get('x-real-ip') || '127.0.0.1';
    const timestamp = new Date().toISOString();

    const auditPayload = {
      action: 'created' as const,
      userId: user.id,
      secretId,
      targetUserId: null,
      timestamp,
      ipAddress,
    };

    const signature = await signAuditEntry(auditPayload);

    // 2. Insert secret and audit log in a single atomic database RPC call
    const { data: secret, error: dbError } = await supabase
      .rpc('create_secret_with_audit', {
        p_id: secretId,
        p_name: name,
        p_encrypted_blob: encryptedBlob,
        p_ip_address: ipAddress,
        p_signature: signature,
        p_timestamp: timestamp,
      });

    if (dbError || !secret) {
      console.error('Error creating secret via transaction:', dbError);
      if (dbError?.message?.includes('limit reached')) {
        return NextResponse.json({ error: dbError.message }, { status: 403 });
      }
      return NextResponse.json({ error: 'Database transaction failed' }, { status: 500 });
    }

    return NextResponse.json({ success: true, secret });
  } catch (error: any) {
    console.error('Secrets POST API Error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
