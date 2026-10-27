'use client';
import { create } from 'zustand';
import { canConnect, type Design, type EvalResult, type Level, type NodeSettings } from '@sa/engine';
import { catalog } from '@sa/content';
import { defaultSettings, emptyDesign, nextNodeId } from '@/lib/design';
import { layeredLayout } from '@/lib/layout';

export type Stage = 'design' | 'review';
export type RightTab = 'components' | 'decisions' | 'inspect';

interface Toast {
  id: number;
  text: string;
  kind: 'info' | 'error' | 'ok';
}

interface GameState {
  level: Level | null;
  design: Design;
  selected: string | null;
  stage: Stage;
  tab: RightTab;
  result: EvalResult | null;
  /** Design changed since the last run: the result no longer describes the board. */
  stale: boolean;
  running: boolean;
  toast: Toast | null;
  /** Bumped when the board should re-fit its view. */
  viewVersion: number;

  init(level: Level, design: Design): void;
  setStage(s: Stage): void;
  setTab(t: RightTab): void;
  select(id: string | null): void;
  addNode(type: string, pos?: { x: number; y: number }): void;
  moveNode(id: string, x: number, y: number): void;
  updateSettings(id: string, patch: Partial<NodeSettings>): void;
  removeNode(id: string): void;
  connect(from: string, to: string): void;
  removeEdge(id: string): void;
  choose(decisionId: string, optionId: string): void;
  setRunning(v: boolean): void;
  setResult(r: EvalResult): void;
  reset(): void;
  arrange(): void;
  notify(text: string, kind?: Toast['kind']): void;
}

let toastSeq = 0;

export const useGame = create<GameState>((set, get) => {
  const change = (fn: (d: Design) => Design) => set((s) => ({ design: fn(s.design), stale: true }));

  return {
    level: null,
    design: { nodes: [], edges: [], decisions: {} },
    selected: null,
    stage: 'design',
    tab: 'components',
    result: null,
    stale: true,
    running: false,
    toast: null,
    viewVersion: 0,

    init(level, design) {
      set({ level, design, selected: null, stage: 'design', tab: 'components', result: null, stale: true, running: false });
    },
    setStage: (stage) => set({ stage }),
    setTab: (tab) => set({ tab }),
    select: (id) => set((s) => ({ selected: id, tab: id ? 'inspect' : s.tab === 'inspect' ? 'components' : s.tab })),

    addNode(type, pos) {
      const { level, design } = get();
      const def = catalog[type];
      if (!level || !def) return;
      const pal = level.palette.find((p) => p.type === type);
      const count = design.nodes.filter((n) => n.type === type && !n.fixed).length;
      if (pal?.max !== undefined && count >= pal.max) {
        get().notify(`Level này chỉ cho tối đa ${pal.max} ${def.title}.`, 'error');
        return;
      }
      const playerNodes = design.nodes.filter((n) => !n.fixed).length;
      if (playerNodes >= level.limits.maxNodes) {
        get().notify(`Level này cho tối đa ${level.limits.maxNodes} thành phần.`, 'error');
        return;
      }
      const id = nextNodeId(design, type);
      const p = pos ?? { x: 380 + ((playerNodes * 47) % 300), y: 220 + ((playerNodes * 83) % 260) };
      change((d) => ({ ...d, nodes: [...d.nodes, { id, type, x: p.x, y: p.y, settings: defaultSettings(level, def) }] }));
      // Keep the palette open so several components can be added in a row.
      set({ selected: id });
    },

    moveNode(id, x, y) {
      // Positions do not affect the evaluation, so moving does not make the result stale.
      set((s) => ({ design: { ...s.design, nodes: s.design.nodes.map((n) => (n.id === id ? { ...n, x, y } : n)) } }));
    },

    updateSettings(id, patch) {
      change((d) => ({ ...d, nodes: d.nodes.map((n) => (n.id === id ? { ...n, settings: { ...n.settings, ...patch } } : n)) }));
    },

    removeNode(id) {
      const n = get().design.nodes.find((x) => x.id === id);
      if (!n || n.fixed) return;
      change((d) => ({
        ...d,
        nodes: d.nodes.filter((x) => x.id !== id),
        edges: d.edges.filter((e) => e.from !== id && e.to !== id),
      }));
      set((s) => ({ selected: s.selected === id ? null : s.selected, tab: s.selected === id ? 'components' : s.tab }));
    },

    connect(from, to) {
      const { design, level } = get();
      if (!level || from === to) return;
      const a = design.nodes.find((n) => n.id === from);
      const b = design.nodes.find((n) => n.id === to);
      if (!a || !b) return;
      const da = catalog[a.type];
      const db = catalog[b.type];
      if (!canConnect(da, db)) {
        const why = db.props?.onPrem
          ? `${b.label ?? db.title} nằm on-prem: chỉ nối được qua VPN hoặc đường truyền riêng.`
          : `${a.label ?? da.title} không gọi được ${b.label ?? db.title}.`;
        get().notify(why, 'error');
        return;
      }
      if (design.edges.some((e) => e.from === from && e.to === to)) return;
      if (design.edges.length >= level.limits.maxEdges) {
        get().notify(`Level này cho tối đa ${level.limits.maxEdges} kết nối.`, 'error');
        return;
      }
      change((d) => ({ ...d, edges: [...d.edges, { id: `e_${from}_${to}`, from, to }] }));
    },

    removeEdge(id) {
      change((d) => ({ ...d, edges: d.edges.filter((e) => e.id !== id) }));
    },

    choose(decisionId, optionId) {
      change((d) => ({ ...d, decisions: { ...d.decisions, [decisionId]: optionId } }));
    },

    setRunning: (running) => set({ running }),
    setResult: (result) => set({ result, stale: false, stage: 'review' }),

    reset() {
      const { level } = get();
      if (!level) return;
      set({ design: emptyDesign(level), selected: null, result: null, stale: true, stage: 'design', tab: 'components' });
    },

    arrange() {
      set((s) => ({ design: layeredLayout(s.design, catalog), viewVersion: s.viewVersion + 1 }));
    },

    notify(text, kind = 'info') {
      const id = ++toastSeq;
      set({ toast: { id, text, kind } });
      setTimeout(() => {
        if (get().toast?.id === id) set({ toast: null });
      }, 3500);
    },
  };
});
