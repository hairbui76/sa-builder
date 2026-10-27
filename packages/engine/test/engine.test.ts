import { describe, expect, it } from 'vitest';
import { compile } from '../src/compile';
import { evaluate } from '../src/evaluate';
import { canConnect } from '../src/graph';
import { levelSchema } from '../src/schema';
import { simulate } from '../src/simulate';
import { powApprox } from '../src/util';
import { catalog, design, makeLevel, node, usersNode } from './fixtures';

describe('graph', () => {
  it('only links reach on-prem systems', () => {
    expect(canConnect(catalog.app, catalog.erp)).toBe(false);
    expect(canConnect(catalog.vpn, catalog.erp)).toBe(true);
    expect(canConnect(catalog.users, catalog.db)).toBe(false);
    expect(canConnect(catalog.queue, catalog.worker)).toBe(true);
  });
});

describe('util', () => {
  it('powApprox is exact on integers and linear on the fraction', () => {
    expect(powApprox(0.5, 2)).toBe(0.25);
    expect(powApprox(0, 0.5)).toBe(0.5);
    expect(powApprox(1, 3.7)).toBe(1);
  });
});

describe('compile', () => {
  it('splits traffic across instances behind a load balancer', () => {
    const level = makeLevel();
    const d = design(
      [usersNode(), node('lb', 'lb'), node('a1', 'app'), node('a2', 'app'), node('db', 'db')],
      [
        ['users', 'lb'],
        ['lb', 'a1'],
        ['lb', 'a2'],
        ['a1', 'db'],
        ['a2', 'db'],
      ],
    );
    const c = compile(level, d, catalog);
    const r = c.routes.read;
    expect(r.ok).toBe(true);
    expect(r.visits.a1).toBeCloseTo(0.5);
    expect(r.visits.a2).toBeCloseTo(0.5);
    expect(r.visits.db).toBeCloseTo(2);
  });

  it('cache hits shield the database', () => {
    const level = makeLevel();
    const d = design(
      [usersNode(), node('app', 'app'), node('c', 'cache'), node('db', 'db')],
      [
        ['users', 'app'],
        ['app', 'c'],
        ['app', 'db'],
        ['c', 'db'],
      ],
    );
    const r = compile(level, d, catalog).routes.read;
    expect(r.visits.c).toBeCloseTo(2);
    expect(r.visits.db).toBeCloseTo(0.4);
  });

  it('reports no_path when nothing serves a call, without throwing', () => {
    const level = makeLevel();
    const c = compile(level, design([usersNode(), node('app', 'app')], [['users', 'app']]), catalog);
    expect(c.routes.read.ok).toBe(false);
    expect(c.issues.some((i) => i.code === 'no_path')).toBe(true);
  });

  it('ignores invalid and dangling edges with a warning', () => {
    const level = makeLevel();
    const d = design([usersNode(), node('db', 'db')], [
      ['users', 'db'],
      ['users', 'ghost'],
    ]);
    const c = compile(level, d, catalog);
    expect(c.issues.filter((i) => i.code === 'invalid_edge')).toHaveLength(2);
  });

  it('an empty design evaluates without throwing', () => {
    const level = makeLevel();
    const res = evaluate(level, design([usersNode()], []), catalog);
    expect(res.passed).toBe(false);
    expect(res.sim.perKind.read.answeredPct).toBe(0);
  });

  it('counts only one instance when users hit a scaled app directly', () => {
    const level = makeLevel();
    const d = design([usersNode(), node('app', 'app', { count: 3 }), node('db', 'db')], [
      ['users', 'app'],
      ['app', 'db'],
    ]);
    const c = compile(level, d, catalog);
    expect(c.nodes.app.count).toBe(1);
    expect(c.issues.some((i) => i.code === 'single_address')).toBe(true);
  });
});

describe('simulate', () => {
  const basic = (count: number, extra: Parameters<typeof makeLevel>[0] = {}, dbSettings = {}) => {
    const level = makeLevel(extra);
    const d = design(
      [usersNode(), node('lb', 'lb'), node('app', 'app', { count }), node('db', 'db', dbSettings)],
      [
        ['users', 'lb'],
        ['lb', 'app'],
        ['app', 'db'],
      ],
    );
    return { level, d, c: compile(level, d, catalog) };
  };

  it('an overload ratio of 2 answers about half', () => {
    const { level, c } = basic(1, {
      traffic: {
        ticks: 10,
        kinds: [{ id: 'read', title: 'Đọc', from: 'users', userFacing: true, calls: [{ family: 'sql_read', count: 1 }] }],
        phases: [{ from: 0, to: 10, rates: { read: 200 } }],
      },
    });
    const s = simulate(level, c);
    expect(s.perKind.read.answeredPct).toBeCloseTo(50, 0);
  });

  it('a standby database fails over quickly; without one requests are lost', () => {
    const events = [{ kind: 'node_down' as const, at: 5, targetType: 'db', text: 'DB chết' }];
    const withStandby = basic(2, { events }, { standby: true });
    const without = basic(2, { events });
    const a = simulate(withStandby.level, withStandby.c).perKind.read.answeredPct;
    const b = simulate(without.level, without.c).perKind.read.answeredPct;
    expect(a).toBeGreaterThanOrEqual(80);
    expect(b).toBeLessThan(30);
  });

  it('a queue lets workers drain jobs at the rate the provider allows', () => {
    const level = makeLevel({
      traffic: {
        ticks: 60,
        kinds: [
          {
            id: 'order',
            title: 'Đặt hàng',
            from: 'users',
            userFacing: true,
            calls: [{ family: 'job', count: 1 }],
            jobCalls: [{ family: 'erp', count: 1 }],
          },
        ],
        phases: [
          { from: 0, to: 10, rates: { order: 5 } },
          { from: 10, to: 60, rates: { order: 0 } },
        ],
      },
      rules: [{ id: 'x', check: 'flag', flag: 'hybrid_link', present: true, text: '', failText: '', pillar: 'ops', hard: true }],
    });
    const d = design(
      [usersNode(), node('app', 'app'), node('q', 'queue'), node('w', 'worker'), node('vpn', 'vpn'), node('erp', 'erp')],
      [
        ['users', 'app'],
        ['app', 'q'],
        ['q', 'w'],
        ['w', 'vpn'],
        ['vpn', 'erp'],
      ],
    );
    const s = simulate(level, compile(level, d, catalog));
    expect(s.perKind.order.answeredPct).toBe(100);
    expect(s.jobs.order.total).toBeCloseTo(50);
    expect(s.jobs.order.done).toBeCloseTo(50);
    // 50 jobs at 2/s: the last one waits about 15 s.
    expect(s.jobs.order.maxWaitS).toBeGreaterThanOrEqual(14);
    expect(s.jobs.order.maxWaitS).toBeLessThanOrEqual(26);
  });

  it('a WAF blocks most malicious traffic', () => {
    const level = makeLevel({
      traffic: {
        ticks: 10,
        kinds: [{ id: 'atk', title: 'Tấn công', from: 'users', userFacing: false, malicious: true, calls: [] }],
        phases: [{ from: 0, to: 10, rates: { atk: 10 } }],
      },
    });
    const withWaf = design([usersNode(), node('waf', 'waf'), node('app', 'app')], [
      ['users', 'waf'],
      ['waf', 'app'],
    ]);
    const noWaf = design([usersNode(), node('app', 'app')], [['users', 'app']]);
    expect(simulate(level, compile(level, withWaf, catalog)).breachPct).toBeCloseTo(10);
    expect(simulate(level, compile(level, noWaf, catalog)).breachPct).toBe(100);
  });

  it('adds latency for hops across regions', () => {
    const near = basic(1, {}, { region: 'vn' });
    near.d.nodes.find((n) => n.id === 'app')!.settings.region = 'vn';
    const far = basic(1);
    const a = simulate(near.level, compile(near.level, near.d, catalog)).perKind.read.avgLatencyMs;
    const b = simulate(far.level, far.c).perKind.read.avgLatencyMs;
    expect(b - a).toBeGreaterThanOrEqual(25);
  });

  it('is deterministic', () => {
    const { level, c } = basic(2);
    expect(simulate(level, c)).toEqual(simulate(level, c));
  });
});

describe('evaluate', () => {
  const level = makeLevel({
    traffic: {
      ticks: 20,
      kinds: [{ id: 'read', title: 'Đọc', from: 'users', userFacing: true, carries: ['pii'], calls: [{ family: 'sql_read', count: 1 }] }],
      phases: [{ from: 0, to: 20, rates: { read: 50 } }],
    },
    rules: [
      { id: 'answered', check: 'metric', metric: 'answered_pct:read', op: '>=', value: 99, unit: '%', text: 'Đọc ≥ 99%', failText: 'Rớt', pillar: 'reliability', hard: true },
      { id: 'residency', check: 'residency', tag: 'pii', regions: ['vn'], text: 'Dữ liệu ở VN', failText: 'Dữ liệu ra nước ngoài', pillar: 'security', hard: true },
    ],
  });
  const build = (region: string) =>
    design(
      [usersNode(), node('app', 'app', { region }), node('db', 'db', { region })],
      [
        ['users', 'app'],
        ['app', 'db'],
      ],
    );

  it('a residency violation fails the level and points at the stores', () => {
    const r = evaluate(level, build('sg'), catalog);
    expect(r.passed).toBe(false);
    expect(r.goals.find((g) => g.ruleId === 'residency')?.nodeIds).toContain('db');
  });

  it('passes and earns stars when the requirement is met', () => {
    const r = evaluate(level, build('vn'), catalog);
    expect(r.passed).toBe(true);
    expect(r.stars).toBeGreaterThanOrEqual(2);
  });

  it('palette violations block passing', () => {
    const l2 = makeLevel({ palette: [{ type: 'app' }] });
    const r = evaluate(l2, design([usersNode(), node('app', 'app'), node('db', 'db')], [['users', 'app'], ['app', 'db']]), catalog);
    expect(r.passed).toBe(false);
    expect(r.reasons.some((x) => x.code === 'not_in_palette')).toBe(true);
  });

  it('fixture level satisfies the schema', () => {
    expect(levelSchema.safeParse(level).success).toBe(true);
    const bad = { ...level, rules: [{ ...level.rules[0], check: 'nope' }] };
    expect(levelSchema.safeParse(bad).success).toBe(false);
  });
});
