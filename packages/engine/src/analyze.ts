import type { Compiled } from './compile';
import type { Analysis, CostLine, DataTag, Design, Level, Reason, SimResult } from './types';
import { round } from './util';

/** Seconds in a 30-day month divided by one million: ops/s → millions of ops per month. */
const MILLION_OPS_PER_MONTH_PER_RPS = 2.592;
/** Calendar months each unfamiliar technology adds while the team learns it. */
export const LEARNING_MONTHS_PER_TECH = 0.5;

export function analyze(
  level: Level,
  design: Design,
  compiled: Compiled,
  sim: SimResult,
): { analysis: Analysis; issues: Reason[] } {
  const issues: Reason[] = [];
  const costLines: CostLine[] = [];
  const regionMult = new Map(level.regions.map((r) => [r.id, r.priceMultiplier]));
  const presentTypes = new Set(compiled.order.map((id) => compiled.nodes[id].def.type));
  const flags = new Set<string>();
  const tech = new Set<string>();
  let opsMonthsPerYear = 0;

  for (const id of compiled.order) {
    const cn = compiled.nodes[id];
    for (const f of cn.def.flags ?? []) flags.add(f);
    for (const t of cn.def.tech ?? []) tech.add(t);
    opsMonthsPerYear += cn.def.opsMonthsPerYear ?? 0;
    const mult = cn.def.props?.external ? 1 : regionMult.get(cn.region) ?? 1;
    const instances = cn.def.settings?.count ? Math.max(cn.count, cn.node.settings.count ?? cn.count) : 1;
    let monthly = cn.tier.monthlyUsd * instances * mult;
    if (cn.node.settings.standby && cn.def.settings?.standby) monthly *= 2;
    const usage =
      (cn.tier.perMillionUsd ?? 0) *
      (sim.nodes[id]?.avgOps ?? 0) *
      MILLION_OPS_PER_MONTH_PER_RPS *
      (level.traffic.usageScale ?? 1);
    monthly += usage;
    if (monthly > 0) costLines.push({ label: cn.label, monthlyUsd: round(monthly, 2), nodeId: id });
  }

  let oneOffUsd = 0;
  let devMonths = 0;
  const metrics: Record<string, number> = {};
  for (const d of level.decisions) {
    const choice = design.decisions[d.id];
    const opt = d.options.find((o) => o.id === choice);
    if (!opt) {
      issues.push({
        code: 'decision_missing',
        severity: 'error',
        text: `Chưa chọn phương án cho "${d.title}".`,
        conceptKey: d.conceptKey,
      });
      continue;
    }
    const e = opt.effects;
    if (e.monthlyUsd) costLines.push({ label: `${d.title}: ${opt.title}`, monthlyUsd: e.monthlyUsd });
    oneOffUsd += e.oneOffUsd ?? 0;
    devMonths += e.devMonths ?? 0;
    for (const f of e.flags ?? []) flags.add(f);
    for (const t of e.tech ?? []) tech.add(t);
    for (const [k, v] of Object.entries(e.metrics ?? {})) metrics[k] = (metrics[k] ?? 0) + v;
    for (const req of opt.requires ?? []) {
      if (!presentTypes.has(req)) {
        issues.push({
          code: 'requirement_missing',
          severity: 'error',
          text: `Phương án "${opt.title}" cần có ${req} trên board.`,
          conceptKey: d.conceptKey,
        });
      }
    }
  }

  const monthlyUsd = round(costLines.reduce((s, l) => s + l.monthlyUsd, 0), 2);
  const opsDevMonths3y = round(opsMonthsPerYear * 3, 2);
  const tco3yUsd = round(monthlyUsd * 36 + oneOffUsd + (devMonths + opsDevMonths3y) * level.team.devMonthlyUsd, 0);
  const unfamiliarTech = [...tech].filter((t) => !level.team.skills.includes(t)).sort();
  const calendarMonths = round(
    level.team.baseMonths + devMonths / level.team.size + unfamiliarTech.length * LEARNING_MONTHS_PER_TECH,
    2,
  );

  const touched: Record<DataTag, string[]> = { pii: compiled.touched.pii, card: compiled.touched.card };
  const inScope = (tag: DataTag) => touched[tag].filter((id) => !compiled.nodes[id].def.props?.external).length;

  let utilSum = 0;
  let utilN = 0;
  for (const id of compiled.order) {
    const cn = compiled.nodes[id];
    if (cn.tier.capacity > 0 && (cn.def.behavior === 'compute' || cn.def.behavior === 'provider') && !cn.def.props?.external && !cn.def.props?.onPrem) {
      utilSum += sim.nodes[id]?.avgUtil ?? 0;
      utilN++;
    }
  }

  Object.assign(metrics, {
    monthly_usd: monthlyUsd,
    tco3y_usd: tco3yUsd,
    one_off_usd: oneOffUsd,
    dev_months: devMonths,
    calendar_months: calendarMonths,
    unfamiliar_tech: unfamiliarTech.length,
    scope_card: inScope('card'),
    scope_pii: inScope('pii'),
    breach_pct: sim.breachPct,
    fleet_util_pct: utilN > 0 ? round((utilSum / utilN) * 100, 1) : 0,
  });
  for (const id of compiled.order) {
    const key = `peak_util_pct:${compiled.nodes[id].def.type}`;
    const v = round((sim.nodes[id]?.peakUtil ?? 0) * 100, 1);
    if (v > (metrics[key] ?? -1)) metrics[key] = v;
  }
  for (const [k, v] of Object.entries(sim.perKind)) {
    metrics[`answered_pct:${k}`] = v.answeredPct;
    metrics[`latency_ms:${k}`] = v.avgLatencyMs;
  }
  for (const [k, v] of Object.entries(sim.jobs)) {
    metrics[`jobs_done_pct:${k}`] = v.donePct;
    metrics[`job_wait_s:${k}`] = v.maxWaitS;
  }

  return {
    analysis: {
      monthlyUsd,
      costLines: costLines.sort((a, b) => b.monthlyUsd - a.monthlyUsd),
      oneOffUsd,
      devMonths,
      opsDevMonths3y,
      tco3yUsd,
      calendarMonths,
      tech: [...tech].sort(),
      unfamiliarTech,
      flags: [...flags].sort(),
      touched,
      metrics,
    },
    issues,
  };
}
