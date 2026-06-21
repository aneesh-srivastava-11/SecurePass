import { NextResponse } from 'next/server';
import { getSessionUser, createAdminClient } from '@/lib/supabase/server';

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const LIMIT = 5;
const WINDOW_MS = 5 * 60 * 1000; // 5 minutes

export async function POST(request: Request) {
  try {
    const session = await getSessionUser();
    if (session.errorResponse) return session.errorResponse;
    const { user, supabase } = session;

    // Rate Limiting Check
    const now = Date.now();
    const userLimit = rateLimitMap.get(user.id);

    if (!userLimit) {
      rateLimitMap.set(user.id, { count: 1, resetTime: now + WINDOW_MS });
    } else if (now > userLimit.resetTime) {
      rateLimitMap.set(user.id, { count: 1, resetTime: now + WINDOW_MS });
    } else if (userLimit.count >= LIMIT) {
      return NextResponse.json({ error: 'Too many requests. Please try again in 5 minutes.' }, { status: 429 });
    } else {
      userLimit.count += 1;
    }

    const { email, secretId, secretName } = await request.json();
    if (!email || !secretId || !secretName) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const targetEmail = email.trim().toLowerCase();

    // 1. Check if user is already registered in public.users
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('id, email, public_key')
      .eq('email', targetEmail)
      .single();

    if (existingUser) {
      return NextResponse.json({ 
        alreadyRegistered: true, 
        userId: existingUser.id, 
        publicKey: existingUser.public_key 
      });
    }

    // 2. Not registered. Send email invitation via Supabase Auth Admin client
    const adminSupabase = createAdminClient();
    const { error: inviteError } = await adminSupabase.auth.admin.inviteUserByEmail(targetEmail, {
      redirectTo: `${new URL(request.url).origin}/auth/signup`,
    });

    if (inviteError) {
      console.error('Error inviting user:', inviteError);
      return NextResponse.json({ error: inviteError.message || 'Failed to send email invitation' }, { status: 500 });
    }

    // 3. Create a record in pending_invites table
    const { error: dbError } = await supabase
      .from('pending_invites')
      .insert({
        invited_by: user.id,
        email: targetEmail,
        secret_id: secretId,
        secret_name: secretName,
      });

    if (dbError) {
      console.error('Error creating pending invite:', dbError);
      return NextResponse.json({ error: 'Failed to record invitation in database' }, { status: 500 });
    }

    return NextResponse.json({ invited: true });
  } catch (error: any) {
    console.error('Invite API Error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
