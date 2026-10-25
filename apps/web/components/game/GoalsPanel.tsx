'use client';
import { CheckCircle2, ChevronDown, ChevronUp, Circle, Sparkles, XCircle } from 'lucide-react';
import { useState } from 'react';
import { discoveredFacts } from '@sa/engine';
import { useGame } from './store';

export function GoalsPanel() {
  const level = useGame((s) => s.level)!;
  const design = useGame((s) => s.design);
  const result = useGame((s) => s.result);
  const stale = useGame((s) => s.stale);
  const [open, setOpen] = useState(true);
  const facts = discoveredFacts(level, design);
  const visible = level.rules.filter((r) => !r.hiddenUntil || facts.has(r.hiddenUntil));
  const hiddenCount = level.rules.length - visible.length;
  const goalById = new Map((result?.goals ?? []).map((g) => [g.ruleId, g]));

  return (
    <div className="note w-full max-w-[320px] p-3 text-sm">
      <button className="flex w-full items-center justify-between" onClick={() => setOpen(!open)}>
        <span className="font-hand text-xl">Mục tiêu</span>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {open && (
        <div className="scroll-thin mt-1 max-h-[calc(100vh-190px)] overflow-y-auto pr-1">
          <p className="font-semibold leading-snug">{level.brief}</p>
          <ul className="mt-2 space-y-1.5">
            {visible.map((r) => {
              const g = goalById.get(r.id);
              const Icon = !g || stale ? Circle : g.passed ? CheckCircle2 : XCircle;
              const color = !g || stale ? 'text-ink-2' : g.passed ? 'text-ok' : 'text-bad';
              return (
                <li key={r.id} className="flex gap-1.5" data-testid={`goal-${r.id}`}>
                  <Icon size={15} className={`mt-0.5 shrink-0 ${color}`} />
                  <span>
                    {r.text}
                    {!r.hard && <span className="ml-1 text-xs text-ink-2">(điểm cộng)</span>}
                    {r.hiddenUntil && <Sparkles size={12} className="ml-1 inline text-warn" />}
                  </span>
                </li>
              );
            })}
          </ul>
          {hiddenCount > 0 && (
            <p className="mt-2 text-xs italic text-ink-2">
              Khách hàng còn những yêu cầu chưa nói ra. Mở <b>Khảo sát</b> để hỏi.
            </p>
          )}
          {facts.size > 0 && (
            <>
              <div className="font-hand mt-3 text-lg">Điều bạn đã biết</div>
              <ul className="list-disc space-y-1 pl-4">
                {level.discovery.facts
                  .filter((f) => facts.has(f.id))
                  .map((f) => (
                    <li key={f.id}>{f.text}</li>
                  ))}
              </ul>
            </>
          )}
          <div className="mt-3 border-t border-note-line pt-2 text-xs text-ink-2">
            Đội ngũ: {level.team.size} dev · lương ~${level.team.devMonthlyUsd.toLocaleString('en-US')}/dev-tháng
          </div>
        </div>
      )}
    </div>
  );
}
