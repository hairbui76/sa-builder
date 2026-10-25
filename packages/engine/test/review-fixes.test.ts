import { describe, expect, it } from 'vitest';
import { compile } from '../src/compile';
import { answeredQuestions, discoveredFacts, evaluate } from '../src/evaluate';
import { simulate } from '../src/simulate';
import { catalog, design, makeLevel, node, usersNode } from './fixtures';

describe('regressions from the branch review', () => {
  it('rejects wire loops quickly instead of exploring them forever', () => {
    const level = makeLevel();
    const d = design(
      [usersNode(), node('a', 'lb'), node('b', 'lb'), node('c', 'lb'), node('d', 'lb'), node('app', 'app'), node('db', 'db')],
      [
        ['users', 'a'],
        ['a', 'b'], ['b', 'a'], ['a', 'c'], ['c', 'a'], ['b', 'c'], ['c', 'b'], ['c', 'd'], ['d', 'a'],
        ['d', 'app'],
        ['app', 'db'],
      ],
    );
    const t0 = performance.now();
    const r = evaluate(level, d, catalog);
    expect(performance.now() - t0).toBeLessThan(1000);
    expect(r.passed).toBe(false);
    expect(r.reasons.some((x) => x.code === 'cycle')).toBe(true);
  });

  it('an outage hits the node carrying traffic, not an idle spare', () => {
    const level = makeLevel({ events: [{ kind: 'node_down', at: 5, targetType: 'app', text: 'App chết' }] });
    const d = design([usersNode(), node('spare', 'app'), node('app', 'app'), node('db', 'db')], [
      ['users', 'app'],
      ['app', 'db'],
    ]);
    const s = simulate(level, compile(level, d, catalog));
    expect(s.nodes.app.downTicks).toBeGreaterThan(0);
    expect(s.nodes.spare.downTicks).toBe(0);
    expect(s.perKind.read.answeredPct).toBeLessThan(50);
  });

  it('ignores settings a component does not support and regions the level does not offer', () => {
    const level = makeLevel();
    const d = design([usersNode(), node('lb', 'lb', { tenantQuota: true }), node('app', 'app', { region: 'zz' }), node('db', 'db')], [
      ['users', 'lb'],
      ['lb', 'app'],
      ['app', 'db'],
    ]);
    const c = compile(level, d, catalog);
    expect(c.nodes.app.region).toBe(level.defaultRegion);
    expect(c.routes.read.quotaFrac).toBe(0);
  });

  it('counts only the questions that fit in the meeting hours', () => {
    const level = makeLevel({
      discovery: {
        hours: 1,
        stakeholders: [],
        questions: [
          { id: 'a', stakeholder: 's', text: '', hours: 1, answer: '', reveals: ['fa'] },
          { id: 'b', stakeholder: 's', text: '', hours: 1, answer: '', reveals: ['fb'] },
        ],
        facts: [
          { id: 'fa', text: '', key: true },
          { id: 'fb', text: '', key: true },
        ],
      },
    });
    const d = design([usersNode()], [], { asked: ['a', 'b', 'a'] });
    expect(answeredQuestions(level, d)).toEqual(['a']);
    expect([...discoveredFacts(level, d)]).toEqual(['fa']);
  });

  it('a request that misses several calls is lost once, not once per call', () => {
    const level = makeLevel({
      traffic: {
        ticks: 10,
        kinds: [{ id: 'read', title: 'Đọc', from: 'users', userFacing: true, calls: [{ family: 'sql_read', count: 1 }, { family: 'sql_write', count: 1 }] }],
        phases: [{ from: 0, to: 10, rates: { read: 50 } }],
      },
    });
    const d = design([usersNode(), node('lb', 'lb'), node('a1', 'app'), node('a2', 'app'), node('db', 'db')], [
      ['users', 'lb'],
      ['lb', 'a1'],
      ['lb', 'a2'],
      ['a1', 'db'],
    ]);
    const c = compile(level, d, catalog);
    expect(c.routes.read.lostFrac).toBeCloseTo(0.5);
    expect(simulate(level, c).perKind.read.answeredPct).toBeCloseTo(50, 0);
  });

  it('a tenant quota caps only the traffic that passes through it', () => {
    const level = makeLevel({
      traffic: {
        ticks: 10,
        kinds: [{ id: 'noisy', title: 'Ồn', from: 'users', userFacing: false, quotaRps: 10, calls: [{ family: 'sql_write', count: 1 }] }],
        phases: [{ from: 0, to: 10, rates: { noisy: 100 } }],
      },
    });
    const d = design([usersNode(), node('gw', 'gw', { tenantQuota: true }), node('app', 'app', { count: 1 }), node('db', 'db')], [
      ['users', 'gw'],
      ['users', 'app'],
      ['gw', 'app'],
      ['app', 'db'],
    ]);
    const s = simulate(level, compile(level, d, catalog));
    // Half bypasses the gateway (50 rps) and half is capped to 10 rps.
    expect(s.perKind.noisy.answeredPct).toBeCloseTo(60, 0);
  });
});
