// Core data model shared by the engine, the content package and the web app.

export type Pillar =
  | 'ops'
  | 'security'
  | 'reliability'
  | 'performance'
  | 'cost'
  | 'sustainability'
  | 'business'
  | 'delivery';

export const PILLARS: Pillar[] = [
  'ops',
  'security',
  'reliability',
  'performance',
  'cost',
  'sustainability',
  'business',
  'delivery',
];

/** Sensitive data classes that flow with requests. */
export type DataTag = 'pii' | 'card';

/**
 * How a component behaves in the simulation. The engine only knows these;
 * every concrete component (and every cloud provider's equivalent) is data.
 */
export type Behavior =
  | 'entry' // source of traffic (users, stores…)
  | 'router' // LB, API gateway, WAF, tokenizer: forwards ingress traffic
  | 'edge_cache' // CDN: serves cacheable kinds at the edge, forwards the rest
  | 'compute' // app server, function: terminates a request and issues calls
  | 'worker' // takes jobs from a queue and issues job calls
  | 'provider' // DB, KV, object storage, SaaS, ERP: serves call families
  | 'cache' // serves a share of reads, forwards misses
  | 'queue' // accepts jobs asynchronously
  | 'link' // VPN / dedicated line: transparent hop to on-prem
  | 'attachment'; // KMS, IdP, audit log, monitoring: not on the request path

export type Category =
  | 'entry'
  | 'edge'
  | 'compute'
  | 'data'
  | 'cache'
  | 'messaging'
  | 'integration'
  | 'security'
  | 'saas'
  | 'ops';

export interface TierDef {
  id: string;
  title: string;
  /** Operations per second per instance. 0 means effectively unlimited. */
  capacity: number;
  /** Base service time in ms when idle. */
  latencyMs: number;
  /** Price per instance per month (USD). */
  monthlyUsd: number;
  /** Usage price per million operations (USD). */
  perMillionUsd?: number;
  /** Share of reads served without touching what is behind (cache / CDN). 0..1 */
  hitRatio?: number;
}

export interface ProviderMapping {
  aws: string;
  azure: string;
  gcp: string;
  onprem: string;
}

export type EncryptionLevel = 'none' | 'at_rest' | 'kms';

export interface ComponentDef {
  type: string;
  title: string;
  category: Category;
  /** Short icon key understood by the UI. */
  icon: string;
  summary: string;
  behavior: Behavior;
  tiers: TierDef[];
  /** Call families this node can serve (provider / cache / queue). */
  provides?: string[];
  /** Ingress targets this provider accepts straight from users (e.g. 'static'). */
  ingress?: string[];
  /** Higher priority providers take a family's calls exclusively. */
  routePriority?: Record<string, number>;
  props?: {
    /** Durable store of data. */
    stateful?: boolean;
    /** Keeps copies of data (cache, queue) without being the system of record. */
    holdsData?: boolean;
    /** Lives in the client's data centre; reachable only through a link. */
    onPrem?: boolean;
    /** Third party service: outside your compliance scope, has a fixed region. */
    external?: boolean;
    fixedRegion?: string;
    /** Data classes removed from the request after this node (tokenization). */
    strips?: DataTag[];
    /** Share of malicious traffic dropped here, 0..1. */
    blocksMalicious?: number;
  };
  settings?: {
    count?: { min: number; max: number };
    region?: boolean;
    encryption?: boolean;
    standby?: boolean;
    tenantQuota?: boolean;
  };
  /** Technologies the team must know to run it. */
  tech?: string[];
  /** Capabilities this component brings to the design (waf, audit_log…). */
  flags?: string[];
  /** Ongoing operations effort in dev-months per year (self-hosted software). */
  opsMonthsPerYear?: number;
  mapping: ProviderMapping;
  conceptKeys?: string[];
}

export interface Call {
  family: string;
  /** Calls per request. */
  count: number;
}

export interface TrafficKind {
  id: string;
  title: string;
  /** Entry node id where this traffic comes from. */
  from: string;
  userFacing: boolean;
  /** 'compute' (default) or an ingress family a provider can serve directly. */
  target?: string;
  calls: Call[];
  /** Calls a worker makes for each job this request enqueues. */
  jobCalls?: Call[];
  carries?: DataTag[];
  /** Attack traffic: should be blocked before reaching any data. */
  malicious?: boolean;
  /** A tenant that floods requests; capped when it passes a node with tenantQuota on. */
  quotaRps?: number;
  /** Served at the CDN edge when one is on the path. */
  edgeCacheable?: boolean;
}

export interface Phase {
  from: number;
  to: number;
  /** Requests per second per kind at the start of the phase. */
  rates: Record<string, number>;
  /** Optional rates at the end of the phase (linear ramp). */
  ratesTo?: Record<string, number>;
}

export type SimEvent =
  | {
      kind: 'node_down';
      at: number;
      /** Ticks until the node is repaired; omitted = until the end. */
      duration?: number;
      /** Node type affected (first matching node) or exact node id. */
      targetType?: string;
      targetId?: string;
      /** Instances lost; omitted = all. */
      instances?: number;
      text: string;
    }
  | {
      kind: 'slowdown';
      at: number;
      duration?: number;
      targetType?: string;
      targetId?: string;
      /** Latency multiplier. */
      factor: number;
      text: string;
    };

export interface Region {
  id: string;
  title: string;
  priceMultiplier: number;
}

export interface Stakeholder {
  id: string;
  name: string;
  role: string;
  avatar: string;
  intro: string;
  /** Rule ids this person cares about. */
  concerns: string[];
  quotes: { happy: string; neutral: string; unhappy: string };
}

export interface Question {
  id: string;
  stakeholder: string;
  text: string;
  hours: number;
  answer: string;
  reveals?: string[];
}

export interface Fact {
  id: string;
  text: string;
  /** Key facts count towards the business pillar. */
  key: boolean;
}

export interface Effects {
  monthlyUsd?: number;
  oneOffUsd?: number;
  devMonths?: number;
  tech?: string[];
  flags?: string[];
  /** Arbitrary numeric outcomes (rto_core_min, downtime_min…), summed across choices. */
  metrics?: Record<string, number>;
}

export interface DecisionOption {
  id: string;
  title: string;
  summary: string;
  effects: Effects;
  /** Component types that must be on the board for this option to work. */
  requires?: string[];
}

export interface Decision {
  id: string;
  title: string;
  prompt: string;
  conceptKey?: string;
  options: DecisionOption[];
}

interface RuleBase {
  id: string;
  /** Goal statement shown to the player. */
  text: string;
  /** Explanation shown when it fails. */
  failText: string;
  pillar: Pillar;
  hard: boolean;
  weight?: number;
  /** Not shown as a goal until this fact is discovered (still evaluated). */
  hiddenUntil?: string;
  conceptKey?: string;
}

export type Rule =
  | (RuleBase & { check: 'metric'; metric: string; op: '<=' | '>='; value: number; unit?: string })
  | (RuleBase & { check: 'residency'; tag: DataTag; regions: string[] })
  | (RuleBase & { check: 'encryption'; tag: DataTag; level: EncryptionLevel })
  | (RuleBase & { check: 'on_path'; flag: string; kinds: string[] })
  | (RuleBase & { check: 'isolation'; kind: string; from: string[] })
  | (RuleBase & { check: 'flag'; flag: string; present: boolean })
  | (RuleBase & { check: 'decision'; decision: string; options: string[] });

export type RuleCheck = Rule['check'];

export interface PaletteEntry {
  type: string;
  /** Tier ids allowed; omitted = all. */
  tiers?: string[];
  max?: number;
}

export interface Team {
  size: number;
  skills: string[];
  devMonthlyUsd: number;
  /** Calendar months the project needs before any extra build work. */
  baseMonths: number;
}

export interface Level {
  id: string;
  worldId: string;
  order: number;
  title: string;
  client: string;
  brief: string;
  difficulty: 1 | 2 | 3 | 4;
  boss?: boolean;
  conceptKeys: string[];
  team: Team;
  regions: Region[];
  defaultRegion: string;
  /** Extra latency per hop between two regions, key "a|b" (sorted). */
  regionLatencyMs: Record<string, number>;
  /** Nodes the level places and the player cannot remove (entries, legacy systems). */
  fixedNodes: DesignNode[];
  traffic: {
    ticks: number;
    kinds: TrafficKind[];
    phases: Phase[];
    /** Share of a month spent at the simulated load, for usage pricing. Default 1. */
    usageScale?: number;
  };
  events: SimEvent[];
  palette: PaletteEntry[];
  limits: { maxNodes: number; maxEdges: number };
  discovery: { hours: number; stakeholders: Stakeholder[]; questions: Question[]; facts: Fact[] };
  decisions: Decision[];
  rules: Rule[];
  stars: { tco3yUsd?: number };
  hints: string[];
}

export interface NodeSettings {
  tier?: string;
  count?: number;
  region?: string;
  encryption?: EncryptionLevel;
  standby?: boolean;
  tenantQuota?: boolean;
}

export interface DesignNode {
  id: string;
  type: string;
  label?: string;
  x: number;
  y: number;
  settings: NodeSettings;
  fixed?: boolean;
}

export interface DesignEdge {
  id: string;
  from: string;
  to: string;
}

export interface Design {
  nodes: DesignNode[];
  edges: DesignEdge[];
  /** decisionId → optionId */
  decisions: Record<string, string>;
  /** Discovery question ids already asked. */
  asked: string[];
  /** Optional ADR notes per decision. */
  notes?: Record<string, string>;
}

export type Severity = 'error' | 'warn' | 'info';

export interface Reason {
  code: string;
  severity: Severity;
  text: string;
  nodeId?: string;
  conceptKey?: string;
}

export interface KindSeries {
  answeredPct: number[];
  latencyMs: number[];
}

export interface SimResult {
  ticks: number;
  perKind: Record<
    string,
    { offered: number; answered: number; answeredPct: number; avgLatencyMs: number; series: KindSeries }
  >;
  jobs: Record<string, { total: number; done: number; donePct: number; maxWaitS: number }>;
  nodes: Record<
    string,
    {
      /** Peak share of capacity used, including jobs drained in the background. */
      peakUtil: number;
      /** Peak share of capacity used by requests someone is waiting on. */
      syncPeakUtil: number;
      avgOps: number;
      avgUtil: number;
      downTicks: number;
    }
  >;
  breachPct: number;
  eventsFired: { at: number; text: string }[];
}

export interface CostLine {
  label: string;
  monthlyUsd: number;
  nodeId?: string;
}

export interface Analysis {
  monthlyUsd: number;
  costLines: CostLine[];
  oneOffUsd: number;
  devMonths: number;
  opsDevMonths3y: number;
  tco3yUsd: number;
  calendarMonths: number;
  tech: string[];
  unfamiliarTech: string[];
  flags: string[];
  /** Node ids that touch each data class. */
  touched: Record<DataTag, string[]>;
  metrics: Record<string, number>;
}

export interface GoalResult {
  ruleId: string;
  text: string;
  pillar: Pillar;
  hard: boolean;
  passed: boolean;
  /** 0..1 */
  score: number;
  actual?: string;
  hidden: boolean;
  discovered: boolean;
  failText?: string;
  conceptKey?: string;
  nodeIds?: string[];
}

export interface Verdict {
  stakeholderId: string;
  name: string;
  role: string;
  avatar: string;
  mood: 'happy' | 'neutral' | 'unhappy';
  quote: string;
  score: number;
}

export interface EvalResult {
  evaluationId: string;
  passed: boolean;
  stars: 0 | 1 | 2 | 3;
  overall: number;
  pillars: Record<Pillar, number | null>;
  goals: GoalResult[];
  stakeholders: Verdict[];
  reasons: Reason[];
  missedFacts: Fact[];
  sim: SimResult;
  analysis: Analysis;
}
