import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/supabase/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ secretId: string }> }
) {
  try {
    const session = await getSessionUser();
    if (session.errorResponse) return session.errorResponse;
    const { user, supabase } = session;
    const { secretId } = await params;

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

    // 2. Fetch audit logs joined with user emails
    const { data: logs, error: dbError } = await supabase
      .from('audit_log')
      .select(`
        id,
        action,
        user_id,
        secret_id,
        target_user_id,
        ip_address,
        signature,
        created_at,
        users!audit_log_user_id_fkey(email),
        target:users!audit_log_target_user_id_fkey(email)
      `)
      .eq('secret_id', secretId)
      .order('created_at', { ascending: false });

    if (dbError) {
      console.error('Error fetching audit logs:', dbError);
      return NextResponse.json({ error: 'Database error fetching audit logs' }, { status: 500 });
    }

    // Clean up the output format
    const cleanedLogs = logs.map((log: any) => ({
      id: log.id,
      action: log.action,
      user_id: log.user_id,
      secret_id: log.secret_id,
      target_user_id: log.target_user_id,
      ip_address: log.ip_address,
      signature: log.signature,
      created_at: log.created_at,
      actor_email: log.users?.email || 'Unknown',
      target_email: log.target?.email || null,
    }));

    return NextResponse.json({ logs: cleanedLogs });
  } catch (error: any) {
    console.error('Audit Log API Error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
