import { TopNav } from '@/components/ui/TopNav';
import { LoginForm } from '@/components/ui/LoginForm';
import { supabaseEnabled } from '@/lib/supabase/config';

export const metadata = { title: 'Đăng nhập · SA Builder' };

export default function LoginPage() {
  return (
    <>
      <TopNav />
      <main className="mx-auto max-w-md px-4 py-12">
        <div className="sketch sketch-shadow p-6">
          <h1 className="font-hand text-3xl">Đăng nhập</h1>
          {supabaseEnabled() ? (
            <LoginForm />
          ) : (
            <p className="mt-2 text-sm text-ink-2">
              Bản này đang chạy offline: tiến độ lưu trên trình duyệt. Để bật tài khoản và bảng xếp hạng, cấu hình Supabase theo hướng dẫn trong README.
            </p>
          )}
        </div>
      </main>
    </>
  );
}
