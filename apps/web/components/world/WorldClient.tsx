'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Lock, Users } from 'lucide-react';
import { conceptByKey, levels as allLevels, worlds } from '@sa/content';
import { Stars } from '@/components/ui/Stars';
import { DIFFICULTY } from '@/lib/labels';
import { isUnlocked } from '@/lib/progress';
import { useProgress } from '@/lib/useProgress';

export function WorldClient({ worldId }: { worldId: string }) {
  const world = worlds.find((w) => w.id === worldId)!;
  const levels = allLevels.filter((l) => l.worldId === worldId).sort((a, b) => a.order - b.order);
  const progress = useProgress();
  const [selected, setSelected] = useState(levels[0].id);

  useEffect(() => {
    const firstOpen = levels.find((l) => !progress[l.id]?.passed && isUnlocked(levels, l.id, progress));
    if (firstOpen) setSelected(firstOpen.id);
    // Only when progress first loads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Object.keys(progress).length]);

  const lv = levels.find((l) => l.id === selected)!;
  const unlocked = isUnlocked(levels, lv.id, progress);
  const p = progress[lv.id];
  const passed = levels.filter((l) => progress[l.id]?.passed).length;
  const stars = levels.reduce((s, l) => s + (progress[l.id]?.bestStars ?? 0), 0);

  return (
    <main className="mx-auto grid max-w-6xl gap-6 px-4 py-8 lg:grid-cols-[1fr_380px]">
      <section>
        <div className="text-sm text-muted">Thế giới</div>
        <h1 className="font-hand text-4xl">{world.title}</h1>
        <p className="max-w-2xl text-ink-2">{world.subtitle}</p>
        <div className="mt-2 flex gap-4 text-sm text-ink-2">
          <span>
            {passed}/{levels.length} level
          </span>
          <span>
            {stars}/{levels.length * 3} sao
          </span>
        </div>

        <ol className="relative mt-8 space-y-4">
          {levels.map((l, i) => {
            const open = isUnlocked(levels, l.id, progress);
            const lp = progress[l.id];
            const d = DIFFICULTY[l.difficulty];
            return (
              <li key={l.id} style={{ marginLeft: `${[0, 48, 96, 48][i % 4]}px` }}>
                <button
                  onClick={() => setSelected(l.id)}
                  className={`sketch flex w-full max-w-md items-center gap-3 p-3 text-left ${selected === l.id ? 'sketch-shadow bg-note' : 'hover:bg-paper-2'} ${open ? '' : 'opacity-60'}`}
                >
                  <span className="font-hand flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-white text-xl">
                    {open ? l.order : <Lock size={16} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="font-hand block truncate text-xl">{l.title}</span>
                    <span className="block truncate text-sm text-ink-2">{l.client}</span>
                  </span>
                  <span className="flex flex-col items-end gap-1">
                    <span className={`rounded-full px-2 text-xs ${d.cls}`}>{d.label}</span>
                    <Stars value={lp?.bestStars ?? 0} size={13} />
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </section>

      <aside className="h-fit lg:sticky lg:top-6">
        <div className="sketch sketch-shadow p-5">
          <div className="flex items-center justify-between text-sm text-muted">
            <span>Level {lv.order}</span>
            <span className={`rounded-full px-2 text-xs ${DIFFICULTY[lv.difficulty].cls}`}>{DIFFICULTY[lv.difficulty].label}</span>
          </div>
          <h2 className="font-hand text-3xl">{lv.title}</h2>
          <div className="text-sm font-medium text-ink-2">{lv.client}</div>
          <p className="mt-3 text-sm leading-relaxed">{lv.story}</p>
          <div className="note mt-4 p-3 text-sm">
            <div className="font-hand text-lg">Mục tiêu</div>
            {lv.brief}
          </div>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {lv.conceptKeys.map((k) => (
              <Link key={k} href={`/concepts#${k}`} className="rounded-full border border-ink px-2 py-0.5 text-xs hover:bg-paper-2">
                {conceptByKey[k]?.title ?? k}
              </Link>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
            <div className="sketch-soft p-2">
              <div className="text-xs text-muted">Stakeholder</div>
              <div className="flex items-center gap-1">
                <Users size={14} /> {lv.discovery.stakeholders.length} người · {lv.discovery.hours} giờ họp
              </div>
            </div>
            <div className="sketch-soft p-2">
              <div className="text-xs text-muted">Kết quả tốt nhất</div>
              <Stars value={p?.bestStars ?? 0} />
              {p ? <span className="ml-1 text-xs text-muted">{p.runs} lượt chạy</span> : null}
            </div>
          </div>
          {unlocked ? (
            <Link href={`/levels/${lv.id}`} className="btn btn-primary mt-5 w-full justify-center text-xl">
              {p ? 'Chơi tiếp' : 'Nhận hợp đồng'}
            </Link>
          ) : (
            <div className="mt-5 flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-line p-3 text-sm text-muted">
              <Lock size={14} /> Qua level {lv.order - 1} để mở
            </div>
          )}
        </div>
      </aside>
    </main>
  );
}
