'use client';
import { ArrowRight, Clock, MessageCircle, X } from 'lucide-react';
import { discoveredFacts, hoursUsed } from '@sa/engine';
import { useGame } from './store';

export function Discovery() {
  const level = useGame((s) => s.level)!;
  const design = useGame((s) => s.design);
  const { ask, setStage } = useGame.getState();
  const used = hoursUsed(level, design);
  const left = level.discovery.hours - used;
  const facts = discoveredFacts(level, design);

  return (
    <div className="dotted-bg fixed inset-0 z-40 overflow-y-auto" role="dialog" aria-label="Khảo sát">
      <div className="relative mx-auto max-w-6xl px-4 py-6">
        <div className="flex flex-col items-start gap-4 sm:flex-row">
          <div className="min-w-0 flex-1">
            <div className="text-sm text-muted">Bước 1 · Khảo sát</div>
            <h1 className="font-hand text-4xl">{level.client}</h1>
            <p className="mt-1 max-w-3xl text-ink-2">{level.story}</p>
          </div>
          <div className="sketch sketch-shadow p-3">
            <div className="flex items-center gap-1 text-sm text-muted">
              <Clock size={14} /> Giờ họp còn lại
            </div>
            <div className="font-hand text-3xl" data-testid="hours-left">
              {left.toLocaleString('vi-VN')} / {level.discovery.hours} giờ
            </div>
            <div className="mt-1 flex gap-0.5">
              {Array.from({ length: level.discovery.hours * 2 }, (_, i) => (
                <span key={i} className={`h-2 w-3 rounded-sm border border-ink ${i < left * 2 ? 'bg-mint' : 'bg-white'}`} />
              ))}
            </div>
          </div>
          <button className="btn btn-ghost absolute right-3 top-3 !px-2 sm:static" onClick={() => setStage('design')} title="Đóng">
            <X size={20} />
          </button>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_300px]">
          <div className="grid gap-4 md:grid-cols-2">
            {level.discovery.stakeholders.map((s) => {
              const qs = level.discovery.questions.filter((q) => q.stakeholder === s.id);
              return (
                <section key={s.id} className="sketch p-4">
                  <div className="flex items-center gap-3">
                    <span className="font-hand flex h-12 w-12 items-center justify-center rounded-full border-2 border-ink bg-lilac text-2xl">{s.avatar}</span>
                    <div>
                      <div className="font-hand text-2xl leading-none">{s.name}</div>
                      <div className="text-sm text-ink-2">{s.role}</div>
                    </div>
                  </div>
                  <p className="mt-2 text-sm italic text-ink-2">{s.intro}</p>
                  <ul className="mt-3 space-y-2">
                    {qs.map((q) => {
                      const asked = design.asked.includes(q.id);
                      const affordable = q.hours <= left + 1e-9;
                      return (
                        <li key={q.id}>
                          <button
                            disabled={asked || !affordable}
                            onClick={() => ask(q.id)}
                            data-testid={`ask-${q.id}`}
                            className={`flex w-full items-start gap-2 rounded-lg border-2 p-2 text-left text-sm ${asked ? 'border-ink bg-sky/30' : 'border-line bg-white hover:border-ink disabled:opacity-40'}`}
                          >
                            <MessageCircle size={15} className="mt-0.5 shrink-0" />
                            <span className="flex-1">{q.text}</span>
                            <span className="shrink-0 rounded-full border border-ink px-1.5 text-xs">{q.hours} giờ</span>
                          </button>
                          {asked && (
                            <div className="pop-in ml-6 mt-1 rounded-lg rounded-tl-none border-2 border-ink bg-note p-2 text-sm">
                              <b>{s.name}:</b> {q.answer}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
          </div>

          <aside className="note h-fit p-4 lg:sticky lg:top-6">
            <div className="font-hand text-2xl">Ghi chép của bạn</div>
            {facts.size === 0 ? (
              <p className="mt-1 text-sm text-ink-2">Chưa có gì. Mỗi câu hỏi tốn giờ họp; chọn người và câu hỏi thật kỹ.</p>
            ) : (
              <ul className="mt-2 list-disc space-y-1 pl-4 text-sm">
                {level.discovery.facts
                  .filter((f) => facts.has(f.id))
                  .map((f) => (
                    <li key={f.id} className="pop-in">
                      {f.text}
                    </li>
                  ))}
              </ul>
            )}
            <button className="btn btn-primary mt-4 w-full justify-center text-xl" onClick={() => setStage('design')} data-testid="start-design">
              Vào thiết kế <ArrowRight size={18} />
            </button>
            <p className="mt-2 text-xs text-ink-2">Bạn có thể quay lại đây bất cứ lúc nào để xem lại câu trả lời.</p>
          </aside>
        </div>
      </div>
    </div>
  );
}
