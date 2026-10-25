import type { Compiled } from './compile';
import type { Level, Phase, SimEvent, SimResult } from './types';
import { powApprox, round } from './util';

/** Ticks a node with a hot standby is unavailable during failover. */
export const FAILOVER_TICKS = 3;
const UNLIMITED = Number.POSITIVE_INFINITY;

export function rateAt(phases: Phase[], kindId: string, t: number): number {
  for (const p of phases) {
    if (t >= p.from && t < p.to) {
      const a = p.rates[kindId] ?? 0;
      const b = p.ratesTo?.[kindId];
      if (b === undefined || p.to - p.from <= 1) return a;
      return a + ((b - a) * (t - p.from)) / (p.to - p.from - 1);
    }
  }
  return 0;
}

/** Latency multiplier from utilization: gentle until ~70 %, steep near saturation. */
export function queueFactor(util: number): number {
  const r = util > 0.95 ? 0.95 : util < 0 ? 0 : util;
  return 1 + (r * r * r) / (1 - r);
}

interface NodeState {
  lost: number;
  until: number;
  slow: number;
  slowUntil: number;
}

function matchNode(compiled: Compiled, ev: { targetId?: string; targetType?: string }): string | undefined {
  if (ev.targetId && compiled.nodes[ev.targetId]) return ev.targetId;
  if (ev.targetType) return compiled.order.find((id) => compiled.nodes[id].def.type === ev.targetType);
  return undefined;
}

export function simulate(level: Level, compiled: Compiled): SimResult {
  const ticks = level.traffic.ticks;
  const kinds = level.traffic.kinds;
  const ids = compiled.order;
  const state: Record<string, NodeState> = {};
  for (const id of ids) state[id] = { lost: 0, until: 0, slow: 1, slowUntil: 0 };

  const nodeAcc: Record<string, { peak: number; opsSum: number; utilSum: number; utilTicks: number; down: number }> = {};
  for (const id of ids) nodeAcc[id] = { peak: 0, opsSum: 0, utilSum: 0, utilTicks: 0, down: 0 };

  const kindAcc: Record<string, { offered: number; answered: number; latSum: number; pct: number[]; lat: number[] }> = {};
  for (const k of kinds) kindAcc[k.id] = { offered: 0, answered: 0, latSum: 0, pct: [], lat: [] };

  // FIFO cohorts of jobs per (kind, job route).
  interface JobFlow {
    kindId: string;
    route: Compiled['routes'][string]['jobs'][number];
    cohorts: { t: number; n: number }[];
    total: number;
    done: number;
    maxWait: number;
  }
  const flows: JobFlow[] = [];
  for (const k of kinds) {
    for (const j of compiled.routes[k.id]?.jobs ?? []) {
      flows.push({ kindId: k.id, route: j, cohorts: [], total: 0, done: 0, maxWait: 0 });
    }
  }

  let attacks = 0;
  let breaches = 0;
  const eventsFired: { at: number; text: string }[] = [];

  const applyEvent = (ev: SimEvent, t: number) => {
    eventsFired.push({ at: t, text: ev.text });
    const id = matchNode(compiled, ev);
    if (!id) return;
    const cn = compiled.nodes[id];
    const s = state[id];
    if (ev.kind === 'node_down') {
      const lost = ev.instances === undefined ? cn.count : Math.min(cn.count, ev.instances);
      const standby = !!cn.node.settings.standby && !!cn.def.settings?.standby;
      const duration = standby ? FAILOVER_TICKS : ev.duration ?? ticks;
      s.lost = lost;
      s.until = t + duration;
    } else {
      s.slow = ev.factor;
      s.slowUntil = t + (ev.duration ?? ticks);
    }
  };

  for (let t = 0; t < ticks; t++) {
    for (const ev of level.events) if (ev.at === t) applyEvent(ev, t);
    for (const id of ids) {
      const s = state[id];
      if (s.lost > 0 && t >= s.until) s.lost = 0;
      if (s.slow !== 1 && t >= s.slowUntil) s.slow = 1;
    }

    const healthy = (id: string) => compiled.nodes[id].count - state[id].lost;
    const capOf = (id: string) => {
      const h = healthy(id);
      if (h <= 0) return 0;
      const c = compiled.nodes[id].tier.capacity;
      return c <= 0 ? UNLIMITED : c * h;
    };

    // 1. Synchronous demand.
    const effRate: Record<string, number> = {};
    const demand: Record<string, number> = {};
    for (const id of ids) demand[id] = 0;
    for (const k of kinds) {
      const r = rateAt(level.traffic.phases, k.id, t);
      const route = compiled.routes[k.id];
      const eff = route?.quotaCapped && k.quotaRps !== undefined ? Math.min(r, k.quotaRps) : r;
      effRate[k.id] = eff;
      if (!route) continue;
      for (const [id, w] of Object.entries(route.visits)) demand[id] += eff * w;
    }

    const served: Record<string, number> = {};
    const latency: Record<string, number> = {};
    const spare: Record<string, number> = {};
    for (const id of ids) {
      const cap = capOf(id);
      const d = demand[id];
      const util = cap === UNLIMITED ? 0 : cap === 0 ? (d > 0 ? Number.POSITIVE_INFINITY : 0) : d / cap;
      served[id] = cap === 0 ? 0 : util <= 1 ? 1 : 1 / util;
      latency[id] = compiled.nodes[id].tier.latencyMs * state[id].slow * queueFactor(util);
      spare[id] = cap === UNLIMITED ? UNLIMITED : Math.max(0, cap - d);
    }

    // 2. Per-kind outcome.
    const success: Record<string, number> = {};
    for (const k of kinds) {
      const route = compiled.routes[k.id];
      const rate = rateAt(level.traffic.phases, k.id, t);
      const eff = effRate[k.id];
      let p = route ? 1 - route.lostFrac : 0;
      let lat = route ? route.hopLatencyMs : 0;
      if (route) {
        for (const [id, w] of Object.entries(route.visits)) {
          p *= powApprox(served[id], w);
          lat += w * latency[id];
        }
      }
      success[k.id] = p;
      const ans = eff * p;
      const acc = kindAcc[k.id];
      acc.offered += rate;
      acc.answered += ans;
      acc.latSum += lat * ans;
      acc.pct.push(rate > 0 ? round((ans / rate) * 100, 1) : 100);
      acc.lat.push(round(lat, 0));
      if (k.malicious && route) {
        attacks += rate;
        breaches += eff * route.breach;
      }
    }

    // 3. Jobs drain through workers using whatever capacity is left.
    const asyncDemand: Record<string, number> = {};
    for (const f of flows) {
      const inflow = effRate[f.kindId] * success[f.kindId] * f.route.perRequest;
      if (inflow > 0) {
        f.cohorts.push({ t, n: inflow });
        f.total += inflow;
      }
      if (!f.route.ok) continue;
      let canDo = Number.POSITIVE_INFINITY;
      for (const [id, w] of Object.entries(f.route.visits)) {
        if (w <= 0) continue;
        canDo = Math.min(canDo, spare[id] / w);
      }
      let budget = Math.min(canDo, f.cohorts.reduce((s, c) => s + c.n, 0));
      if (!(budget > 0)) continue;
      for (const [id, w] of Object.entries(f.route.visits)) {
        const use = budget * w;
        if (spare[id] !== UNLIMITED) spare[id] -= use;
        asyncDemand[id] = (asyncDemand[id] ?? 0) + use;
      }
      while (budget > 1e-9 && f.cohorts.length > 0) {
        const c = f.cohorts[0];
        const take = Math.min(c.n, budget);
        c.n -= take;
        budget -= take;
        f.done += take;
        if (t - c.t > f.maxWait) f.maxWait = t - c.t;
        if (c.n <= 1e-9) f.cohorts.shift();
      }
    }

    for (const id of ids) {
      const ops = demand[id] + (asyncDemand[id] ?? 0);
      const cap = capOf(id);
      const acc = nodeAcc[id];
      acc.opsSum += ops;
      if (healthy(id) <= 0) acc.down++;
      if (cap !== UNLIMITED) {
        const u = cap === 0 ? (ops > 0 ? 10 : 0) : ops / cap;
        if (u > acc.peak) acc.peak = u;
        acc.utilSum += u > 1 ? 1 : u;
        acc.utilTicks++;
      }
    }
  }

  const perKind: SimResult['perKind'] = {};
  for (const k of kinds) {
    const a = kindAcc[k.id];
    perKind[k.id] = {
      offered: round(a.offered, 2),
      answered: round(a.answered, 2),
      answeredPct: a.offered > 0 ? round((a.answered / a.offered) * 100, 2) : 100,
      avgLatencyMs: a.answered > 0 ? round(a.latSum / a.answered, 0) : 0,
      series: { answeredPct: a.pct, latencyMs: a.lat },
    };
  }

  const jobs: SimResult['jobs'] = {};
  for (const f of flows) {
    const prev = jobs[f.kindId];
    // Jobs still waiting at the end have waited since their cohort arrived.
    let wait = f.maxWait;
    for (const c of f.cohorts) if (c.n > 1e-6 && ticks - c.t > wait) wait = ticks - c.t;
    const total = (prev?.total ?? 0) + f.total;
    const done = (prev?.done ?? 0) + f.done;
    jobs[f.kindId] = {
      total: round(total, 2),
      done: round(done, 2),
      donePct: total > 0 ? round((done / total) * 100, 2) : 100,
      maxWaitS: Math.max(prev?.maxWaitS ?? 0, wait),
    };
  }

  const nodes: SimResult['nodes'] = {};
  for (const id of ids) {
    const a = nodeAcc[id];
    nodes[id] = {
      peakUtil: round(a.peak, 3),
      avgOps: round(a.opsSum / ticks, 3),
      avgUtil: a.utilTicks > 0 ? round(a.utilSum / a.utilTicks, 3) : 0,
      downTicks: a.down,
    };
  }

  return {
    ticks,
    perKind,
    jobs,
    nodes,
    breachPct: attacks > 0 ? round((breaches / attacks) * 100, 2) : 0,
    eventsFired,
  };
}
