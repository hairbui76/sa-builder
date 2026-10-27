'use client';
import { useMemo, useState } from 'react';
import { Minus, Plus, Search, Trash2 } from 'lucide-react';
import type { ComponentDef, EncryptionLevel } from '@sa/engine';
import { catalog } from '@sa/content';
import { CATEGORY_LABEL, ComponentIcon, CATEGORY_TINT } from '@/lib/icons';
import { usd } from '@/lib/labels';
import { useGame, type RightTab } from './store';

export function SidePanel() {
  const tab = useGame((s) => s.tab);
  const level = useGame((s) => s.level)!;
  const decided = useGame((s) => Object.keys(s.design.decisions).length);
  const selected = useGame((s) => s.selected);
  const setTab = useGame((s) => s.setTab);
  const allTabs: { id: RightTab; label: string; badge?: string }[] = [
    { id: 'components', label: 'Thành phần' },
    { id: 'decisions', label: 'Quyết định', badge: level.decisions.length ? `${decided}/${level.decisions.length}` : undefined },
    { id: 'inspect', label: 'Cấu hình' },
  ];
  const tabs = allTabs.filter((t) => t.id !== 'decisions' || level.decisions.length > 0);
  return (
    <aside className="sketch flex h-full w-full flex-col overflow-hidden">
      <div className="flex border-b-2 border-ink">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            disabled={t.id === 'inspect' && !selected}
            data-testid={`tab-${t.id}`}
            className={`font-hand flex flex-1 items-center justify-center gap-1 px-2 py-2 text-lg disabled:opacity-40 ${tab === t.id ? 'bg-note' : 'hover:bg-paper-2'}`}
          >
            {t.label}
            {t.badge && (
              <span className={`rounded-full px-1.5 text-xs ${decided < level.decisions.length ? 'bg-warn text-white' : 'bg-ok text-white'}`}>{t.badge}</span>
            )}
          </button>
        ))}
      </div>
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-3">
        {tab === 'components' && <Palette />}
        {tab === 'decisions' && <Decisions />}
        {tab === 'inspect' && <Inspector />}
      </div>
    </aside>
  );
}

function priceLine(def: ComponentDef, tiers: string[] | undefined) {
  const ts = def.tiers.filter((t) => !tiers || tiers.includes(t.id));
  const min = Math.min(...ts.map((t) => t.monthlyUsd));
  const usage = ts.some((t) => (t.perMillionUsd ?? 0) > 0);
  const cap = ts[0].capacity;
  return {
    price: min === 0 && usage ? 'trả theo lượt dùng' : `${ts.length > 1 ? 'từ ' : ''}${usd(min)}/tháng${usage ? ' + theo lượt' : ''}`,
    cap: def.behavior === 'attachment' ? null : cap === 0 ? 'co giãn' : `${cap} req/s`,
  };
}

function Palette() {
  const level = useGame((s) => s.level)!;
  const design = useGame((s) => s.design);
  const addNode = useGame((s) => s.addNode);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<string>('all');
  const items = level.palette.map((p) => ({ p, def: catalog[p.type] })).filter((x) => x.def);
  const cats = [...new Set(items.map((x) => x.def.category))];
  const shown = items.filter(
    (x) => (cat === 'all' || x.def.category === cat) && (q === '' || (x.def.title + x.def.summary).toLowerCase().includes(q.toLowerCase())),
  );
  return (
    <div>
      <label className="sketch-soft flex items-center gap-2 px-2 py-1.5">
        <Search size={15} className="text-muted" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm thành phần…" className="w-full bg-transparent text-sm outline-none" />
      </label>
      <div className="mt-2 flex flex-wrap gap-1">
        {['all', ...cats].map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={`rounded-full border px-2 py-0.5 text-xs ${cat === c ? 'border-ink bg-sky' : 'border-line bg-white hover:border-ink'}`}
          >
            {c === 'all' ? 'Tất cả' : CATEGORY_LABEL[c] ?? c}
          </button>
        ))}
      </div>
      <ul className="mt-3 space-y-2">
        {shown.map(({ p, def }) => {
          const used = design.nodes.filter((n) => n.type === def.type && !n.fixed).length;
          const full = p.max !== undefined && used >= p.max;
          const pl = priceLine(def, p.tiers);
          return (
            <li key={def.type}>
              <button
                draggable={!full}
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/sa-type', def.type);
                  e.dataTransfer.effectAllowed = 'copy';
                }}
                onClick={() => addNode(def.type)}
                disabled={full}
                data-testid={`palette-${def.type}`}
                className="sketch-soft group w-full p-2.5 text-left hover:border-ink disabled:opacity-50"
              >
                <div className="flex items-center gap-2">
                  <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${CATEGORY_TINT[def.category]}`}>
                    <ComponentIcon name={def.icon} className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="font-hand block text-lg leading-tight">{def.title}</span>
                    <span className="block text-xs text-ink-2">
                      {pl.price}
                      {pl.cap ? ` · ${pl.cap}` : ''}
                    </span>
                  </span>
                  {p.max !== undefined && (
                    <span className="rounded border border-ink px-1 text-[10px]">
                      {used}/{p.max}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs leading-snug text-ink-2">{def.summary}</p>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-xs text-muted">Bấm để thêm, hoặc kéo vào board. Nối dây: kéo từ chấm dưới của một thành phần tới chấm trên của thành phần khác.</p>
    </div>
  );
}

function Decisions() {
  const level = useGame((s) => s.level)!;
  const design = useGame((s) => s.design);
  const choose = useGame((s) => s.choose);
  if (level.decisions.length === 0) {
    return <p className="text-sm text-ink-2">Level này không có thẻ quyết định: mọi lựa chọn nằm trên board.</p>;
  }
  return (
    <div className="space-y-4">
      {level.decisions.map((d) => (
        <section key={d.id} className="sketch-soft p-3" data-testid={`decision-${d.id}`}>
          <h3 className="font-hand text-xl">{d.title}</h3>
          <p className="text-xs text-ink-2">{d.prompt}</p>
          <div className="mt-2 space-y-1.5">
            {d.options.map((o) => {
              const on = design.decisions[d.id] === o.id;
              return (
                <button
                  key={o.id}
                  onClick={() => choose(d.id, o.id)}
                  data-testid={`option-${d.id}-${o.id}`}
                  className={`w-full rounded-lg border-2 p-2 text-left text-sm ${on ? 'border-ink bg-note' : 'border-line bg-white hover:border-ink'}`}
                >
                  <span className="flex items-center gap-2">
                    <span className={`h-3.5 w-3.5 shrink-0 rounded-full border-2 border-ink ${on ? 'bg-ink' : 'bg-white'}`} />
                    <span className="font-medium">{o.title}</span>
                  </span>
                  <span className="mt-0.5 block pl-5 text-xs text-ink-2">{o.summary}</span>
                  {o.requires && <span className="mt-0.5 block pl-5 text-[11px] text-muted">Cần trên board: {o.requires.map((r) => catalog[r]?.title ?? r).join(', ')}</span>}
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

function Inspector() {
  const level = useGame((s) => s.level)!;
  const selected = useGame((s) => s.selected);
  const node = useGame((s) => s.design.nodes.find((n) => n.id === s.selected));
  const result = useGame((s) => s.result);
  const stale = useGame((s) => s.stale);
  const { updateSettings, removeNode } = useGame.getState();
  const def = node ? catalog[node.type] : undefined;
  const pal = useMemo(() => level.palette.find((p) => p.type === node?.type), [level, node?.type]);
  if (!node || !def || !selected) return <p className="text-sm text-ink-2">Chọn một thành phần trên board để cấu hình.</p>;
  const tiers = def.tiers.filter((t) => node.fixed || !pal?.tiers || pal.tiers.includes(t.id));
  const s = node.settings;
  const stats = result && !stale ? result.sim.nodes[node.id] : undefined;
  const cost = result && !stale ? result.analysis.costLines.find((c) => c.nodeId === node.id) : undefined;

  return (
    <div className="space-y-4 text-sm">
      <div className="flex items-start gap-2">
        <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${CATEGORY_TINT[def.category]}`}>
          <ComponentIcon name={def.icon} className="h-5 w-5" />
        </span>
        <div className="flex-1">
          <div className="font-hand text-2xl leading-tight">{node.label ?? def.title}</div>
          <div className="text-xs text-muted">{CATEGORY_LABEL[def.category]}</div>
        </div>
        {!node.fixed && (
          <button className="btn btn-ghost !px-2 text-bad" onClick={() => removeNode(node.id)} title="Xoá" data-testid="delete-node">
            <Trash2 size={16} />
          </button>
        )}
      </div>
      <p className="text-ink-2">{def.summary}</p>

      {tiers.length > 1 && !node.fixed && (
        <Field label="Tier">
          <div className="grid grid-cols-3 gap-1.5">
            {tiers.map((t) => (
              <button
                key={t.id}
                onClick={() => updateSettings(node.id, { tier: t.id })}
                className={`rounded-lg border-2 p-1.5 text-left ${s.tier === t.id ? 'border-ink bg-note' : 'border-line hover:border-ink'}`}
              >
                <div className="font-hand text-lg leading-none">{t.title}</div>
                <div className="text-[11px] text-ink-2">{t.capacity ? `${t.capacity} req/s` : 'co giãn'}</div>
                <div className="text-[11px] text-ink-2">{usd(t.monthlyUsd)}/th</div>
                {t.hitRatio !== undefined && <div className="text-[11px] text-ink-2">{Math.round(t.hitRatio * 100)}% hit</div>}
              </button>
            ))}
          </div>
        </Field>
      )}

      {def.settings?.count && (
        <Field label="Số instance">
          <div className="flex items-center gap-2">
            <button className="btn !px-2 !py-0.5" onClick={() => updateSettings(node.id, { count: Math.max(def.settings!.count!.min, (s.count ?? 1) - 1) })}>
              <Minus size={14} />
            </button>
            <span className="font-hand w-8 text-center text-2xl" data-testid="instance-count">
              {s.count ?? 1}
            </span>
            <button className="btn !px-2 !py-0.5" onClick={() => updateSettings(node.id, { count: Math.min(def.settings!.count!.max, (s.count ?? 1) + 1) })}>
              <Plus size={14} />
            </button>
          </div>
        </Field>
      )}

      {def.settings?.region && (
        <Field label="Region">
          <select
            value={s.region ?? level.defaultRegion}
            onChange={(e) => updateSettings(node.id, { region: e.target.value })}
            className="w-full rounded-lg border-2 border-line bg-white p-1.5 outline-none focus:border-ink"
            data-testid="region-select"
          >
            {level.regions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title} {r.priceMultiplier !== 1 ? `(giá ×${r.priceMultiplier})` : ''}
              </option>
            ))}
          </select>
        </Field>
      )}
      {def.props?.fixedRegion && <Field label="Vị trí dữ liệu">{level.regions.find((r) => r.id === def.props!.fixedRegion)?.title ?? def.props.fixedRegion.toUpperCase()} (cố định, do nhà cung cấp)</Field>}

      {def.settings?.encryption && (
        <Field label="Mã hoá khi lưu">
          <div className="grid grid-cols-3 gap-1.5">
            {(['none', 'at_rest', 'kms'] as EncryptionLevel[]).map((e) => (
              <button
                key={e}
                onClick={() => updateSettings(node.id, { encryption: e })}
                className={`rounded-lg border-2 p-1.5 text-xs ${(s.encryption ?? 'none') === e ? 'border-ink bg-note' : 'border-line hover:border-ink'}`}
              >
                {e === 'none' ? 'Không' : e === 'at_rest' ? 'Mặc định' : 'Khoá KMS'}
              </button>
            ))}
          </div>
        </Field>
      )}

      {def.settings?.standby && (
        <Toggle label="Standby ở zone khác (failover tự động, giá ×2)" on={!!s.standby} onChange={(v) => updateSettings(node.id, { standby: v })} testId="toggle-standby" />
      )}
      {def.settings?.tenantQuota && (
        <Toggle label="Giới hạn tần suất theo tenant (quota)" on={!!s.tenantQuota} onChange={(v) => updateSettings(node.id, { tenantQuota: v })} testId="toggle-quota" />
      )}

      {stats && (
        <Field label="Lần chạy gần nhất">
          <div className="grid grid-cols-2 gap-1 text-xs">
            <span>Tải đỉnh: {Math.round(stats.syncPeakUtil * 100)}%</span>
            <span>Trung bình: {Math.round(stats.avgOps)} ops/s</span>
            {stats.downTicks > 0 && <span className="text-bad">Ngừng: {stats.downTicks} s</span>}
            {cost && <span>Chi phí: {usd(cost.monthlyUsd)}/th</span>}
          </div>
        </Field>
      )}

      <Field label="Tương đương trên các nền tảng">
        <table className="w-full text-xs">
          <tbody>
            {(['aws', 'azure', 'gcp', 'onprem'] as const).map((k) => (
              <tr key={k} className="border-t border-line">
                <td className="py-1 pr-2 font-medium uppercase text-muted">{k === 'onprem' ? 'On-prem' : k}</td>
                <td className="py-1">{def.mapping[k]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Field>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">{label}</div>
      {children}
    </div>
  );
}

function Toggle({ label, on, onChange, testId }: { label: string; on: boolean; onChange: (v: boolean) => void; testId?: string }) {
  return (
    <button onClick={() => onChange(!on)} className="flex w-full items-center gap-2 text-left" data-testid={testId}>
      <span className={`relative h-5 w-9 shrink-0 rounded-full border-2 border-ink transition ${on ? 'bg-mint' : 'bg-white'}`}>
        <span className={`absolute top-0.5 h-3 w-3 rounded-full border border-ink bg-white transition-all ${on ? 'left-[18px]' : 'left-0.5'}`} />
      </span>
      <span>{label}</span>
    </button>
  );
}
