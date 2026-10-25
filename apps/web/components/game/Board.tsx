'use client';
import { useCallback, useEffect, useMemo } from 'react';
import { LayoutGrid } from 'lucide-react';
import {
  Background,
  BackgroundVariant,
  ControlButton,
  Controls,
  MarkerType,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { canConnect } from '@sa/engine';
import { catalog } from '@sa/content';
import { SaNode, type SaNodeData } from './SaNode';
import { useGame } from './store';

const nodeTypes = { sa: SaNode };
/** Keep the fitted view clear of the goals panel (left) and side panel (right). */
const FIT = { padding: { top: '70px', bottom: '50px', left: '350px', right: '390px' }, maxZoom: 1 } as const;

function BoardInner() {
  const level = useGame((s) => s.level)!;
  const design = useGame((s) => s.design);
  const selected = useGame((s) => s.selected);
  const result = useGame((s) => s.result);
  const stale = useGame((s) => s.stale);
  const running = useGame((s) => s.running);
  const viewVersion = useGame((s) => s.viewVersion);
  const { moveNode, select, removeNode, connect, removeEdge, addNode, arrange } = useGame.getState();
  const { screenToFlowPosition, fitView } = useReactFlow();

  useEffect(() => {
    if (viewVersion > 0) requestAnimationFrame(() => fitView(FIT));
  }, [viewVersion, fitView]);

  const problems = useMemo(() => {
    const m = new Map<string, 'error' | 'warn'>();
    if (!result || stale) return m;
    for (const r of result.reasons) {
      if (!r.nodeId || r.severity === 'info') continue;
      if (m.get(r.nodeId) !== 'error') m.set(r.nodeId, r.severity === 'error' ? 'error' : 'warn');
    }
    for (const g of result.goals) for (const id of g.nodeIds ?? []) if (!g.passed) m.set(id, 'error');
    return m;
  }, [result, stale]);

  const regionTitle = useMemo(() => new Map(level.regions.map((r) => [r.id, r.title.split(' ')[0]])), [level]);

  const nodes: Node[] = useMemo(
    () =>
      design.nodes
        .filter((n) => catalog[n.type])
        .map((n) => {
          const def = catalog[n.type];
          const tier = def.tiers.find((t) => t.id === n.settings.tier) ?? def.tiers[0];
          const data: SaNodeData = {
            node: n,
            def,
            tierTitle: tier.title,
            regionTitle: def.settings?.region ? regionTitle.get(n.settings.region ?? level.defaultRegion) : undefined,
            problem: problems.get(n.id),
            util: result && !stale ? result.sim.nodes[n.id]?.syncPeakUtil : undefined,
          };
          return { id: n.id, type: 'sa', position: { x: n.x, y: n.y }, data, selected: n.id === selected, deletable: !n.fixed };
        }),
    [design.nodes, selected, problems, result, stale, regionTitle, level.defaultRegion],
  );

  const edges: Edge[] = useMemo(
    () =>
      design.edges.map((e) => ({
        id: e.id,
        source: e.from,
        target: e.to,
        markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: '#1f2328' },
        className: running ? 'edge-running' : undefined,
      })),
    [design.edges, running],
  );

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      for (const c of changes) {
        if (c.type === 'position' && c.position) moveNode(c.id, Math.round(c.position.x), Math.round(c.position.y));
        if (c.type === 'remove') removeNode(c.id);
        if (c.type === 'select' && c.selected) select(c.id);
      }
    },
    [moveNode, removeNode, select],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      for (const c of changes) if (c.type === 'remove') removeEdge(c.id);
    },
    [removeEdge],
  );

  const onConnect = useCallback((c: Connection) => c.source && c.target && connect(c.source, c.target), [connect]);

  const isValidConnection = useCallback(
    (c: Connection | Edge) => {
      const a = design.nodes.find((n) => n.id === c.source);
      const b = design.nodes.find((n) => n.id === c.target);
      return !!a && !!b && a.id !== b.id && canConnect(catalog[a.type], catalog[b.type]);
    },
    [design.nodes],
  );

  return (
    <div
      className="dotted-bg h-full w-full"
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }}
      onDrop={(e) => {
        e.preventDefault();
        const type = e.dataTransfer.getData('application/sa-type');
        if (!type) return;
        const p = screenToFlowPosition({ x: e.clientX, y: e.clientY });
        addNode(type, { x: Math.round(p.x - 85), y: Math.round(p.y - 20) });
      }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        isValidConnection={isValidConnection}
        onPaneClick={() => select(null)}
        fitView
        fitViewOptions={FIT}
        minZoom={0.3}
        maxZoom={1.6}
        deleteKeyCode={['Backspace', 'Delete']}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1.3} color="#d9d6cb" />
        <Controls position="bottom-left" showInteractive={false} fitViewOptions={FIT}>
          <ControlButton onClick={arrange} title="Sắp xếp tự động" aria-label="Sắp xếp tự động">
            <LayoutGrid size={14} />
          </ControlButton>
        </Controls>
      </ReactFlow>
    </div>
  );
}

export function Board() {
  return (
    <ReactFlowProvider>
      <BoardInner />
    </ReactFlowProvider>
  );
}
