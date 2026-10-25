'use client';
import Link from 'next/link';
import { Activity, ChevronLeft, Lightbulb, MessagesSquare, Play, RotateCcw, Wallet } from 'lucide-react';
import { useState } from 'react';
import { discoveredFacts, type EvalResult, type Level } from '@sa/engine';
import { usd } from '@/lib/labels';
import { useGame } from './store';

function peakRates(level: Level) {
  return level.traffic.kinds
    .filter((k) => k.userFacing)
    .map((k) => ({ title: k.title, peak: Math.max(0, ...level.traffic.phases.map((p) => Math.max(p.rates[k.id] ?? 0, p.ratesTo?.[k.id] ?? 0))) }))
    .filter((x) => x.peak > 0);
}

export function Header({ preview, onRun }: { preview: EvalResult | null; onRun: () => void }) {
  const level = useGame((s) => s.level)!;
  const design = useGame((s) => s.design);
  const running = useGame((s) => s.running);
  const { setStage, reset, notify } = useGame.getState();
  const [hint, setHint] = useState(0);
  const facts = discoveredFacts(level, design);
  const budgetRule = level.rules.find((r) => r.check === 'metric' && r.metric === 'monthly_usd');
  const budgetKnown = budgetRule && (!budgetRule.hiddenUntil || facts.has(budgetRule.hiddenUntil));
  const budget = budgetRule && budgetRule.check === 'metric' ? budgetRule.value : undefined;
  const cost = preview?.analysis.monthlyUsd ?? 0;
  const rates = peakRates(level);

  return (
    <header className="flex flex-wrap items-center gap-3 border-b-2 border-ink bg-paper px-3 py-2">
      <Link href={`/worlds/${level.worldId}`} className="btn btn-ghost !px-1" title="Về bản đồ">
        <ChevronLeft size={20} />
      </Link>
      <div className="min-w-0">
        <div className="text-xs text-muted">
          Level {level.order} · {level.client}
        </div>
        <div className="font-hand truncate text-2xl leading-none">{level.title}</div>
      </div>

      <div className="sketch-soft ml-auto hidden items-center gap-4 px-3 py-1 lg:flex">
        <div className="max-w-[340px]">
          <div className="flex items-center gap-1 text-xs text-muted">
            <Activity size={12} /> Traffic đỉnh
          </div>
          <div className="truncate text-sm">
            {rates.slice(0, 3).map((r, i) => (
              <span key={r.title}>
                {i > 0 && ' · '}
                {r.title} <b className="text-sky-strong">{r.peak.toLocaleString('vi-VN')}/s</b>
              </span>
            ))}
          </div>
        </div>
        <div>
          <div className="flex items-center gap-1 text-xs text-muted">
            <Wallet size={12} /> Chi phí ước tính
          </div>
          <div className="text-sm" data-testid="live-cost">
            <b>{usd(cost)}</b>/tháng
          </div>
        </div>
        <div className="w-36">
          <div className="text-xs text-muted">Ngân sách</div>
          {budgetKnown && budget ? (
            <>
              <div className="h-2 overflow-hidden rounded-full border border-ink bg-white">
                <div className={`h-full ${cost > budget ? 'bg-bad' : 'bg-mint'}`} style={{ width: `${Math.min(100, (cost / budget) * 100)}%` }} />
              </div>
              <div className="text-xs">{usd(budget)}/tháng</div>
            </>
          ) : (
            <div className="text-xs text-muted" title="Hỏi người cầm tiền trong buổi khảo sát">
              chưa biết: hãy hỏi khách
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button className="btn" onClick={() => setStage('discovery')} data-testid="open-discovery">
          <MessagesSquare size={16} /> Khảo sát
        </button>
        <button
          className="btn !px-2"
          title="Gợi ý"
          onClick={() => {
            if (level.hints.length === 0) return;
            notify(`Gợi ý ${(hint % level.hints.length) + 1}/${level.hints.length}: ${level.hints[hint % level.hints.length]}`);
            setHint((h) => h + 1);
          }}
        >
          <Lightbulb size={16} />
        </button>
        <button
          className="btn !px-2"
          title="Làm lại từ đầu"
          onClick={() => {
            if (window.confirm('Xoá thiết kế và câu hỏi đã hỏi của level này?')) reset();
          }}
        >
          <RotateCcw size={16} />
        </button>
        <button className="btn btn-primary text-xl" onClick={onRun} disabled={running} data-testid="run">
          <Play size={18} /> {running ? 'Đang chạy…' : 'Chạy'}
        </button>
      </div>
    </header>
  );
}
