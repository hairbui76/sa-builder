import { z } from 'zod';

const pillar = z.enum(['ops', 'security', 'reliability', 'performance', 'cost', 'sustainability', 'business', 'delivery']);
const dataTag = z.enum(['pii', 'card']);
const encryption = z.enum(['none', 'at_rest', 'kms']);

const tier = z.object({
  id: z.string(),
  title: z.string(),
  capacity: z.number().min(0),
  latencyMs: z.number().min(0),
  monthlyUsd: z.number().min(0),
  perMillionUsd: z.number().min(0).optional(),
  hitRatio: z.number().min(0).max(1).optional(),
});

export const componentDefSchema = z.object({
  type: z.string().regex(/^[a-z0-9_]+$/),
  title: z.string(),
  category: z.enum(['entry', 'edge', 'compute', 'data', 'cache', 'messaging', 'integration', 'security', 'saas', 'ops']),
  icon: z.string(),
  summary: z.string(),
  behavior: z.enum(['entry', 'router', 'edge_cache', 'compute', 'worker', 'provider', 'cache', 'queue', 'link', 'attachment']),
  tiers: z.array(tier).min(1),
  provides: z.array(z.string()).optional(),
  ingress: z.array(z.string()).optional(),
  routePriority: z.record(z.number()).optional(),
  props: z
    .object({
      stateful: z.boolean().optional(),
      holdsData: z.boolean().optional(),
      onPrem: z.boolean().optional(),
      external: z.boolean().optional(),
      fixedRegion: z.string().optional(),
      strips: z.array(dataTag).optional(),
      blocksMalicious: z.number().min(0).max(1).optional(),
    })
    .optional(),
  settings: z
    .object({
      count: z.object({ min: z.number().int().min(1), max: z.number().int().min(1) }).optional(),
      region: z.boolean().optional(),
      encryption: z.boolean().optional(),
      standby: z.boolean().optional(),
      tenantQuota: z.boolean().optional(),
    })
    .optional(),
  tech: z.array(z.string()).optional(),
  flags: z.array(z.string()).optional(),
  opsMonthsPerYear: z.number().min(0).optional(),
  mapping: z.object({ aws: z.string(), azure: z.string(), gcp: z.string(), onprem: z.string() }),
  conceptKeys: z.array(z.string()).optional(),
});

const nodeSettings = z.object({
  tier: z.string().optional(),
  count: z.number().optional(),
  region: z.string().optional(),
  encryption: encryption.optional(),
  standby: z.boolean().optional(),
  tenantQuota: z.boolean().optional(),
});

const designNode = z.object({
  id: z.string(),
  type: z.string(),
  label: z.string().optional(),
  x: z.number(),
  y: z.number(),
  settings: nodeSettings,
  fixed: z.boolean().optional(),
});

export const designSchema = z.object({
  nodes: z.array(designNode),
  edges: z.array(z.object({ id: z.string(), from: z.string(), to: z.string() })),
  decisions: z.record(z.string()),
  asked: z.array(z.string()),
  notes: z.record(z.string()).optional(),
});

const call = z.object({ family: z.string(), count: z.number().positive() });

const ruleBase = {
  id: z.string(),
  text: z.string(),
  failText: z.string(),
  pillar,
  hard: z.boolean(),
  weight: z.number().positive().optional(),
  hiddenUntil: z.string().optional(),
  conceptKey: z.string().optional(),
};

const rule = z.discriminatedUnion('check', [
  z.object({ ...ruleBase, check: z.literal('metric'), metric: z.string(), op: z.enum(['<=', '>=']), value: z.number(), unit: z.string().optional() }),
  z.object({ ...ruleBase, check: z.literal('residency'), tag: dataTag, regions: z.array(z.string()).min(1) }),
  z.object({ ...ruleBase, check: z.literal('encryption'), tag: dataTag, level: encryption }),
  z.object({ ...ruleBase, check: z.literal('on_path'), flag: z.string(), kinds: z.array(z.string()).min(1) }),
  z.object({ ...ruleBase, check: z.literal('isolation'), kind: z.string(), from: z.array(z.string()).min(1) }),
  z.object({ ...ruleBase, check: z.literal('flag'), flag: z.string(), present: z.boolean() }),
  z.object({ ...ruleBase, check: z.literal('decision'), decision: z.string(), options: z.array(z.string()).min(1) }),
]);

const effects = z.object({
  monthlyUsd: z.number().optional(),
  oneOffUsd: z.number().optional(),
  devMonths: z.number().optional(),
  tech: z.array(z.string()).optional(),
  flags: z.array(z.string()).optional(),
  metrics: z.record(z.number()).optional(),
});

const simEvent = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('node_down'),
    at: z.number().int().min(0),
    duration: z.number().int().positive().optional(),
    targetType: z.string().optional(),
    targetId: z.string().optional(),
    instances: z.number().int().positive().optional(),
    text: z.string(),
  }),
  z.object({
    kind: z.literal('slowdown'),
    at: z.number().int().min(0),
    duration: z.number().int().positive().optional(),
    targetType: z.string().optional(),
    targetId: z.string().optional(),
    factor: z.number().positive(),
    text: z.string(),
  }),
]);

export const levelSchema = z.object({
  id: z.string(),
  worldId: z.string(),
  order: z.number().int(),
  title: z.string(),
  client: z.string(),
  story: z.string(),
  brief: z.string(),
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  boss: z.boolean().optional(),
  conceptKeys: z.array(z.string()),
  team: z.object({
    size: z.number().int().positive(),
    skills: z.array(z.string()),
    devMonthlyUsd: z.number().positive(),
    baseMonths: z.number().min(0),
  }),
  regions: z.array(z.object({ id: z.string(), title: z.string(), priceMultiplier: z.number().positive() })).min(1),
  defaultRegion: z.string(),
  regionLatencyMs: z.record(z.number().min(0)),
  fixedNodes: z.array(designNode),
  traffic: z.object({
    ticks: z.number().int().positive(),
    kinds: z.array(
      z.object({
        id: z.string(),
        title: z.string(),
        from: z.string(),
        userFacing: z.boolean(),
        target: z.string().optional(),
        calls: z.array(call),
        jobCalls: z.array(call).optional(),
        carries: z.array(dataTag).optional(),
        malicious: z.boolean().optional(),
        quotaRps: z.number().positive().optional(),
        edgeCacheable: z.boolean().optional(),
      }),
    ),
    phases: z.array(
      z.object({
        from: z.number().int().min(0),
        to: z.number().int().positive(),
        rates: z.record(z.number().min(0)),
        ratesTo: z.record(z.number().min(0)).optional(),
      }),
    ),
  }),
  events: z.array(simEvent),
  palette: z.array(z.object({ type: z.string(), tiers: z.array(z.string()).optional(), max: z.number().int().positive().optional() })),
  limits: z.object({ maxNodes: z.number().int().positive(), maxEdges: z.number().int().positive() }),
  discovery: z.object({
    hours: z.number().positive(),
    stakeholders: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        role: z.string(),
        avatar: z.string(),
        intro: z.string(),
        concerns: z.array(z.string()),
        quotes: z.object({ happy: z.string(), neutral: z.string(), unhappy: z.string() }),
      }),
    ),
    questions: z.array(
      z.object({
        id: z.string(),
        stakeholder: z.string(),
        text: z.string(),
        hours: z.number().positive(),
        answer: z.string(),
        reveals: z.array(z.string()).optional(),
      }),
    ),
    facts: z.array(z.object({ id: z.string(), text: z.string(), key: z.boolean() })),
  }),
  decisions: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      prompt: z.string(),
      conceptKey: z.string().optional(),
      options: z
        .array(z.object({ id: z.string(), title: z.string(), summary: z.string(), effects, requires: z.array(z.string()).optional() }))
        .min(2),
    }),
  ),
  rules: z.array(rule).min(1),
  stars: z.object({ tco3yUsd: z.number().positive().optional() }),
  hints: z.array(z.string()),
});
