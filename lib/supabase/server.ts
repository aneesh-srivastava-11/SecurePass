import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );
}

// Admin client using service role key (for user invites and administrative bypass)
export function createAdminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() { return []; },
        setAll() {},
      },
    }
  );
}

import { User, SupabaseClient } from '@supabase/supabase-js';

export async function getSessionUser(): Promise<
  | { user: User; supabase: SupabaseClient; errorResponse: null }
  | { user: null; supabase: null; errorResponse: NextResponse }
> {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      return {
        user: null,
        supabase: null,
        errorResponse: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      };
    }
    return { user, supabase, errorResponse: null };
  } catch (error: any) {
    console.error('Session retrieval error:', error);
    return {
      user: null,
      supabase: null,
      errorResponse: NextResponse.json({ error: 'Server session verification failed' }, { status: 500 }),
    };
  }
}
