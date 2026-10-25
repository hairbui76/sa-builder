import { describe, expect, it } from 'vitest';
import { evaluate, levelSchema, designSchema, componentDefSchema, type EvalResult } from '@sa/engine';
import { catalog, catalogList, conceptByKey, levelExamples, levels } from '../src';

function summary(r: EvalResult): string {
  const failed = r.goals.filter((g) => !g.passed).map((g) => `${g.ruleId}=${g.actual}`);
  const errs = r.reasons.filter((x) => x.severity === 'error').map((x) => `${x.code}: ${x.text}`);
  return `stars=${r.stars} overall=${r.overall} monthly=${r.analysis.monthlyUsd} tco=${r.analysis.tco3yUsd} cal=${r.analysis.calendarMonths}\nfailed: ${failed.join(' | ')}\nerrors: ${errs.join(' | ')}`;
}

describe('catalog', () => {
  it('every component parses', () => {
    for (const c of catalogList) expect(componentDefSchema.safeParse(c).success, c.type).toBe(true);
  });
  it('every concept key referenced by components exists', () => {
    for (const c of catalogList) for (const k of c.conceptKeys ?? []) expect(conceptByKey[k], `${c.type}:${k}`).toBeTruthy();
  });
});

describe.each(levels.map((l) => [l.id, l] as const))('level %s', (_id, level) => {
  const ex = levelExamples[level.id];

  it('parses and references valid content', () => {
    const parsed = levelSchema.safeParse(level);
    expect(parsed.success, JSON.stringify(parsed.error?.issues?.slice(0, 3))).toBe(true);
    for (const p of level.palette) expect(catalog[p.type], p.type).toBeTruthy();
    for (const n of level.fixedNodes) expect(catalog[n.type], n.type).toBeTruthy();
    const factIds = new Set(level.discovery.facts.map((f) => f.id));
    for (const q of level.discovery.questions) for (const f of q.reveals ?? []) expect(factIds.has(f), f).toBe(true);
    for (const r of level.rules) if (r.hiddenUntil) expect(factIds.has(r.hiddenUntil), r.hiddenUntil).toBe(true);
    const ruleIds = new Set(level.rules.map((r) => r.id));
    for (const s of level.discovery.stakeholders) for (const c of s.concerns) expect(ruleIds.has(c), `${s.id}:${c}`).toBe(true);
    for (const k of [...level.conceptKeys, ...level.rules.map((r) => r.conceptKey).filter(Boolean)]) expect(conceptByKey[k as string], k).toBeTruthy();
    const hours = level.discovery.questions.filter((q) => ex.reference.asked.includes(q.id)).reduce((s, q) => s + q.hours, 0);
    expect(hours).toBeLessThanOrEqual(level.discovery.hours);
  });

  it('reference design passes with at least 2 stars', () => {
    expect(designSchema.safeParse(ex.reference).success).toBe(true);
    const r = evaluate(level, ex.reference, catalog);
    expect(r.passed, summary(r)).toBe(true);
    expect(r.stars, summary(r)).toBeGreaterThanOrEqual(2);
  });

  it.each(ex.naive.map((n) => [n.name, n] as const))('naive "%s" fails as expected', (_name, n) => {
    const r = evaluate(level, n.design, catalog);
    expect(r.passed, summary(r)).toBe(false);
    for (const m of n.mustFail) {
      const hit = r.goals.some((g) => g.ruleId === m && !g.passed) || r.reasons.some((x) => x.code === m);
      expect(hit, `${m}\n${summary(r)}`).toBe(true);
    }
  });

  it('is deterministic', () => {
    expect(evaluate(level, ex.reference, catalog)).toEqual(evaluate(level, ex.reference, catalog));
  });
});
