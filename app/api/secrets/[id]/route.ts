import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/supabase/server';
import { signAuditEntry } from '@/lib/signing';
import { getCleanIp } from '@/lib/ip';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionUser();
    if (session.errorResponse) return session.errorResponse;
    const { user, supabase } = session;
    const { id: secretId } = await params;

    // 1. Fetch secret to verify ownership
    const { data: secret, error: fetchError } = await supabase
      .from('secrets')
      .select('*')
      .eq('id', secretId)
      .single();

    if (fetchError || !secret) {
      return NextResponse.json({ error: 'Secret not found' }, { status: 404 });
    }

    if (secret.owner_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden: You do not own this secret' }, { status: 403 });
    }

    // 2. Sign audit log entry for revocation (deletion)
    const ipAddress = getCleanIp(request);
    const timestamp = new Date().toISOString();
    
    const auditPayload = {
      action: 'revoked' as const,
      userId: user.id,
      secretId,
      targetUserId: null,
      timestamp,
      ipAddress,
    };

    const signature = await signAuditEntry(auditPayload);

    // 3. Delete secret and audit log in a single atomic database RPC call
    const { error: dbError } = await supabase
      .rpc('delete_secret_with_audit', {
        p_secret_id: secretId,
        p_ip_address: ipAddress,
        p_signature: signature,
        p_timestamp: timestamp,
      });

    if (dbError) {
      console.error('Error deleting secret via transaction:', dbError);
      return NextResponse.json({ error: 'Database transaction failed' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete Secret API Error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
