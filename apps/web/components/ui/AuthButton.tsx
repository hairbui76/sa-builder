'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { browserClient } from '@/lib/supabase/browser';

export function AuthButton() {
  const sb = browserClient();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!sb) return;
    sb.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    const { data } = sb.auth.onAuthStateChange((_e, session) => setEmail(session?.user.email ?? null));
    return () => data.subscription.unsubscribe();
  }, [sb]);

  if (!sb) {
    return (
      <span className="hidden rounded-full border border-line px-2 py-0.5 text-xs text-muted md:inline" title="Tiến độ lưu trên trình duyệt này">
        Chơi offline
      </span>
    );
  }
  if (!email) {
    return (
      <Link href="/login" className="btn btn-primary !py-0.5 text-base">
        Đăng nhập
      </Link>
    );
  }
  return (
    <button
      className="btn btn-ghost !py-0.5 text-base"
      title={email}
      onClick={async () => {
        await sb.auth.signOut();
        setEmail(null);
      }}
    >
      {email.split('@')[0]} · Đăng xuất
    </button>
  );
}
