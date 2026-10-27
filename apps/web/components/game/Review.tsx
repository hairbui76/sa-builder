'use client';
import Link from 'next/link';
import { AlertTriangle, ArrowRight, BookOpen, CheckCircle2, Pencil, XCircle } from 'lucide-react';
import type { EvalResult, Level } from '@sa/engine';
import { conceptByKey, levels } from '@sa/content';
import { Stars } from '@/components/ui/Stars';
import { usd } from '@/lib/labels';
import { useGame } from './store';

export function Review({ result, level, verified }: { result: EvalResult; level: Level; verified: string | null }) {
  const { setStage, select } = useGame.getState();
  const nextLevel = levels.find((l) => l.worldId === level.worldId && l.order === level.order + 1);
  const a = result.analysis;
  const hasMetric = (m: string) => level.rules.some((r) => r.check === 'metric' && r.metric === m);
  const reasons = result.reasons.filter((r) => r.severity !== 'info');
  const goals = [...result.goals].sort((x, y) => Number(y.hard) - Number(x.hard));

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-ink/30" role="dialog" aria-label="Kết quả">
      <div className="pop-in scroll-thin h-full w-full max-w-xl overflow-y-auto border-l-2 border-ink bg-paper p-5" data-testid="review">
        <div className={`sketch sketch-shadow flex items-center gap-4 p-4 ${result.passed ? 'bg-ok-soft' : 'bg-bad-soft'}`}>
          <div className="flex-1">
            <div className="font-hand text-4xl" data-testid="verdict">
              {result.passed ? 'Đạt!' : 'Chưa đạt'}
            </div>
            <div className="text-sm text-ink-2">
              {usd(a.monthlyUsd)}/tháng
              {hasMetric('tco3y_usd') && ` · TCO 3 năm ${usd(a.tco3yUsd)}`}
              {hasMetric('calendar_months') && ` · ra mắt sau ${a.calendarMonths} tháng`}
            </div>
            {verified && <div className="mt-1 text-xs text-mint">{verified}</div>}
          </div>
          <div className="text-center">
            <Stars value={result.stars} size={28} />
            <div className="font-hand text-xl">{result.overall}/100</div>
          </div>
        </div>

        <section className="sketch mt-4 p-3">
          <ul className="space-y-1.5 text-sm">
            {goals.map((g) => (
              <li key={g.ruleId} className="flex gap-1.5">
                {g.passed ? <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-ok" /> : <XCircle size={15} className={`mt-0.5 shrink-0 ${g.hard ? 'text-bad' : 'text-warn'}`} />}
                <span className="flex-1">
                  {g.text}
                  {!g.hard && <span className="ml-1 text-xs text-muted">(điểm cộng)</span>}
                  {g.actual && !g.passed && <span className="block text-xs text-ink-2">Thực tế: {g.actual}</span>}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {reasons.length > 0 && (
          <section className="sketch mt-4 p-3">
            <h3 className="font-hand text-2xl">Vì sao</h3>
            <ul className="mt-1 space-y-1.5 text-sm">
              {reasons.map((r, i) => {
                const c = r.conceptKey ? conceptByKey[r.conceptKey] : undefined;
                return (
                  <li key={i} className="flex gap-2">
                    {r.severity === 'error' ? (
                      <XCircle size={16} className="mt-0.5 shrink-0 text-bad" />
                    ) : (
                      <AlertTriangle size={16} className="mt-0.5 shrink-0 text-warn" />
                    )}
                    <span className="flex-1">
                      {r.text}{' '}
                      {r.nodeId && (
                        <button
                          className="text-xs underline"
                          onClick={() => {
                            select(r.nodeId!);
                            setStage('design');
                          }}
                        >
                          xem trên board
                        </button>
                      )}
                      {c && (
                        <Link href={`/concepts#${c.key}`} target="_blank" className="ml-2 inline-flex items-center gap-0.5 text-xs text-mint underline">
                          <BookOpen size={11} /> {c.title}
                        </Link>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <div className="sticky bottom-0 mt-4 flex flex-wrap gap-2 bg-paper py-3">
          <button className="btn" onClick={() => setStage('design')} data-testid="back-to-design">
            <Pencil size={16} /> Sửa thiết kế
          </button>
          {result.passed && nextLevel && (
            <Link href={`/levels/${nextLevel.id}`} className="btn btn-primary">
              Level tiếp <ArrowRight size={16} />
            </Link>
          )}
          {result.passed && !nextLevel && (
            <Link href="/" className="btn btn-primary">
              Hoàn thành thế giới! <ArrowRight size={16} />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
