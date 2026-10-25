import type { Design, DesignNode, NodeSettings, Region } from '@sa/engine';

export const WORLD1 = 'first_contract';

export const REGIONS: Region[] = [
  { id: 'vn', title: 'Việt Nam (TP.HCM)', priceMultiplier: 1.25 },
  { id: 'sg', title: 'Singapore', priceMultiplier: 1 },
];

export const REGION_LATENCY: Record<string, number> = {
  'sg|vn': 35,
  'us|vn': 180,
  'sg|us': 170,
  'onprem|vn': 6,
  'onprem|sg': 40,
  'onprem|us': 190,
};

/** Average Vietnamese developer cost per month (USD, fully loaded). */
export const DEV_MONTHLY_USD = 2500;

export function fixed(id: string, type: string, label: string, x: number, y: number, settings: NodeSettings = {}): DesignNode {
  return { id, type, label, x, y, settings, fixed: true };
}

export interface ExampleSpec {
  nodes: Array<[id: string, type: string, settings?: NodeSettings, label?: string]>;
  /** Space separated wires "a>b b>c". */
  wires: string;
  decisions?: Record<string, string>;
  asked?: string[];
}

/** Build a design for golden tests and the solution viewer, laying nodes out in a simple grid. */
export function example(fixedNodes: DesignNode[], spec: ExampleSpec): Design {
  const nodes: DesignNode[] = fixedNodes.map((n) => ({ ...n, settings: { ...n.settings } }));
  spec.nodes.forEach(([id, type, settings, label], i) => {
    nodes.push({ id, type, label, x: 200 + (i % 4) * 220, y: 220 + Math.floor(i / 4) * 140, settings: settings ?? {} });
  });
  const edges = spec.wires
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w, i) => {
      const [from, to] = w.split('>');
      return { id: `w${i}`, from, to };
    });
  return { nodes, edges, decisions: spec.decisions ?? {}, asked: spec.asked ?? [] };
}

export interface LevelExamples {
  reference: Design;
  /** Designs a beginner would build, with the rule ids or reason codes they must trip. */
  naive: { name: string; design: Design; mustFail: string[] }[];
}
