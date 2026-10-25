import { designSchema, type ComponentDef, type Design, type DesignNode, type Level, type NodeSettings } from '@sa/engine';

export function emptyDesign(level: Level): Design {
  return {
    nodes: level.fixedNodes.map((n) => ({ ...n, settings: { ...n.settings }, fixed: true })),
    edges: [],
    decisions: {},
    asked: [],
    notes: {},
  };
}

/**
 * Turn whatever was saved (possibly by an older version of the level) into a design that is
 * valid for the level now: unknown or no-longer-allowed nodes and their wires are dropped,
 * fixed nodes are restored, unknown decisions and questions are forgotten.
 */
export function loadDesign(level: Level, catalog: Record<string, ComponentDef>, raw: unknown): Design {
  const parsed = designSchema.safeParse(raw);
  if (!parsed.success) return emptyDesign(level);
  const d = parsed.data as Design;
  const allowed = new Set(level.palette.map((p) => p.type));
  const fixedIds = new Set(level.fixedNodes.map((n) => n.id));
  const nodes: DesignNode[] = level.fixedNodes.map((f) => {
    const saved = d.nodes.find((n) => n.id === f.id);
    return { ...f, settings: { ...f.settings }, fixed: true, x: saved?.x ?? f.x, y: saved?.y ?? f.y };
  });
  for (const n of d.nodes) {
    if (fixedIds.has(n.id)) continue;
    if (!catalog[n.type] || !allowed.has(n.type)) continue;
    nodes.push({ ...n, fixed: false });
  }
  const ids = new Set(nodes.map((n) => n.id));
  const edges = d.edges.filter((e) => ids.has(e.from) && ids.has(e.to));
  const decisions: Record<string, string> = {};
  for (const dec of level.decisions) {
    const v = d.decisions[dec.id];
    if (v && dec.options.some((o) => o.id === v)) decisions[dec.id] = v;
  }
  const qids = new Set(level.discovery.questions.map((q) => q.id));
  return { nodes, edges, decisions, asked: d.asked.filter((q) => qids.has(q)), notes: d.notes ?? {} };
}

export function defaultSettings(level: Level, def: ComponentDef): NodeSettings {
  const pal = level.palette.find((p) => p.type === def.type);
  const tier = def.tiers.find((t) => !pal?.tiers || pal.tiers.includes(t.id)) ?? def.tiers[0];
  const s: NodeSettings = { tier: tier.id };
  if (def.settings?.count) s.count = def.settings.count.min;
  if (def.settings?.region) s.region = level.defaultRegion;
  if (def.settings?.encryption) s.encryption = 'none';
  if (def.settings?.standby) s.standby = false;
  if (def.settings?.tenantQuota) s.tenantQuota = false;
  return s;
}

export function nextNodeId(design: Design, type: string): string {
  let i = 1;
  const ids = new Set(design.nodes.map((n) => n.id));
  while (ids.has(`${type}_${i}`)) i++;
  return `${type}_${i}`;
}

export function designKey(levelId: string) {
  return `sab:design:${levelId}:v1`;
}
