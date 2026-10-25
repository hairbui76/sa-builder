import { afterEach, describe, expect, it, vi } from 'vitest';
import { catalog, levelExamples, levels } from '@sa/content';
import { emptyDesign, loadDesign } from '@/lib/design';
import { handleRun, type RunDeps, type RunRecord } from '@/lib/runs';
import { safeStorage } from '@/lib/storage';

const level = levels[0];

describe('loadDesign', () => {
  it('returns an empty design with fixed nodes for garbage', () => {
    expect(loadDesign(level, catalog, 'nope')).toEqual(emptyDesign(level));
    expect(loadDesign(level, catalog, null).nodes.map((n) => n.id)).toEqual(level.fixedNodes.map((n) => n.id));
  });

  it('drops node types that are unknown or no longer in the palette, with their wires', () => {
    const ref = levelExamples[level.id].reference;
    const raw = {
      ...ref,
      nodes: [...ref.nodes, { id: 'ghost', type: 'quantum_db', x: 0, y: 0, settings: {} }, { id: 'kv', type: 'kv_store', x: 0, y: 0, settings: {} }],
      edges: [...ref.edges, { id: 'g', from: 'app', to: 'ghost' }, { id: 'k', from: 'app', to: 'kv' }],
      decisions: { not_a_decision: 'x' },
      asked: [...ref.asked, 'q_missing'],
    };
    const d = loadDesign(level, catalog, raw);
    expect(d.nodes.some((n) => n.id === 'ghost' || n.id === 'kv')).toBe(false);
    expect(d.edges.some((e) => e.to === 'ghost' || e.to === 'kv')).toBe(false);
    expect(d.decisions).toEqual({});
    expect(d.asked).toEqual(ref.asked);
  });

  it('restores fixed nodes even if a saved design removed them', () => {
    const d = loadDesign(level, catalog, { nodes: [], edges: [], decisions: {}, asked: [] });
    expect(d.nodes.find((n) => n.id === 'users')?.fixed).toBe(true);
  });
});

describe('safeStorage', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('never throws when storage is unavailable', () => {
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => {
          throw new Error('SecurityError');
        },
        setItem: () => {
          throw new Error('QuotaExceeded');
        },
        removeItem: () => {
          throw new Error('nope');
        },
      },
    });
    expect(safeStorage.get('a')).toBeNull();
    expect(safeStorage.set('a', 'b')).toBe(false);
    expect(safeStorage.getJson('a', 42)).toBe(42);
    expect(() => safeStorage.remove('a')).not.toThrow();
  });

  it('returns the fallback during SSR', () => {
    expect(safeStorage.getJson('x', 'fb')).toBe('fb');
  });
});

describe('handleRun', () => {
  const saved: RunRecord[] = [];
  const deps = (userId: string | null): RunDeps => ({
    currentUserId: async () => userId,
    saveRun: async (r) => {
      saved.push(r);
    },
  });

  it('answers 501 when Supabase is not configured', async () => {
    expect((await handleRun({ levelId: level.id, design: {} }, null)).status).toBe(501);
  });

  it('rejects malformed bodies and unknown levels', async () => {
    expect((await handleRun('x', deps('u1'))).status).toBe(400);
    expect((await handleRun({ levelId: 'nope', design: {} }, deps('u1'))).status).toBe(400);
  });

  it('requires a signed-in user', async () => {
    expect((await handleRun({ levelId: level.id, design: {} }, deps(null))).status).toBe(401);
  });

  it('re-evaluates on the server and stores the official result', async () => {
    const out = await handleRun({ levelId: level.id, design: levelExamples[level.id].reference }, deps('u1'));
    expect(out.status).toBe(200);
    expect(out.json.passed).toBe(true);
    expect(saved.at(-1)?.stars).toBe(out.json.stars);
    expect(saved.at(-1)?.userId).toBe('u1');
  });
});

describe('layeredLayout', () => {
  it('puts sources on top, followers below and attachments last', async () => {
    const { layeredLayout } = await import('@/lib/layout');
    const ref = levelExamples[level.id].reference;
    const d = layeredLayout(ref, catalog);
    const y = (id: string) => d.nodes.find((n) => n.id === id)!.y;
    expect(y('users')).toBe(0);
    expect(y('app')).toBeGreaterThan(y('users'));
    expect(y('db')).toBeGreaterThan(y('app'));
    expect(y('mon')).toBeGreaterThan(y('db'));
  });

  it('terminates on cycles', async () => {
    const { layeredLayout } = await import('@/lib/layout');
    const d = { nodes: [{ id: 'a', type: 'users', x: 0, y: 0, settings: {} }, { id: 'b', type: 'load_balancer', x: 0, y: 0, settings: {} }, { id: 'c', type: 'load_balancer', x: 0, y: 0, settings: {} }], edges: [{ id: '1', from: 'a', to: 'b' }, { id: '2', from: 'b', to: 'c' }, { id: '3', from: 'c', to: 'b' }], decisions: {}, asked: [] };
    expect(() => layeredLayout(d, catalog)).not.toThrow();
  });
});
