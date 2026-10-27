import { designSchema, type ComponentDef, type Design, type DesignNode, type Level, type NodeSettings } from '@sa/engine';

export function emptyDesign(level: Level): Design {
  return {
    nodes: level.fixedNodes.map((n) => ({ ...n, settings: { ...n.settings }, fixed: true })),
    edges: [],
    decisions: {},
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
  const seen = new Set(fixedIds);
  for (const n of d.nodes) {
    if (seen.has(n.id)) continue;
    const def = catalog[n.type];
    if (!def || !allowed.has(n.type)) continue;
    seen.add(n.id);
    nodes.push({ ...n, fixed: false, settings: sanitizeSettings(level, def, n.settings) });
  }
  const ids = new Set(nodes.map((n) => n.id));
  const edges = d.edges.filter((e) => ids.has(e.from) && ids.has(e.to));
  const decisions: Record<string, string> = {};
  for (const dec of level.decisions) {
    const v = d.decisions[dec.id];
    if (v && dec.options.some((o) => o.id === v)) decisions[dec.id] = v;
  }
  return { nodes, edges, decisions };
}

/** Keep only settings the component supports, with values the level allows. */
export function sanitizeSettings(level: Level, def: ComponentDef, s: NodeSettings): NodeSettings {
  const base = defaultSettings(level, def);
  const pal = level.palette.find((p) => p.type === def.type);
  const out: NodeSettings = { ...base };
  if (s.tier && def.tiers.some((t) => t.id === s.tier && (!pal?.tiers || pal.tiers.includes(t.id)))) out.tier = s.tier;
  const c = def.settings?.count;
  if (c && typeof s.count === 'number' && Number.isFinite(s.count)) out.count = Math.max(c.min, Math.min(c.max, Math.floor(s.count)));
  if (def.settings?.region && s.region && level.regions.some((r) => r.id === s.region)) out.region = s.region;
  if (def.settings?.encryption && s.encryption) out.encryption = s.encryption;
  if (def.settings?.standby) out.standby = !!s.standby;
  if (def.settings?.tenantQuota) out.tenantQuota = !!s.tenantQuota;
  return out;
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
