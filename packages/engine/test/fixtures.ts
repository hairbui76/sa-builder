import type { ComponentDef, Design, DesignNode, Level } from '../src/types';

const m = { aws: 'a', azure: 'z', gcp: 'g', onprem: 'o' };

export const catalog: Record<string, ComponentDef> = Object.fromEntries(
  (
    [
      { type: 'users', title: 'Users', category: 'entry', icon: 'users', summary: '', behavior: 'entry', tiers: [{ id: 'u', title: 'U', capacity: 0, latencyMs: 0, monthlyUsd: 0 }], mapping: m },
      { type: 'lb', title: 'LB', category: 'edge', icon: 'lb', summary: '', behavior: 'router', tiers: [{ id: 's', title: 'S', capacity: 0, latencyMs: 1, monthlyUsd: 20 }], mapping: m, flags: ['lb'] },
      { type: 'gw', title: 'Gateway', category: 'edge', icon: 'door', summary: '', behavior: 'router', tiers: [{ id: 's', title: 'S', capacity: 0, latencyMs: 4, monthlyUsd: 30 }], settings: { tenantQuota: true }, mapping: m },
      { type: 'waf', title: 'WAF', category: 'security', icon: 'shield', summary: '', behavior: 'router', tiers: [{ id: 's', title: 'S', capacity: 0, latencyMs: 2, monthlyUsd: 25 }], props: { blocksMalicious: 0.9 }, flags: ['waf'], mapping: m },
      { type: 'app', title: 'App', category: 'compute', icon: 'server', summary: '', behavior: 'compute', tiers: [{ id: 's', title: 'S', capacity: 100, latencyMs: 20, monthlyUsd: 15 }], settings: { count: { min: 1, max: 10 }, region: true }, mapping: m },
      { type: 'db', title: 'DB', category: 'data', icon: 'db', summary: '', behavior: 'provider', provides: ['sql_read', 'sql_write'], tiers: [{ id: 's', title: 'S', capacity: 1000, latencyMs: 5, monthlyUsd: 30 }], props: { stateful: true }, settings: { standby: true, region: true, encryption: true }, mapping: m },
      { type: 'cache', title: 'Cache', category: 'cache', icon: 'bolt', summary: '', behavior: 'cache', provides: ['sql_read'], routePriority: { sql_read: 2 }, tiers: [{ id: 's', title: 'S', capacity: 0, latencyMs: 1, monthlyUsd: 15, hitRatio: 0.8 }], props: { holdsData: true }, mapping: m },
      { type: 'queue', title: 'Queue', category: 'messaging', icon: 'queue', summary: '', behavior: 'queue', provides: ['job'], tiers: [{ id: 's', title: 'S', capacity: 0, latencyMs: 3, monthlyUsd: 5 }], props: { holdsData: true }, mapping: m },
      { type: 'worker', title: 'Worker', category: 'compute', icon: 'cog', summary: '', behavior: 'worker', tiers: [{ id: 's', title: 'S', capacity: 50, latencyMs: 0, monthlyUsd: 15 }], settings: { count: { min: 1, max: 10 } }, mapping: m },
      { type: 'erp', title: 'ERP', category: 'integration', icon: 'factory', summary: '', behavior: 'provider', provides: ['erp'], tiers: [{ id: 's', title: 'S', capacity: 2, latencyMs: 500, monthlyUsd: 0 }], props: { stateful: true, onPrem: true }, mapping: m },
      { type: 'vpn', title: 'VPN', category: 'integration', icon: 'link', summary: '', behavior: 'link', tiers: [{ id: 's', title: 'S', capacity: 0, latencyMs: 20, monthlyUsd: 40 }], flags: ['hybrid_link'], mapping: m },
      { type: 'saas', title: 'Mail SaaS', category: 'saas', icon: 'mail', summary: '', behavior: 'provider', provides: ['notify'], tiers: [{ id: 's', title: 'S', capacity: 0, latencyMs: 100, monthlyUsd: 10 }], props: { external: true, fixedRegion: 'us' }, mapping: m },
      { type: 'kms', title: 'KMS', category: 'security', icon: 'key', summary: '', behavior: 'attachment', tiers: [{ id: 's', title: 'S', capacity: 0, latencyMs: 0, monthlyUsd: 5 }], flags: ['kms'], mapping: m },
    ] as ComponentDef[]
  ).map((d) => [d.type, d]),
);

export function node(id: string, type: string, settings: DesignNode['settings'] = {}): DesignNode {
  return { id, type, x: 0, y: 0, settings };
}

export function makeLevel(over: Partial<Level> = {}): Level {
  return {
    id: 'test',
    worldId: 'w',
    order: 1,
    title: 'Test',
    client: 'C',
    brief: '',
    difficulty: 1,
    conceptKeys: [],
    team: { size: 2, skills: ['sql'], devMonthlyUsd: 3000, baseMonths: 1 },
    regions: [
      { id: 'vn', title: 'VN', priceMultiplier: 1.2 },
      { id: 'sg', title: 'SG', priceMultiplier: 1 },
    ],
    defaultRegion: 'sg',
    regionLatencyMs: { 'sg|vn': 30, 'us|vn': 200, 'sg|us': 170 },
    fixedNodes: [{ ...node('users', 'users', { region: 'vn' }), fixed: true }],
    traffic: {
      ticks: 20,
      kinds: [{ id: 'read', title: 'Đọc', from: 'users', userFacing: true, calls: [{ family: 'sql_read', count: 2 }] }],
      phases: [{ from: 0, to: 20, rates: { read: 100 } }],
    },
    events: [],
    palette: Object.keys(catalog)
      .filter((t) => t !== 'users')
      .map((type) => ({ type })),
    limits: { maxNodes: 20, maxEdges: 40 },
    discovery: { hours: 4, stakeholders: [], questions: [], facts: [] },
    decisions: [],
    rules: [
      { id: 'answered', check: 'metric', metric: 'answered_pct:read', op: '>=', value: 99, unit: '%', text: 'Đọc ≥ 99%', failText: 'Rớt request', pillar: 'reliability', hard: true },
    ],
    stars: {},
    hints: [],
    ...over,
  };
}

export function design(nodes: DesignNode[], edges: [string, string][], extra: Partial<Design> = {}): Design {
  return {
    nodes,
    edges: edges.map(([from, to], i) => ({ id: `e${i}`, from, to })),
    decisions: {},
    asked: [],
    ...extra,
  };
}

export const usersNode = () => ({ ...node('users', 'users', { region: 'vn' }), fixed: true });
