'use client';
import { useState } from 'react';
import { LogIn, Mail } from 'lucide-react';
import { browserClient } from '@/lib/supabase/browser';

export function LoginForm() {
  const sb = browserClient();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!sb) return null;
  const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : undefined;
  return (
    <div className="mt-4 space-y-4">
      <button className="btn w-full justify-center" onClick={() => sb.auth.signInWithOAuth({ provider: 'github', options: { redirectTo } })}>
        <LogIn size={18} /> Tiếp tục với GitHub
      </button>
      <div className="text-center text-xs text-muted">hoặc nhận link đăng nhập qua email</div>
      <form
        className="flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
          if (error) setError(error.message);
          else setSent(true);
        }}
      >
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="ban@congty.vn"
          className="flex-1 rounded-lg border-2 border-line px-2 outline-none focus:border-ink"
        />
        <button className="btn btn-primary" type="submit">
          <Mail size={16} /> Gửi
        </button>
      </form>
      {sent && <p className="text-sm text-ok">Đã gửi link, hãy kiểm tra hộp thư.</p>}
      {error && <p className="text-sm text-bad">{error}</p>}
    </div>
  );
}
