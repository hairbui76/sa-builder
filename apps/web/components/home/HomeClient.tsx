'use client';
import Link from 'next/link';
import { ArrowRight, ClipboardList, Lock, MessagesSquare, PenTool, PlayCircle } from 'lucide-react';
import { levels, worlds } from '@sa/content';
import { Stars } from '@/components/ui/Stars';
import { titleFor, totalStars } from '@/lib/progress';
import { useProgress } from '@/lib/useProgress';

const STEPS = [
  { icon: MessagesSquare, title: 'Khảo sát', text: 'Giờ họp có hạn. Hỏi đúng người để lộ ra ràng buộc thật.' },
  { icon: PenTool, title: 'Thiết kế', text: 'Kéo thả kiến trúc và chọn build/buy, DR, tenancy, migration.' },
  { icon: PlayCircle, title: 'Mô phỏng', text: 'Traffic, spike, sự cố và tấn công chạy qua thiết kế của bạn.' },
  { icon: ClipboardList, title: 'Review', text: 'Hội đồng chấm 6 trụ cột Well-Architected, kinh doanh và triển khai.' },
];

export function HomeClient() {
  const progress = useProgress();
  const stars = totalStars(progress);
  const title = titleFor(stars);
  const w1 = levels.filter((l) => l.worldId === 'first_contract').sort((a, b) => a.order - b.order);
  const next = w1.find((l) => !progress[l.id]?.passed) ?? w1[w1.length - 1];
  const maxStars = w1.length * 3;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <section>
          <h1 className="font-hand text-4xl">Chọn thế giới</h1>
          <p className="mt-1 max-w-2xl text-ink-2">
            Mỗi level là một khách hàng thật: khảo sát, dựng kiến trúc, cho traffic và sự cố chạy qua, rồi bảo vệ thiết kế trước hội đồng. Không
            chỉ client-server: cả ngân sách, pháp lý, hệ thống cũ, migration và con người.
          </p>

          <Link href={`/levels/${next.id}`} className="sketch sketch-shadow mt-5 flex items-center gap-4 p-4 hover:bg-paper-2">
            <span className="font-hand flex h-12 w-12 items-center justify-center rounded-full border-2 border-ink bg-note text-2xl">{next.order}</span>
            <span className="flex-1">
              <span className="block text-sm text-muted">Chơi tiếp · Hợp đồng đầu tiên</span>
              <span className="font-hand block text-2xl">{next.title}</span>
              <span className="block text-sm text-ink-2">{next.client}</span>
            </span>
            <span className="btn btn-primary">
              Chơi <ArrowRight size={18} />
            </span>
          </Link>

          <div className="mt-6 grid gap-3 sm:grid-cols-4">
            {STEPS.map((s, i) => (
              <div key={s.title} className="sketch-soft p-3">
                <div className="flex items-center gap-2">
                  <span className="font-hand text-lg text-muted">{i + 1}</span>
                  <s.icon size={18} />
                  <span className="font-hand text-xl">{s.title}</span>
                </div>
                <p className="mt-1 text-sm text-ink-2">{s.text}</p>
              </div>
            ))}
          </div>
        </section>

        <aside className="note h-fit p-4">
          <div className="text-sm text-ink-2">Danh hiệu của bạn</div>
          <div className="font-hand text-3xl">{title.title}</div>
          <p className="text-sm">{title.blurb}</p>
          <div className="mt-2 flex items-center gap-2">
            <Stars value={1} max={1} />
            <span className="font-hand text-xl">
              {stars}/{maxStars} sao
            </span>
          </div>
          {title.next && <p className="mt-1 text-sm text-ink-2">Còn {title.next.min - stars} sao nữa để lên {title.next.title}.</p>}
        </aside>
      </div>

      <h2 className="font-hand mt-10 text-3xl">Các thế giới</h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {worlds.map((w) => {
          const wl = levels.filter((l) => l.worldId === w.id);
          const passed = wl.filter((l) => progress[l.id]?.passed).length;
          const ws = wl.reduce((s, l) => s + (progress[l.id]?.bestStars ?? 0), 0);
          const open = w.status === 'open';
          const body = (
            <div className={`sketch h-full p-4 ${open ? 'sketch-shadow hover:bg-paper-2' : 'opacity-70'}`}>
              <div className="flex items-center justify-between">
                <span className="font-hand text-2xl">{w.title}</span>
                {open ? (
                  <span className="rounded-full bg-mint-soft px-2 text-xs text-mint">{wl.length} level</span>
                ) : (
                  <span className="flex items-center gap-1 rounded-full bg-paper-2 px-2 text-xs text-muted">
                    <Lock size={12} /> Sắp ra mắt
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-ink-2">{w.subtitle}</p>
              {open && (
                <div className="mt-3 text-sm">
                  <div className="h-2 overflow-hidden rounded-full border border-ink bg-white">
                    <div className="h-full bg-mint" style={{ width: `${(passed / Math.max(1, wl.length)) * 100}%` }} />
                  </div>
                  <div className="mt-1 flex justify-between text-muted">
                    <span>
                      {passed}/{wl.length} level
                    </span>
                    <span>
                      {ws}/{wl.length * 3} sao
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
          return open ? (
            <Link key={w.id} href={`/worlds/${w.id}`}>
              {body}
            </Link>
          ) : (
            <div key={w.id}>{body}</div>
          );
        })}
      </div>
      <p className="mt-10 text-center text-xs text-muted">
        {levels.length} level · tiến độ lưu trên trình duyệt này · lấy cảm hứng từ systemdesign.200lab.io và gonnacrash.com
      </p>
    </main>
  );
}
