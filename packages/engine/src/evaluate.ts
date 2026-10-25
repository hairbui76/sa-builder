import { analyze } from './analyze';
import { BLOCKING_CODES, compile } from './compile';
import { checkRule } from './rules';
import { simulate } from './simulate';
import type {
  ComponentDef,
  Design,
  EvalResult,
  Fact,
  GoalResult,
  Level,
  Pillar,
  Reason,
  Verdict,
} from './types';
import { PILLARS } from './types';
import { hashString, round } from './util';

export const ENGINE_VERSION = '0.1.0';
export const STAR2_SCORE = 70;
export const STAR3_SCORE = 85;
const FAILING_CODES = new Set([...BLOCKING_CODES, 'decision_missing', 'requirement_missing']);

export function evaluationId(level: Level): string {
  return `${ENGINE_VERSION}:${level.id}:${hashString(JSON.stringify(level))}`;
}

export function discoveredFacts(level: Level, design: Design): Set<string> {
  const out = new Set<string>();
  for (const q of level.discovery.questions) {
    if (design.asked.includes(q.id)) for (const f of q.reveals ?? []) out.add(f);
  }
  return out;
}

export function hoursUsed(level: Level, design: Design): number {
  return level.discovery.questions.filter((q) => design.asked.includes(q.id)).reduce((s, q) => s + q.hours, 0);
}

export function evaluate(level: Level, design: Design, catalog: Record<string, ComponentDef>): EvalResult {
  const compiled = compile(level, design, catalog);
  const sim = simulate(level, compiled);
  const { analysis, issues: analysisIssues } = analyze(level, design, compiled, sim);
  const discovered = discoveredFacts(level, design);

  const goals: GoalResult[] = level.rules.map((rule) => {
    const out = checkRule(rule, { level, design, compiled, analysis });
    return {
      ruleId: rule.id,
      text: rule.text,
      pillar: rule.pillar,
      hard: rule.hard,
      passed: out.passed,
      score: out.score,
      actual: out.actual,
      hidden: !!rule.hiddenUntil,
      discovered: !rule.hiddenUntil || discovered.has(rule.hiddenUntil),
      failText: out.passed ? undefined : rule.failText,
      conceptKey: rule.conceptKey,
      nodeIds: out.nodeIds,
    };
  });

  const keyFacts = level.discovery.facts.filter((f) => f.key);
  if (keyFacts.length > 0) {
    const found = keyFacts.filter((f) => discovered.has(f.id)).length;
    const score = found / keyFacts.length;
    goals.push({
      ruleId: '_discovery',
      text: 'Nắm được các yêu cầu quan trọng khi khảo sát',
      pillar: 'business',
      hard: false,
      passed: score >= 0.999,
      score,
      actual: `${found}/${keyFacts.length} yêu cầu quan trọng`,
      hidden: false,
      discovered: true,
      failText: score >= 0.999 ? undefined : 'Bạn bỏ lỡ một số yêu cầu quan trọng của khách hàng.',
      conceptKey: 'requirements_elicitation',
    });
  }

  // Pillar scores: weighted mean of the goals tagged with each pillar.
  const pillars = {} as Record<Pillar, number | null>;
  const weightOf = (g: GoalResult) => level.rules.find((r) => r.id === g.ruleId)?.weight ?? 1;
  for (const p of PILLARS) {
    const gs = goals.filter((g) => g.pillar === p);
    if (gs.length === 0) {
      pillars[p] = null;
      continue;
    }
    const w = gs.reduce((s, g) => s + weightOf(g), 0);
    pillars[p] = round((gs.reduce((s, g) => s + g.score * weightOf(g), 0) / w) * 100, 0);
  }
  const scored = PILLARS.map((p) => pillars[p]).filter((v): v is number => v !== null);
  const overall = scored.length > 0 ? round(scored.reduce((s, v) => s + v, 0) / scored.length, 0) : 0;

  const reasons: Reason[] = [...compiled.issues, ...analysisIssues, ...diagnose(level, compiled, sim)];
  for (const g of goals) {
    if (!g.passed && g.failText) {
      reasons.push({
        code: g.hard ? 'goal_failed' : 'goal_missed',
        severity: g.hard ? 'error' : 'warn',
        text: g.failText,
        nodeId: g.nodeIds?.[0],
        conceptKey: g.conceptKey,
      });
    }
  }
  reasons.sort((a, b) => sevRank(a.severity) - sevRank(b.severity));

  const blocked = reasons.some((r) => FAILING_CODES.has(r.code));
  const passed = !blocked && goals.every((g) => !g.hard || g.passed);
  let stars: 0 | 1 | 2 | 3 = 0;
  if (passed) {
    stars = 1;
    if (overall >= STAR2_SCORE) stars = 2;
    const tcoOk = level.stars.tco3yUsd === undefined || analysis.tco3yUsd <= level.stars.tco3yUsd;
    if (overall >= STAR3_SCORE && tcoOk) stars = 3;
  }

  const goalById = new Map(goals.map((g) => [g.ruleId, g]));
  const stakeholders: Verdict[] = level.discovery.stakeholders.map((s) => {
    const gs = s.concerns.map((c) => goalById.get(c)).filter((g): g is GoalResult => !!g);
    const score = gs.length > 0 ? gs.reduce((a, g) => a + g.score, 0) / gs.length : 1;
    const mood = score >= 0.9 ? 'happy' : score >= 0.6 ? 'neutral' : 'unhappy';
    return {
      stakeholderId: s.id,
      name: s.name,
      role: s.role,
      avatar: s.avatar,
      mood,
      quote: s.quotes[mood],
      score: round(score * 100, 0),
    };
  });

  const gating = new Set(
    level.rules.filter((r) => r.hiddenUntil && !goalById.get(r.id)?.passed).map((r) => r.hiddenUntil as string),
  );
  const missedFacts: Fact[] = level.discovery.facts.filter(
    (f) => !discovered.has(f.id) && (f.key || gating.has(f.id)),
  );

  return {
    evaluationId: evaluationId(level),
    passed,
    stars,
    overall,
    pillars,
    goals,
    stakeholders,
    reasons,
    missedFacts,
    sim,
    analysis,
  };
}

function sevRank(s: Reason['severity']): number {
  return s === 'error' ? 0 : s === 'warn' ? 1 : 2;
}

/** Turn simulation measurements into explanations attached to nodes. */
function diagnose(level: Level, compiled: ReturnType<typeof compile>, sim: ReturnType<typeof simulate>): Reason[] {
  const out: Reason[] = [];
  for (const id of compiled.order) {
    const cn = compiled.nodes[id];
    const n = sim.nodes[id];
    if (!n) continue;
    const failedOver = !!cn.node.settings.standby && !!cn.def.settings?.standby;
    if (n.downTicks > 0 && failedOver) {
      out.push({
        code: 'failover',
        severity: 'info',
        text: `${cn.label} chết nhưng standby đã lên thay sau ${n.downTicks} giây.`,
        nodeId: id,
        conceptKey: 'failover',
      });
    } else if (n.downTicks > 0) {
      out.push({
        code: 'node_down',
        severity: 'error',
        text: `${cn.label} không hoạt động trong ${n.downTicks} giây và không có gì thay thế kịp.`,
        nodeId: id,
        conceptKey: cn.def.settings?.standby ? 'failover' : 'single_point_of_failure',
      });
    }
    if (n.syncPeakUtil > 1.001 && n.downTicks === 0) {
      out.push({
        code: 'overloaded',
        severity: 'error',
        text: `${cn.label} quá tải: lúc đỉnh nhận ${round(n.syncPeakUtil * 100, 0)}% công suất, phần vượt bị từ chối.`,
        nodeId: id,
        conceptKey: cn.def.conceptKeys?.[0] ?? 'scale_out',
      });
    } else if (n.syncPeakUtil > 0.85 && n.downTicks === 0) {
      out.push({
        code: 'hot',
        severity: 'warn',
        text: `${cn.label} chạy tới ${round(n.syncPeakUtil * 100, 0)}% công suất lúc đỉnh: latency tăng mạnh.`,
        nodeId: id,
        conceptKey: cn.def.conceptKeys?.[0] ?? 'scale_out',
      });
    }
  }
  for (const [kindId, j] of Object.entries(sim.jobs)) {
    if (j.donePct < 99.99) {
      const k = level.traffic.kinds.find((x) => x.id === kindId);
      out.push({
        code: 'backlog',
        severity: 'warn',
        text: `${k?.title ?? kindId}: còn ${round(100 - j.donePct, 1)}% job chưa xử lý xong khi hết giờ.`,
        conceptKey: 'queue_buffering',
      });
    }
  }
  if (sim.breachPct > 0) {
    out.push({
      code: 'breach',
      severity: 'warn',
      text: `${round(sim.breachPct, 1)}% request tấn công lọt tới code ứng dụng.`,
      conceptKey: 'defence_in_depth',
    });
  }
  return out;
}
