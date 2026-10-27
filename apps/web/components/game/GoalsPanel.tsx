'use client';
import { CheckCircle2, ChevronDown, ChevronUp, Circle, XCircle } from 'lucide-react';
import { useState } from 'react';
import type { Rule } from '@sa/engine';
import { useGame } from './store';

export function GoalsPanel() {
  const level = useGame((s) => s.level)!;
  const result = useGame((s) => s.result);
  const stale = useGame((s) => s.stale);
  const [open, setOpen] = useState(true);
  const goalById = new Map((result?.goals ?? []).map((g) => [g.ruleId, g]));
  const hard = level.rules.filter((r) => r.hard);
  const bonus = level.rules.filter((r) => !r.hard);

  const item = (r: Rule) => {
    const g = stale ? undefined : goalById.get(r.id);
    const Icon = !g ? Circle : g.passed ? CheckCircle2 : XCircle;
    const color = !g ? 'text-ink-2' : g.passed ? 'text-ok' : r.hard ? 'text-bad' : 'text-warn';
    return (
      <li key={r.id} className="flex gap-1.5" data-testid={`goal-${r.id}`}>
        <Icon size={15} className={`mt-0.5 shrink-0 ${color}`} />
        <span>{r.text}</span>
      </li>
    );
  };

  return (
    <div className="note w-full max-w-[320px] p-3 text-sm">
      <button className="flex w-full items-center justify-between" onClick={() => setOpen(!open)}>
        <span className="font-hand text-xl">Mục tiêu</span>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {open && (
        <div className="scroll-thin mt-1 max-h-[calc(100vh-190px)] overflow-y-auto pr-1">
          <p className="font-semibold leading-snug">{level.brief}</p>
          <ul className="mt-2 space-y-1.5">{hard.map(item)}</ul>
          {bonus.length > 0 && (
            <>
              <div className="mt-3 text-xs font-semibold uppercase tracking-wide text-ink-2">Điểm cộng</div>
              <ul className="mt-1 space-y-1.5 text-ink-2">{bonus.map(item)}</ul>
            </>
          )}
          <div className="mt-3 border-t border-note-line pt-2 text-xs text-ink-2">
            Đội ngũ: {level.team.size} dev, quen {level.team.skills.join(', ')}
          </div>
        </div>
      )}
    </div>
  );
}
