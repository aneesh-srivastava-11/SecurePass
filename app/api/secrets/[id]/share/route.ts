import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/supabase/server';
import { signAuditEntry } from '@/lib/signing';
import { getCleanIp } from '@/lib/ip';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionUser();
    if (session.errorResponse) return session.errorResponse;
    const { user, supabase } = session;
    const { id: secretId } = await params;

    const { userId, encryptedKey } = await request.json();
    if (!userId || !encryptedKey) {
      return NextResponse.json({ error: 'Missing target user ID or encrypted key' }, { status: 400 });
    }

    // 1. Verify that the current user owns the secret
    const { data: secret, error: secretError } = await supabase
      .from('secrets')
      .select('*')
      .eq('id', secretId)
      .single();

    if (secretError || !secret) {
      return NextResponse.json({ error: 'Secret not found' }, { status: 404 });
    }

    if (secret.owner_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden: You do not own this secret' }, { status: 403 });
    }

    // 2. Sign audit log entry
    const ipAddress = getCleanIp(request);
    const timestamp = new Date().toISOString();

    const auditPayload = {
      action: 'shared' as const,
      userId: user.id,
      secretId,
      targetUserId: userId,
      timestamp,
      ipAddress,
    };

    const signature = await signAuditEntry(auditPayload);

    // 3. Share secret and insert audit log in a single atomic database RPC call
    const { error: dbError } = await supabase
      .rpc('share_secret_with_audit', {
        p_secret_id: secretId,
        p_target_user_id: userId,
        p_encrypted_key: encryptedKey,
        p_ip_address: ipAddress,
        p_signature: signature,
        p_timestamp: timestamp,
      });

    if (dbError) {
      console.error('Error sharing secret via transaction:', dbError);
      if (dbError?.message?.includes('limit reached')) {
        return NextResponse.json({ error: dbError.message }, { status: 403 });
      }
      return NextResponse.json({ error: 'Database transaction failed (could be already shared)' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Share Secret API Error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
