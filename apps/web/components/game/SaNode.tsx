'use client';
import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { AlertTriangle, Lock, ShieldCheck } from 'lucide-react';
import type { ComponentDef, DesignNode } from '@sa/engine';
import { CATEGORY_TINT, ComponentIcon } from '@/lib/icons';

export interface SaNodeData extends Record<string, unknown> {
  node: DesignNode;
  def: ComponentDef;
  tierTitle: string;
  regionTitle?: string;
  problem?: 'error' | 'warn';
  util?: number;
}

function SaNodeImpl({ data, selected }: NodeProps) {
  const { node, def, tierTitle, regionTitle, problem, util } = data as SaNodeData;
  const label = node.label ?? def.title;
  const isEntry = def.behavior === 'entry';
  const isAttachment = def.behavior === 'attachment';
  const onPrem = !!def.props?.onPrem;
  const count = node.settings.count ?? 1;
  const ring = problem === 'error' ? 'ring-4 ring-bad/50 !border-bad' : problem === 'warn' ? 'ring-4 ring-warn/40' : '';
  const sel = selected ? 'sketch-shadow !border-sky-strong' : '';

  if (isEntry) {
    return (
      <div className={`relative ${ring}`}>
        <div className="absolute -top-3 left-1/2 flex -translate-x-1/2 gap-0.5">
          {[0, 1, 2].map((i) => (
            <span key={i} className="h-4 w-4 rounded-full border-2 border-ink bg-lilac" />
          ))}
        </div>
        <div className={`sketch flex min-w-[170px] items-center gap-2 px-4 py-2.5 ${sel}`}>
          <ComponentIcon name="users" className="h-4 w-4" />
          <span className="font-hand text-lg leading-none">{label}</span>
        </div>
        <Handle type="source" position={Position.Bottom} />
      </div>
    );
  }

  const shape = isAttachment ? 'border-dashed' : onPrem ? 'bg-stone-100' : '';
  return (
    <div className="relative">
      {count > 1 && !isAttachment && (
        <>
          <div className="sketch absolute inset-0 translate-x-[6px] -translate-y-[6px] opacity-80" />
          <div className="sketch absolute inset-0 translate-x-[3px] -translate-y-[3px] opacity-90" />
        </>
      )}
      <div className={`sketch relative flex min-w-[170px] max-w-[230px] items-center gap-2 px-3 py-2 ${shape} ${ring} ${sel}`}>
        {!isAttachment && <Handle type="target" position={Position.Top} />}
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${CATEGORY_TINT[def.category] ?? 'bg-paper-2'}`}>
          <ComponentIcon name={def.icon} className="h-4 w-4" />
        </span>
        <span className="min-w-0">
          <span className="font-hand block truncate text-[17px] leading-tight">{label}</span>
          <span className="block truncate text-[11px] text-muted">
            {[def.tiers.length > 1 ? `Tier ${tierTitle}` : null, regionTitle, onPrem ? 'on-prem' : null, isAttachment ? 'gắn kèm' : null]
              .filter(Boolean)
              .join(' · ')}
          </span>
        </span>
        <span className="ml-auto flex flex-col items-end gap-0.5">
          {count > 1 && <span className="rounded bg-ink px-1 text-[10px] font-bold text-white">×{count}</span>}
          {node.settings.standby && <span className="rounded bg-mint px-1 text-[10px] font-bold text-white">HA</span>}
          {node.settings.encryption && node.settings.encryption !== 'none' && <Lock className="h-3 w-3" />}
          {node.settings.tenantQuota && <ShieldCheck className="h-3 w-3" />}
        </span>
        {problem && (
          <span className={`absolute -right-2 -top-2 rounded-full border-2 border-ink p-0.5 ${problem === 'error' ? 'bg-bad text-white' : 'bg-warn text-white'}`}>
            <AlertTriangle className="h-3 w-3" />
          </span>
        )}
        {util !== undefined && util > 0 && (
          <span className="absolute -bottom-2 left-3 h-1.5 w-[calc(100%-24px)] overflow-hidden rounded-full border border-ink bg-white">
            <span
              className={`block h-full ${util > 1 ? 'bg-bad' : util > 0.85 ? 'bg-warn' : 'bg-ok'}`}
              style={{ width: `${Math.min(100, util * 100)}%` }}
            />
          </span>
        )}
        {!isAttachment && def.behavior !== 'provider' && <Handle type="source" position={Position.Bottom} />}
      </div>
    </div>
  );
}

export const SaNode = memo(SaNodeImpl);
