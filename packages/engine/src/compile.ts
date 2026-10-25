import { canConnect } from './graph';
import type {
  ComponentDef,
  DataTag,
  Design,
  DesignNode,
  Level,
  Reason,
  TierDef,
  TrafficKind,
} from './types';
import { regionKey } from './util';

export interface CNode {
  id: string;
  label: string;
  def: ComponentDef;
  node: DesignNode;
  tier: TierDef;
  /** Instances that actually receive traffic. */
  count: number;
  region: string;
  /** False for components without a location of their own (LB, WAF…): they add no hop latency. */
  regional: boolean;
}

export interface JobRoute {
  queueId: string;
  /** Jobs enqueued per request. */
  perRequest: number;
  /** Operations per job at each node. */
  visits: Record<string, number>;
  ok: boolean;
}

export interface Route {
  kindId: string;
  ok: boolean;
  /** Share of requests that have no path at all. */
  lostFrac: number;
  /** Operations per request at each node. */
  visits: Record<string, number>;
  hopLatencyMs: number;
  edgeServed: number;
  /** Malicious share stopped by a blocking node. */
  blocked: number;
  /** Malicious share that reached application code. */
  breach: number;
  /** Share of delivered requests whose path crossed a node with tenant quota on. */
  quotaFrac: number;
  /** Share of delivered requests whose ingress path crossed a node with each flag. */
  flagFrac: Record<string, number>;
  delivered: number;
  jobs: JobRoute[];
}

export interface Compiled {
  nodes: Record<string, CNode>;
  order: string[];
  routes: Record<string, Route>;
  issues: Reason[];
  touched: Record<DataTag, string[]>;
  /** Traffic kinds (non-malicious) that touch each node. */
  kindsByNode: Record<string, string[]>;
}

/** Issues that make a design invalid for scoring. */
export const BLOCKING_CODES = new Set(['not_in_palette', 'palette_max', 'limit_nodes', 'limit_edges', 'unknown_type', 'cycle']);

const MAX_DEPTH = 24;

export function nodeRegion(level: Level, def: ComponentDef, node: DesignNode): string {
  if (def.props?.fixedRegion) return def.props.fixedRegion;
  if (def.props?.onPrem) return 'onprem';
  const r = node.settings.region;
  // Only components with a region setting can move, and only to a region the level offers.
  // Entries are placed by the level itself, so their region is trusted as given.
  if (def.behavior === 'entry' && r) return r;
  return def.settings?.region && r && level.regions.some((x) => x.id === r) ? r : level.defaultRegion;
}

export function compile(level: Level, design: Design, catalog: Record<string, ComponentDef>): Compiled {
  const issues: Reason[] = [];
  const nodes: Record<string, CNode> = {};
  const order: string[] = [];
  const paletteByType = new Map(level.palette.map((p) => [p.type, p]));
  const typeCounts = new Map<string, number>();
  const fixedIds = new Set(level.fixedNodes.map((n) => n.id));

  const playerNodes = design.nodes.filter((n) => !fixedIds.has(n.id));
  if (playerNodes.length > level.limits.maxNodes) {
    issues.push({
      code: 'limit_nodes',
      severity: 'error',
      text: `Thiết kế có ${playerNodes.length} thành phần, level chỉ cho tối đa ${level.limits.maxNodes}.`,
    });
  }
  if (design.edges.length > level.limits.maxEdges) {
    issues.push({
      code: 'limit_edges',
      severity: 'error',
      text: `Thiết kế có ${design.edges.length} kết nối, level chỉ cho tối đa ${level.limits.maxEdges}.`,
    });
  }

  for (const n of design.nodes) {
    const def = catalog[n.type];
    if (!def) {
      issues.push({ code: 'unknown_type', severity: 'error', text: `Không biết thành phần "${n.type}".`, nodeId: n.id });
      continue;
    }
    const isFixed = fixedIds.has(n.id);
    const pal = paletteByType.get(n.type);
    if (!isFixed && !pal) {
      issues.push({
        code: 'not_in_palette',
        severity: 'error',
        text: `${def.title} không có trong bộ thành phần của level này.`,
        nodeId: n.id,
      });
      continue;
    }
    const c = (typeCounts.get(n.type) ?? 0) + 1;
    typeCounts.set(n.type, c);
    if (!isFixed && pal?.max !== undefined && c > pal.max) {
      issues.push({
        code: 'palette_max',
        severity: 'error',
        text: `Level chỉ cho tối đa ${pal.max} ${def.title}.`,
        nodeId: n.id,
      });
    }
    const allowedTiers = def.tiers.filter((t) => !pal?.tiers || pal.tiers.includes(t.id));
    let tier = allowedTiers.find((t) => t.id === n.settings.tier) ?? allowedTiers[0] ?? def.tiers[0];
    if (n.settings.tier && tier.id !== n.settings.tier) {
      issues.push({
        code: 'tier_not_allowed',
        severity: 'warn',
        text: `Tier ${n.settings.tier} của ${def.title} không dùng được ở level này, đã dùng ${tier.title}.`,
        nodeId: n.id,
      });
    }
    const countSetting = def.settings?.count;
    const count = countSetting
      ? Math.max(countSetting.min, Math.min(countSetting.max, Math.floor(n.settings.count ?? countSetting.min)))
      : 1;
    nodes[n.id] = {
      id: n.id,
      label: n.label ?? def.title,
      def,
      node: n,
      tier,
      count,
      region: nodeRegion(level, def, n),
      regional: !!(def.settings?.region || def.props?.fixedRegion || def.props?.onPrem || def.behavior === 'entry'),
    };
    order.push(n.id);
  }

  // Adjacency, keeping only wires that can carry traffic.
  const outs: Record<string, string[]> = {};
  const ins: Record<string, string[]> = {};
  for (const id of order) {
    outs[id] = [];
    ins[id] = [];
  }
  const seenEdges = new Set<string>();
  for (const e of design.edges) {
    const a = nodes[e.from];
    const b = nodes[e.to];
    if (!a || !b) {
      issues.push({ code: 'invalid_edge', severity: 'warn', text: 'Một kết nối trỏ tới thành phần không tồn tại, đã bỏ qua.' });
      continue;
    }
    if (!canConnect(a.def, b.def)) {
      issues.push({
        code: 'invalid_edge',
        severity: 'warn',
        text: `Không thể nối ${a.label} → ${b.label}, kết nối này bị bỏ qua.`,
        nodeId: b.id,
      });
      continue;
    }
    const key = `${e.from}->${e.to}`;
    if (seenEdges.has(key)) continue;
    seenEdges.add(key);
    outs[e.from].push(e.to);
    ins[e.to].push(e.from);
  }

  // Several instances reached straight from users without a router: users only know one address.
  for (const id of order) {
    const cn = nodes[id];
    if (cn.def.behavior === 'compute' && cn.count > 1 && ins[id].some((p) => nodes[p].def.behavior === 'entry')) {
      issues.push({
        code: 'single_address',
        severity: 'warn',
        text: `Users chỉ biết một địa chỉ của ${cn.label}: ${cn.count} instance nhưng chỉ một instance nhận traffic. Đặt Load Balancer phía trước.`,
        nodeId: id,
        conceptKey: 'load_balancing',
      });
      cn.count = 1;
    }
  }

  const hasType = (t: string) => order.some((id) => nodes[id].def.type === t);
  for (const id of order) {
    const cn = nodes[id];
    if (cn.def.type === 'read_replica' && !hasType('relational_db')) {
      issues.push({
        code: 'replica_without_primary',
        severity: 'error',
        text: 'Read Replica cần một Relational DB làm primary để sao chép dữ liệu.',
        nodeId: id,
      });
    }
    if (cn.node.settings.encryption === 'kms' && !order.some((x) => nodes[x].def.flags?.includes('kms'))) {
      issues.push({
        code: 'kms_missing',
        severity: 'warn',
        text: `${cn.label} chọn mã hoá bằng KMS nhưng thiết kế chưa có KMS: coi như chỉ mã hoá mặc định.`,
        nodeId: id,
        conceptKey: 'encryption_kms',
      });
    }
  }

  // A wire loop never carries meaningful traffic and would make routing explode: refuse it up front.
  const cycleAt = findCycle(order, outs);
  if (cycleAt) {
    issues.push({
      code: 'cycle',
      severity: 'error',
      text: `Các kết nối tạo thành vòng lặp qua ${nodes[cycleAt].label}: request sẽ chạy vòng mãi. Bỏ bớt một kết nối.`,
      nodeId: cycleAt,
      conceptKey: 'request_flow',
    });
  }
  const skipRouting = !!cycleAt || issues.some((i) => i.code === 'limit_nodes' || i.code === 'limit_edges');

  const latBetween = (a: string, b: string) => (a === b ? 0 : level.regionLatencyMs[regionKey(a, b)] ?? 0);

  const touched: Record<DataTag, Set<string>> = { pii: new Set(), card: new Set() };
  const kindsByNode: Record<string, Set<string>> = {};
  const routes: Record<string, Route> = {};
  const failedKinds = new Set<string>();

  for (const kind of level.traffic.kinds) {
    const route: Route = {
      kindId: kind.id,
      ok: true,
      lostFrac: 0,
      visits: {},
      hopLatencyMs: 0,
      edgeServed: 0,
      blocked: 0,
      breach: 0,
      quotaFrac: 0,
      flagFrac: {},
      delivered: 0,
      jobs: [],
    };
    routes[kind.id] = route;

    const fail = (text: string, nodeId?: string) => {
      route.ok = false;
      if (!failedKinds.has(kind.id)) {
        failedKinds.add(kind.id);
        issues.push({
          code: 'no_path',
          severity: 'error',
          text: `${kind.title}: ${text}`,
          nodeId,
          conceptKey: 'request_flow',
        });
      }
    };

    const touch = (id: string, tags: DataTag[]) => {
      if (kind.malicious) return;
      for (const t of tags) touched[t].add(id);
      (kindsByNode[id] ??= new Set()).add(kind.id);
    };

    const servesFamily = (id: string, family: string, depth: number): boolean => {
      const d = nodes[id].def;
      if (d.behavior === 'link') return depth < MAX_DEPTH && outs[id].some((o) => servesFamily(o, family, depth + 1));
      if (d.behavior === 'cache') {
        // Read-through: a cache only takes a family it can fall back on for misses.
        return !!d.provides?.includes(family) && depth < MAX_DEPTH && outs[id].some((o) => servesFamily(o, family, depth + 1));
      }
      if (d.behavior === 'provider' || d.behavior === 'queue') return !!d.provides?.includes(family);
      return false;
    };

    interface Sink {
      visits: Record<string, number>;
      hop: { ms: number };
      ok: { v: boolean };
    }

    const routeCall = (
      fromId: string,
      family: string,
      weight: number,
      reqFrac: number,
      fromRegion: string,
      tags: DataTag[],
      sink: Sink,
      mode: 'sync' | 'job',
      depth: number,
    ) => {
      if (weight <= 0) return;
      if (depth > MAX_DEPTH) {
        sink.ok.v = false;
        fail('đường gọi bị vòng lặp.', fromId);
        return;
      }
      const cands = outs[fromId].filter((o) => servesFamily(o, family, depth));
      if (cands.length === 0) {
        sink.ok.v = false;
        if (mode === 'sync' && branchLost) branchLost.v += reqFrac;
        fail(`${nodes[fromId].label} không có nơi xử lý "${family}".`, fromId);
        return;
      }
      const prio = (id: string) => nodes[id].def.routePriority?.[family] ?? 0;
      const best = Math.max(...cands.map(prio));
      const chosen = cands.filter((c) => prio(c) === best);
      const share = weight / chosen.length;
      const reqShare = reqFrac / chosen.length;
      for (const id of chosen) {
        const cn = nodes[id];
        sink.visits[id] = (sink.visits[id] ?? 0) + share;
        const here = cn.regional ? cn.region : fromRegion;
        sink.hop.ms += share * latBetween(fromRegion, here);
        touch(id, tags);
        const b = cn.def.behavior;
        if (b === 'cache') {
          const missRatio = 1 - (cn.tier.hitRatio ?? 0);
          if (missRatio > 0) routeCall(id, family, share * missRatio, reqShare * missRatio, here, tags, sink, mode, depth + 1);
        } else if (b === 'link') {
          routeCall(id, family, share, reqShare, here, tags, sink, mode, depth + 1);
        } else if (b === 'queue' && mode === 'sync') {
          route.jobs.push(routeJob(id, share, here, tags));
        }
      }
    };

    const routeJob = (queueId: string, perRequest: number, queueRegion: string, tags: DataTag[]): JobRoute => {
      const job: JobRoute = { queueId, perRequest, visits: {}, ok: true };
      const workers = outs[queueId].filter((o) => nodes[o].def.behavior === 'worker');
      if (workers.length === 0) {
        job.ok = false;
        fail(`${nodes[queueId].label} không có Worker nào lấy job ra xử lý.`, queueId);
        return job;
      }
      const sink: Sink = { visits: job.visits, hop: { ms: 0 }, ok: { v: true } };
      for (const w of workers) {
        const share = 1 / workers.length;
        job.visits[w] = (job.visits[w] ?? 0) + share;
        touch(w, tags);
        const wRegion = nodes[w].regional ? nodes[w].region : queueRegion;
        for (const call of kind.jobCalls ?? []) routeCall(w, call.family, share * call.count, share, wRegion, tags, sink, 'job', 1);
      }
      job.ok = sink.ok.v;
      return job;
    };

    const syncSink: Sink = { visits: route.visits, hop: { ms: 0 }, ok: { v: true } };
    /** Requests of the current compute branch that some call could not complete (counted once per branch). */
    let branchLost: { v: number } | null = null;

    const acceptsIngress = (id: string) => {
      const d = nodes[id].def;
      if (d.behavior === 'router' || d.behavior === 'edge_cache' || d.behavior === 'compute') return true;
      return d.behavior === 'provider' && !!kind.target && !!d.ingress?.includes(kind.target);
    };

    const ingress = (id: string, frac: number, tags: DataTag[], prevRegion: string, flags: string[], quota: boolean, depth: number) => {
      if (frac <= 0) return;
      const cn = nodes[id];
      if (depth > MAX_DEPTH) {
        fail('đường đi bị vòng lặp.', id);
        route.lostFrac += frac;
        return;
      }
      const b = cn.def.behavior;
      const here = cn.regional ? cn.region : prevRegion;
      if (b !== 'entry') {
        route.visits[id] = (route.visits[id] ?? 0) + frac;
        route.hopLatencyMs += frac * latBetween(prevRegion, here);
        touch(id, tags);
      }
      if (kind.malicious && cn.def.props?.blocksMalicious) {
        const blocked = frac * cn.def.props.blocksMalicious;
        route.blocked += blocked;
        frac -= blocked;
      }
      const nextTags = cn.def.props?.strips ? tags.filter((t) => !cn.def.props!.strips!.includes(t)) : tags;
      const nextFlags = cn.def.flags ? [...flags, ...cn.def.flags] : flags;
      const nextQuota = quota || (!!cn.node.settings.tenantQuota && !!cn.def.settings?.tenantQuota);

      if (b === 'entry' || b === 'router' || b === 'edge_cache') {
        if (b === 'edge_cache' && kind.edgeCacheable) {
          const hit = frac * (cn.tier.hitRatio ?? 0);
          route.edgeServed += hit;
          deliver(hit, nextFlags, nextQuota);
          frac -= hit;
        }
        const accepting = outs[id].filter(acceptsIngress);
        // Prefer a store that serves this target directly, then an edge cache for cacheable kinds.
        const score = (n: string) => {
          const d = nodes[n].def;
          if (d.behavior === 'provider') return 3;
          if (d.behavior === 'edge_cache' && kind.edgeCacheable) return 2;
          return 1;
        };
        const top = accepting.length > 0 ? Math.max(...accepting.map(score)) : 0;
        const next = accepting.filter((n) => score(n) === top);
        if (next.length === 0) {
          route.lostFrac += frac;
          fail(`từ ${cn.label} không có đường đi tiếp.`, id);
          return;
        }
        for (const n of next) ingress(n, frac / next.length, nextTags, here, nextFlags, nextQuota, depth + 1);
        return;
      }
      if (b === 'compute') {
        if (kind.malicious) route.breach += frac;
        deliver(frac, nextFlags, nextQuota);
        branchLost = { v: 0 };
        for (const call of kind.calls) routeCall(id, call.family, frac * call.count, frac, here, nextTags, syncSink, 'sync', 1);
        route.lostFrac += Math.min(frac, branchLost.v);
        branchLost = null;
        return;
      }
      if (b === 'provider') {
        if (kind.malicious && cn.def.props?.stateful) route.breach += frac;
        deliver(frac, nextFlags, nextQuota);
        return;
      }
      route.lostFrac += frac;
      fail(`${cn.label} không nhận request từ người dùng.`, id);
    };

    const deliver = (frac: number, flags: string[], quota: boolean) => {
      route.delivered += frac;
      if (quota) route.quotaFrac += frac;
      for (const f of new Set(flags)) route.flagFrac[f] = (route.flagFrac[f] ?? 0) + frac;
    };

    const entry = nodes[kind.from];
    if (skipRouting) {
      route.ok = false;
      route.lostFrac = 1;
    } else if (!entry) {
      route.ok = false;
      route.lostFrac = 1;
      fail('không tìm thấy nguồn traffic.');
    } else {
      ingress(entry.id, 1, kind.carries ?? [], entry.region, [], false, 0);
    }
    route.hopLatencyMs += syncSink.hop.ms;
    if (!syncSink.ok.v) route.ok = false;
    route.lostFrac = Math.min(1, route.lostFrac);
  }

  return {
    nodes,
    order,
    routes,
    issues,
    touched: { pii: [...touched.pii], card: [...touched.card] },
    kindsByNode: Object.fromEntries(Object.entries(kindsByNode).map(([k, v]) => [k, [...v]])),
  };
}

export function kindById(level: Level, id: string): TrafficKind | undefined {
  return level.traffic.kinds.find((k) => k.id === id);
}

/** Returns a node on a directed cycle, if any (iterative DFS with colours). */
export function findCycle(order: string[], outs: Record<string, string[]>): string | undefined {
  const colour = new Map<string, 0 | 1 | 2>();
  for (const start of order) {
    if (colour.get(start)) continue;
    const stack: [string, number][] = [[start, 0]];
    colour.set(start, 1);
    while (stack.length) {
      const top = stack[stack.length - 1];
      const [id, i] = top;
      const next = outs[id]?.[i];
      if (next === undefined) {
        colour.set(id, 2);
        stack.pop();
        continue;
      }
      top[1] = i + 1;
      const c = colour.get(next) ?? 0;
      if (c === 1) return next;
      if (c === 0) {
        colour.set(next, 1);
        stack.push([next, 0]);
      }
    }
  }
  return undefined;
}
