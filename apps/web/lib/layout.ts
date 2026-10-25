import type { ComponentDef, Design } from '@sa/engine';

const COL = 240;
const ROW = 140;

/**
 * Layered layout: traffic sources on top, each node one row below its deepest upstream node,
 * attachments (KMS, monitoring…) on the last row. Rows are ordered by the parents' positions
 * to keep wires from crossing.
 */
export function layeredLayout(design: Design, catalog: Record<string, ComponentDef>): Design {
  const behavior = (id: string) => catalog[design.nodes.find((n) => n.id === id)?.type ?? '']?.behavior;
  const depth = new Map<string, number>();
  for (const n of design.nodes) if (behavior(n.id) === 'entry') depth.set(n.id, 0);
  // Longest-path relaxation, bounded so cycles cannot loop forever.
  for (let i = 0; i < design.nodes.length; i++) {
    let changed = false;
    for (const e of design.edges) {
      const d = depth.get(e.from);
      if (d === undefined) continue;
      if ((depth.get(e.to) ?? -1) < d + 1 && d + 1 <= design.nodes.length) {
        depth.set(e.to, d + 1);
        changed = true;
      }
    }
    if (!changed) break;
  }
  const maxDepth = Math.max(0, ...depth.values());
  for (const n of design.nodes) {
    if (depth.has(n.id)) continue;
    depth.set(n.id, behavior(n.id) === 'attachment' ? maxDepth + 2 : maxDepth + 1);
  }

  const rows = new Map<number, string[]>();
  for (const n of design.nodes) {
    const d = depth.get(n.id)!;
    rows.set(d, [...(rows.get(d) ?? []), n.id]);
  }
  const x = new Map<string, number>();
  for (const d of [...rows.keys()].sort((a, b) => a - b)) {
    const ids = rows.get(d)!;
    const bary = (id: string) => {
      const parents = design.edges.filter((e) => e.to === id && x.has(e.from)).map((e) => x.get(e.from)!);
      return parents.length ? parents.reduce((s, v) => s + v, 0) / parents.length : 0;
    };
    ids.sort((a, b) => bary(a) - bary(b));
    ids.forEach((id, i) => x.set(id, (i - (ids.length - 1) / 2) * COL));
  }
  return {
    ...design,
    nodes: design.nodes.map((n) => ({ ...n, x: Math.round(x.get(n.id)!), y: depth.get(n.id)! * ROW })),
  };
}
