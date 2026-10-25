import type { Compiled } from './compile';
import type { Analysis, Design, EncryptionLevel, Level, Rule } from './types';
import { clamp, round } from './util';

export interface RuleOutcome {
  passed: boolean;
  /** 0..1: 1 when passed, partial credit up to 0.5 when close. */
  score: number;
  actual?: string;
  nodeIds?: string[];
}

export interface RuleContext {
  level: Level;
  design: Design;
  compiled: Compiled;
  analysis: Analysis;
}

const ENC_ORDER: Record<EncryptionLevel, number> = { none: 0, at_rest: 1, kms: 2 };

export function formatValue(v: number, unit?: string): string {
  switch (unit) {
    case '$':
      return '$' + round(v, 2).toLocaleString('en-US', { maximumFractionDigits: 2 });
    case '%':
      return `${round(v, 2)}%`;
    case 'ms':
      return `${round(v, 0)} ms`;
    case 's':
      return `${round(v, 0)} s`;
    case 'min':
      return `${round(v, 0)} phút`;
    case 'months':
      return `${round(v, 1)} tháng`;
    default:
      return `${round(v, 2)}`;
  }
}

export function checkRule(rule: Rule, ctx: RuleContext): RuleOutcome {
  const { compiled, analysis, design } = ctx;
  const label = (id: string) => compiled.nodes[id]?.label ?? id;

  switch (rule.check) {
    case 'metric': {
      const v = analysis.metrics[rule.metric];
      if (v === undefined) return { passed: false, score: 0, actual: 'không đo được' };
      const eps = 1e-9;
      const passed = rule.op === '<=' ? v <= rule.value + eps : v >= rule.value - eps;
      let score = 1;
      if (!passed) {
        const ratio = rule.op === '<=' ? (v === 0 ? 0 : rule.value / v) : rule.value === 0 ? 0 : v / rule.value;
        score = 0.5 * clamp(ratio, 0, 1);
      }
      return { passed, score, actual: formatValue(v, rule.unit), nodeIds: passed ? undefined : metricNodes(rule.metric, ctx) };
    }
    case 'residency': {
      const bad = analysis.touched[rule.tag].filter((id) => {
        const cn = compiled.nodes[id];
        const p = cn.def.props ?? {};
        const keeps = p.stateful || p.holdsData || p.external;
        return keeps && !rule.regions.includes(cn.region);
      });
      return {
        passed: bad.length === 0,
        score: bad.length === 0 ? 1 : 0,
        actual: bad.length === 0 ? 'Đạt' : `Nằm ngoài vùng cho phép: ${bad.map(label).join(', ')}`,
        nodeIds: bad,
      };
    }
    case 'encryption': {
      const hasKms = analysis.flags.includes('kms');
      const bad = analysis.touched[rule.tag].filter((id) => {
        const cn = compiled.nodes[id];
        const p = cn.def.props ?? {};
        if (!(p.stateful || p.holdsData) || p.external || p.onPrem || !cn.def.settings?.encryption) return false;
        let lvl: EncryptionLevel = cn.node.settings.encryption ?? 'none';
        if (lvl === 'kms' && !hasKms) lvl = 'at_rest';
        return ENC_ORDER[lvl] < ENC_ORDER[rule.level];
      });
      return {
        passed: bad.length === 0,
        score: bad.length === 0 ? 1 : 0,
        actual: bad.length === 0 ? 'Đạt' : `Chưa đủ mã hoá: ${bad.map(label).join(', ')}`,
        nodeIds: bad,
      };
    }
    case 'on_path': {
      const missing: string[] = [];
      for (const k of rule.kinds) {
        const r = compiled.routes[k];
        if (!r || r.delivered <= 0 || (r.flagFrac[rule.flag] ?? 0) / r.delivered < 0.999) {
          missing.push(ctx.level.traffic.kinds.find((x) => x.id === k)?.title ?? k);
        }
      }
      return {
        passed: missing.length === 0,
        score: missing.length === 0 ? 1 : 0,
        actual: missing.length === 0 ? 'Đạt' : `Chưa đi qua: ${missing.join(', ')}`,
      };
    }
    case 'isolation': {
      const shared = compiled.order.filter((id) => {
        const p = compiled.nodes[id].def.props ?? {};
        if (!(p.stateful || p.holdsData) || p.external) return false;
        const ks = compiled.kindsByNode[id] ?? [];
        return ks.includes(rule.kind) && ks.some((k) => rule.from.includes(k));
      });
      return {
        passed: shared.length === 0,
        score: shared.length === 0 ? 1 : 0,
        actual: shared.length === 0 ? 'Đạt' : `Dùng chung: ${shared.map(label).join(', ')}`,
        nodeIds: shared,
      };
    }
    case 'flag': {
      const has = analysis.flags.includes(rule.flag);
      const passed = has === rule.present;
      return { passed, score: passed ? 1 : 0, actual: has ? 'Có' : 'Không có' };
    }
    case 'decision': {
      const choice = design.decisions[rule.decision];
      const passed = !!choice && rule.options.includes(choice);
      const dec = ctx.level.decisions.find((d) => d.id === rule.decision);
      const opt = dec?.options.find((o) => o.id === choice);
      return { passed, score: passed ? 1 : 0, actual: opt ? opt.title : 'Chưa chọn' };
    }
  }
}

/** Nodes to point at on the board when a metric rule fails. */
function metricNodes(metric: string, ctx: RuleContext): string[] | undefined {
  const { compiled, analysis } = ctx;
  if (metric === 'scope_card' || metric === 'scope_pii') {
    const tag = metric === 'scope_card' ? 'card' : 'pii';
    return analysis.touched[tag].filter((id) => !compiled.nodes[id].def.props?.external);
  }
  if (metric.startsWith('peak_util_pct:')) {
    const type = metric.slice('peak_util_pct:'.length);
    return compiled.order.filter((id) => compiled.nodes[id].def.type === type);
  }
  return undefined;
}
