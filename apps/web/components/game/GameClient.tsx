'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { evaluate, type EvalResult } from '@sa/engine';
import { catalog, levels } from '@sa/content';
import { designKey, loadDesign } from '@/lib/design';
import { recordRun } from '@/lib/progress';
import { safeStorage } from '@/lib/storage';
import { browserClient } from '@/lib/supabase/browser';
import { Board } from './Board';
import { Discovery } from './Discovery';
import { GoalsPanel } from './GoalsPanel';
import { Header } from './Header';
import { Review } from './Review';
import { SidePanel } from './SidePanel';
import { useGame } from './store';

const RUN_MS = 1600;

export function GameClient({ levelId }: { levelId: string }) {
  const level = levels.find((l) => l.id === levelId)!;
  const ready = useGame((s) => s.level?.id === levelId);
  const design = useGame((s) => s.design);
  const stage = useGame((s) => s.stage);
  const result = useGame((s) => s.result);
  const running = useGame((s) => s.running);
  const toast = useGame((s) => s.toast);
  const [clock, setClock] = useState(0);
  const [verified, setVerified] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);

  useEffect(() => {
    if (window.matchMedia('(max-width: 767px)').matches) setPanelOpen(false);
  }, []);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load the saved design for this level (or a fresh one).
  useEffect(() => {
    const raw = safeStorage.getJson<unknown>(designKey(level.id), null);
    useGame.getState().init(level, loadDesign(level, catalog, raw));
  }, [level]);

  // Autosave, debounced.
  useEffect(() => {
    if (!ready) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => safeStorage.setJson(designKey(level.id), design), 300);
  }, [design, ready, level.id]);

  // Live estimate: positions do not matter, so ignore them to avoid re-running on every drag frame.
  const evalKey = useMemo(
    () => JSON.stringify([design.nodes.map((n) => [n.id, n.type, n.settings]), design.edges, design.decisions, design.asked]),
    [design],
  );
  const preview: EvalResult | null = useMemo(() => {
    if (!ready) return null;
    try {
      return evaluate(level, design, catalog);
    } catch {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evalKey, ready]);

  // Cancel a running animation when leaving the level, so it cannot report into another one.
  const frame = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      useGame.getState().setRunning(false);
    },
    [level.id],
  );

  const run = () => {
    const st = useGame.getState();
    if (st.running) return;
    st.setRunning(true);
    setVerified(null);
    const t0 = performance.now();
    const tick = () => {
      const f = Math.min(1, (performance.now() - t0) / RUN_MS);
      setClock(Math.round(f * level.traffic.ticks));
      if (f < 1) {
        frame.current = requestAnimationFrame(tick);
        return;
      }
      frame.current = null;
      const now = useGame.getState();
      if (now.level?.id !== level.id) return;
      // Score the board as it is now: edits made during the animation are included.
      const res = evaluate(level, now.design, catalog);
      now.setRunning(false);
      now.setResult(res);
      recordRun(level.id, res.stars, res.overall, res.passed);
      void submitOnline(level.id, now.design, setVerified);
    };
    frame.current = requestAnimationFrame(tick);
  };

  if (!ready) return <div className="dotted-bg flex h-screen items-center justify-center font-hand text-2xl">Đang mở hồ sơ khách hàng…</div>;

  const fired = (preview?.sim.eventsFired ?? []).filter((e) => e.at <= clock);

  return (
    <div className="flex h-screen flex-col">
      <Header preview={preview} onRun={run} />
      <div className="relative min-h-0 flex-1">
        <Board />
        <div className="pointer-events-none absolute left-3 top-3 z-10 hidden md:block">
          <div className="pointer-events-auto">
            <GoalsPanel />
          </div>
        </div>
        {panelOpen && (
          <div className="absolute bottom-16 right-3 top-3 z-10 w-[min(360px,calc(100vw-24px))] md:bottom-3">
            <SidePanel />
          </div>
        )}
        <button className="btn absolute bottom-3 right-3 z-20 md:hidden" onClick={() => setPanelOpen((v) => !v)}>
          {panelOpen ? 'Ẩn bảng' : 'Thành phần'}
        </button>
        {running && (
          <div className="absolute left-1/2 top-4 z-20 w-[min(460px,90vw)] -translate-x-1/2">
            <div className="sketch sketch-shadow p-3">
              <div className="font-hand text-xl">
                Đang mô phỏng: giây {clock}/{level.traffic.ticks}
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full border border-ink bg-white">
                <div className="h-full bg-sky-strong" style={{ width: `${(clock / level.traffic.ticks) * 100}%` }} />
              </div>
              {fired.map((e, i) => (
                <div key={i} className="pop-in mt-1 text-sm text-bad">
                  ⚡ Giây {e.at}: {e.text}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      {stage === 'discovery' && <Discovery />}
      {stage === 'review' && result && <Review result={result} level={level} verified={verified} />}
      {toast && (
        <div
          className={`pop-in fixed bottom-5 left-1/2 z-50 max-w-lg -translate-x-1/2 rounded-xl border-2 border-ink px-4 py-2 text-sm shadow-[3px_3px_0_0_#1f2328] ${toast.kind === 'error' ? 'bg-bad-soft' : toast.kind === 'ok' ? 'bg-ok-soft' : 'bg-note'}`}
          role="status"
        >
          {toast.text}
        </div>
      )}
    </div>
  );
}

/** When signed in, let the server re-run the engine and record the official result. */
async function submitOnline(levelId: string, design: unknown, setVerified: (s: string | null) => void) {
  const sb = browserClient();
  if (!sb) return;
  const { data } = await sb.auth.getUser();
  if (!data.user) return;
  try {
    const res = await fetch('/api/runs', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ levelId, design }),
    });
    if (res.ok) setVerified('Server đã chấm lại và ghi nhận kết quả lên bảng xếp hạng.');
  } catch {
    /* offline: the local result stands */
  }
}
