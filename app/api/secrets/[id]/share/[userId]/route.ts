import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/supabase/server';
import { signAuditEntry } from '@/lib/signing';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    const session = await getSessionUser();
    if (session.errorResponse) return session.errorResponse;
    const { user, supabase } = session;
    const { id: secretId, userId: targetUserId } = await params;

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

    // 2. Sign audit log entry for revocation
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0] || request.headers.get('x-real-ip') || '127.0.0.1';
    const timestamp = new Date().toISOString();

    const auditPayload = {
      action: 'revoked' as const,
      userId: user.id,
      secretId,
      targetUserId,
      timestamp,
      ipAddress,
    };

    const signature = await signAuditEntry(auditPayload);

    // 3. Revoke share and write audit log in a single atomic database RPC call
    const { error: dbError } = await supabase
      .rpc('revoke_share_with_audit', {
        p_secret_id: secretId,
        p_target_user_id: targetUserId,
        p_ip_address: ipAddress,
        p_signature: signature,
        p_timestamp: timestamp,
      });

    if (dbError) {
      console.error('Error revoking share via transaction:', dbError);
      return NextResponse.json({ error: 'Database transaction failed' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Revoke Share API Error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
