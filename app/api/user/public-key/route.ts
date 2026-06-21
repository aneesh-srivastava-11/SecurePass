import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const session = await getSessionUser();
    if (session.errorResponse) return session.errorResponse;
    const { user, supabase } = session;
    
    const { publicKey } = await request.json();
    if (!publicKey) {
      return NextResponse.json({ error: 'Public key is required' }, { status: 400 });
    }
    
    // Insert or update public key in the public.users database
    const { error: dbError } = await supabase
      .from('users')
      .upsert({
        id: user.id,
        email: user.email!,
        public_key: publicKey,
      });
      
    if (dbError) {
      console.error('Error saving public key:', dbError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
