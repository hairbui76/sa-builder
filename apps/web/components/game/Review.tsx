'use client';
import Link from 'next/link';
import { AlertTriangle, ArrowRight, BookOpen, CheckCircle2, Info, Pencil, XCircle } from 'lucide-react';
import { PILLARS, type EvalResult, type Level } from '@sa/engine';
import { conceptByKey, levels } from '@sa/content';
import { Stars } from '@/components/ui/Stars';
import { PILLAR_LABEL, usd } from '@/lib/labels';
import { useGame } from './store';

function Sparkline({ values, max, color, height = 40 }: { values: number[]; max: number; color: string; height?: number }) {
  const w = 220;
  if (values.length === 0) return null;
  const pts = values.map((v, i) => `${(i / Math.max(1, values.length - 1)) * w},${height - (Math.min(v, max) / max) * (height - 2) - 1}`).join(' ');
  return (
    <svg width={w} height={height} className="overflow-visible">
      <line x1={0} y1={height - 1} x2={w} y2={height - 1} stroke="#d9d6cb" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
    </svg>
  );
}

const MOOD: Record<string, { face: string; cls: string }> = {
  happy: { face: '😀', cls: 'bg-ok-soft' },
  neutral: { face: '😐', cls: 'bg-warn-soft' },
  unhappy: { face: '😠', cls: 'bg-bad-soft' },
};

export function Review({ result, level, verified }: { result: EvalResult; level: Level; verified: string | null }) {
  const { setStage, select } = useGame.getState();
  const nextLevel = levels.find((l) => l.worldId === level.worldId && l.order === level.order + 1);
  const userKinds = level.traffic.kinds.filter((k) => k.userFacing && result.sim.perKind[k.id]);
  const hard = result.goals.filter((g) => g.hard);
  const soft = result.goals.filter((g) => !g.hard);
  const a = result.analysis;

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-ink/30" role="dialog" aria-label="Kết quả">
      <div className="pop-in scroll-thin h-full w-full max-w-4xl overflow-y-auto border-l-2 border-ink bg-paper p-5" data-testid="review">
        {/* Verdict */}
        <div className={`sketch sketch-shadow flex flex-wrap items-center gap-4 p-4 ${result.passed ? 'bg-ok-soft' : 'bg-bad-soft'}`}>
          <div className="flex-1">
            <div className="text-sm text-muted">Bước 3 · Hội đồng review</div>
            <div className="font-hand text-4xl" data-testid="verdict">
              {result.passed ? 'Đạt yêu cầu!' : 'Chưa đạt'}
            </div>
            <div className="text-sm text-ink-2">
              {result.passed
                ? 'Mọi ràng buộc bắt buộc đều qua. Điểm review quyết định số sao.'
                : `${hard.filter((g) => !g.passed).length} ràng buộc bắt buộc chưa qua. Sửa rồi chạy lại.`}
            </div>
            {verified && <div className="mt-1 text-xs text-mint">{verified}</div>}
          </div>
          <div className="text-center">
            <Stars value={result.stars} size={30} />
            <div className="font-hand text-2xl">Điểm {result.overall}/100</div>
          </div>
        </div>

        {result.missedFacts.length > 0 && (
          <div className="note mt-4 p-3 text-sm">
            <div className="font-hand text-xl">Bạn đã bỏ lỡ khi khảo sát</div>
            <ul className="list-disc pl-5">
              {result.missedFacts.map((f) => (
                <li key={f.id}>{f.text}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <section className="sketch p-3">
            <h3 className="font-hand text-2xl">Ràng buộc bắt buộc</h3>
            <GoalList goals={hard} />
            {soft.length > 0 && (
              <>
                <h3 className="font-hand mt-3 text-2xl">Điểm cộng</h3>
                <GoalList goals={soft} />
              </>
            )}
          </section>

          <section className="sketch p-3">
            <h3 className="font-hand text-2xl">Điểm theo trụ cột</h3>
            <ul className="mt-1 space-y-1.5 text-sm">
              {PILLARS.map((p) => {
                const v = result.pillars[p];
                return (
                  <li key={p} className="flex items-center gap-2">
                    <span className="w-36 shrink-0">{PILLAR_LABEL[p]}</span>
                    <span className="h-3 flex-1 overflow-hidden rounded-full border border-ink bg-white">
                      {v !== null && <span className={`block h-full ${v >= 85 ? 'bg-ok' : v >= 60 ? 'bg-warn' : 'bg-bad'}`} style={{ width: `${v}%` }} />}
                    </span>
                    <span className="w-8 text-right text-xs">{v ?? '—'}</span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-2 text-xs text-muted">Dựa trên 6 trụ cột Well-Architected, cộng thêm phù hợp kinh doanh và rủi ro triển khai. "—" là level không chấm trụ cột đó.</p>
          </section>
        </div>

        <section className="sketch mt-4 p-3">
          <h3 className="font-hand text-2xl">Stakeholder nói gì</h3>
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            {result.stakeholders.map((s) => (
              <div key={s.stakeholderId} className={`rounded-lg border-2 border-ink p-2 text-sm ${MOOD[s.mood].cls}`}>
                <div className="flex items-center gap-2">
                  <span className="text-xl">{MOOD[s.mood].face}</span>
                  <b>{s.name}</b>
                  <span className="text-xs text-ink-2">{s.role}</span>
                </div>
                <p className="mt-1 italic">“{s.quote}”</p>
              </div>
            ))}
          </div>
        </section>

        {result.reasons.length > 0 && (
          <section className="sketch mt-4 p-3">
            <h3 className="font-hand text-2xl">Vì sao</h3>
            <ul className="mt-1 space-y-1.5 text-sm">
              {result.reasons.map((r, i) => {
                const Icon = r.severity === 'error' ? XCircle : r.severity === 'warn' ? AlertTriangle : Info;
                const c = r.conceptKey ? conceptByKey[r.conceptKey] : undefined;
                return (
                  <li key={i} className="flex gap-2">
                    <Icon size={16} className={`mt-0.5 shrink-0 ${r.severity === 'error' ? 'text-bad' : r.severity === 'warn' ? 'text-warn' : 'text-sky-strong'}`} />
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

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <section className="sketch p-3">
            <h3 className="font-hand text-2xl">Traffic trong {result.sim.ticks} giây</h3>
            <ul className="mt-1 space-y-2 text-sm">
              {userKinds.map((k) => {
                const v = result.sim.perKind[k.id];
                const j = result.sim.jobs[k.id];
                return (
                  <li key={k.id}>
                    <div className="flex justify-between">
                      <b>{k.title}</b>
                      <span className={v.answeredPct >= 99 ? 'text-ok' : 'text-bad'}>
                        {v.answeredPct}% · {v.avgLatencyMs} ms
                      </span>
                    </div>
                    <Sparkline values={v.series.answeredPct} max={100} color="#2f9e44" height={28} />
                    {j && (
                      <div className="text-xs text-ink-2">
                        Job nền: {j.donePct}% xong, chờ lâu nhất {j.maxWaitS} s
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            {result.sim.eventsFired.length > 0 && (
              <div className="mt-2 border-t border-line pt-2 text-xs">
                {result.sim.eventsFired.map((e, i) => (
                  <div key={i}>
                    ⚡ Giây {e.at}: {e.text}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="sketch p-3 text-sm">
            <h3 className="font-hand text-2xl">Chi phí & triển khai</h3>
            <div className="mt-1 grid grid-cols-2 gap-2">
              <Stat label="Hằng tháng" value={usd(a.monthlyUsd)} />
              <Stat label="TCO 3 năm" value={usd(a.tco3yUsd)} />
              <Stat label="Chi phí một lần" value={usd(a.oneOffUsd)} />
              <Stat label="Thời gian ra mắt" value={`${a.calendarMonths} tháng`} />
            </div>
            <ul className="mt-2 space-y-0.5 text-xs">
              {a.costLines.slice(0, 8).map((c, i) => (
                <li key={i} className="flex justify-between border-b border-dashed border-line">
                  <span className="truncate pr-2">{c.label}</span>
                  <span>{usd(c.monthlyUsd)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-ink-2">
              TCO = hạ tầng × 36 + chi phí một lần + ({a.devMonths} dev-tháng xây dựng + {a.opsDevMonths3y} dev-tháng vận hành) × lương.
              {a.unfamiliarTech.length > 0 && ` Công nghệ team chưa quen: ${a.unfamiliarTech.join(', ')}.`}
            </p>
          </section>
        </div>

        <div className="sticky bottom-0 mt-4 flex flex-wrap gap-2 bg-paper py-3">
          <button className="btn" onClick={() => setStage('design')} data-testid="back-to-design">
            <Pencil size={16} /> Sửa thiết kế
          </button>
          {result.passed && nextLevel && (
            <Link href={`/levels/${nextLevel.id}`} className="btn btn-primary">
              Level tiếp: {nextLevel.title} <ArrowRight size={16} />
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

function GoalList({ goals }: { goals: EvalResult['goals'] }) {
  return (
    <ul className="mt-1 space-y-1 text-sm">
      {goals.map((g) => (
        <li key={g.ruleId} className="flex gap-1.5">
          {g.passed ? <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-ok" /> : <XCircle size={15} className="mt-0.5 shrink-0 text-bad" />}
          <span className="flex-1">
            {g.text}
            {!g.discovered && <span className="ml-1 rounded bg-warn-soft px-1 text-[11px] text-warn">chưa hỏi ra</span>}
            {g.actual && <span className="block text-xs text-ink-2">Thực tế: {g.actual}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="sketch-soft p-2">
      <div className="text-xs text-muted">{label}</div>
      <div className="font-hand text-xl">{value}</div>
    </div>
  );
}
