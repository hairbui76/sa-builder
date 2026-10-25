import { TopNav } from '@/components/ui/TopNav';
import { supabaseEnabled } from '@/lib/supabase/config';
import { serverClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Bảng xếp hạng · SA Builder' };

interface Row {
  display_name: string;
  levels_passed: number;
  stars: number;
  points: number;
  avg_runs: number;
}

export default async function LeaderboardPage({ searchParams }: { searchParams: Promise<{ w?: string }> }) {
  const { w } = await searchParams;
  const window = w === 'all' ? 'all' : 'week';
  let rows: Row[] = [];
  let error: string | null = null;
  if (supabaseEnabled()) {
    const sb = await serverClient();
    const res = await sb!.rpc('leaderboard', { p_window: window });
    if (res.error) error = res.error.message;
    else rows = (res.data ?? []) as Row[];
  }
  return (
    <>
      <TopNav active="leaderboard" />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="font-hand text-4xl">Bảng xếp hạng</h1>
        <p className="text-ink-2">Ai thắng nhiều hợp đồng nhất? Điểm: 10 mỗi sao, 20 mỗi level qua. Kết quả do server chấm lại.</p>
        {!supabaseEnabled() ? (
          <div className="note mt-6 p-4 text-sm">
            Bảng xếp hạng cần tài khoản. Bản này đang chạy offline: cấu hình Supabase (xem README) để bật đăng nhập và bảng xếp hạng.
          </div>
        ) : (
          <>
            <div className="mt-4 flex gap-2">
              <a href="/leaderboard" className={`btn ${window === 'week' ? 'btn-primary' : ''}`}>
                Tuần này
              </a>
              <a href="/leaderboard?w=all" className={`btn ${window === 'all' ? 'btn-primary' : ''}`}>
                Mọi thời điểm
              </a>
            </div>
            {error && <p className="mt-4 text-bad">Không tải được: {error}</p>}
            <div className="sketch mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b-2 border-ink bg-paper-2 text-left">
                  <tr>
                    <th className="p-2">#</th>
                    <th className="p-2">Người chơi</th>
                    <th className="p-2">Level qua</th>
                    <th className="p-2">Sao</th>
                    <th className="p-2">Lượt TB</th>
                    <th className="p-2">Điểm</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-4 text-center text-muted">
                        Chưa có ai. Qua một level để lên bảng!
                      </td>
                    </tr>
                  )}
                  {rows.map((r, i) => (
                    <tr key={i} className="border-t border-line">
                      <td className="p-2 font-hand text-lg">{i + 1}</td>
                      <td className="p-2">{r.display_name}</td>
                      <td className="p-2">{r.levels_passed}</td>
                      <td className="p-2">{r.stars}</td>
                      <td className="p-2">{r.avg_runs}</td>
                      <td className="p-2 font-bold">{r.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </>
  );
}
