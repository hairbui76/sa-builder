import { NextResponse } from 'next/server';
import { serverClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const sb = await serverClient();
  if (sb && code) await sb.auth.exchangeCodeForSession(code);
  return NextResponse.redirect(new URL('/', url.origin));
}
