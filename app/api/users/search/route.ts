import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/supabase/server';

export async function GET(request: Request) {
  try {
    const session = await getSessionUser();
    if (session.errorResponse) return session.errorResponse;
    const { user, supabase } = session;

    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json({ error: 'Email parameter is required' }, { status: 400 });
    }

    // Search users by email in our public.users table
    // We only return email, id, and public key
    const { data: users, error: dbError } = await supabase
      .from('users')
      .select('id, email, public_key')
      .eq('email', email.trim().toLowerCase())
      .single();

    if (dbError && dbError.code !== 'PGRST116') { // PGRST116 is code for 0 rows returned
      console.error('Database error searching user:', dbError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    if (!users) {
      return NextResponse.json({ found: false, email: email.trim().toLowerCase() });
    }

    return NextResponse.json({ found: true, user: users });
  } catch (error: any) {
    console.error('Search User API Error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
