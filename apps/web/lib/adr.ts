import { discoveredFacts, type ComponentDef, type Design, type EvalResult, type Level } from '@sa/engine';

/** A Markdown architecture decision record for the player's design, ready to hand to a client. */
export function buildAdr(level: Level, design: Design, result: EvalResult, catalog: Record<string, ComponentDef>): string {
  const facts = discoveredFacts(level, design);
  const label = (id: string) => {
    const n = design.nodes.find((x) => x.id === id);
    return n ? n.label ?? catalog[n.type]?.title ?? n.type : id;
  };
  const lines: string[] = [];
  lines.push(`# Hồ sơ kiến trúc: ${level.client}`, '');
  lines.push(`*${level.title}* · kết quả: ${result.passed ? 'đạt' : 'chưa đạt'}, ${result.stars}★, điểm ${result.overall}/100`, '');
  lines.push('## Mục tiêu', '', level.brief, '');
  lines.push('## Ràng buộc đã nắm được', '');
  const known = level.discovery.facts.filter((f) => facts.has(f.id));
  lines.push(...(known.length ? known.map((f) => `- ${f.text}`) : ['- (chưa khảo sát)']), '');

  if (level.decisions.length) {
    lines.push('## Quyết định', '');
    level.decisions.forEach((d, i) => {
      const chosen = d.options.find((o) => o.id === design.decisions[d.id]);
      lines.push(`### ADR-${String(i + 1).padStart(2, '0')}: ${d.title}`, '');
      lines.push(`**Câu hỏi:** ${d.prompt}`, '');
      lines.push(`**Đã chọn:** ${chosen ? `${chosen.title}: ${chosen.summary}` : 'chưa chọn'}`, '');
      const others = d.options.filter((o) => o.id !== chosen?.id);
      if (others.length) lines.push('**Phương án đã cân nhắc:**', ...others.map((o) => `- ${o.title}: ${o.summary}`), '');
      const note = design.notes?.[d.id]?.trim();
      lines.push(`**Lý do:** ${note || '(chưa ghi)'}`, '');
    });
  }

  lines.push('## Kiến trúc', '');
  for (const n of design.nodes) {
    const def = catalog[n.type];
    if (!def) continue;
    const s = n.settings;
    const bits = [
      def.tiers.length > 1 && s.tier ? `tier ${s.tier.toUpperCase()}` : '',
      s.count && s.count > 1 ? `×${s.count}` : '',
      s.region ? `region ${s.region}` : '',
      s.standby ? 'standby' : '',
      s.encryption && s.encryption !== 'none' ? `mã hoá ${s.encryption}` : '',
    ].filter(Boolean);
    lines.push(`- **${label(n.id)}** (${def.title}${bits.length ? ', ' + bits.join(', ') : ''}) · AWS: ${def.mapping.aws} · Azure: ${def.mapping.azure} · GCP: ${def.mapping.gcp}`);
  }
  lines.push('', '**Luồng kết nối:**', ...design.edges.map((e) => `- ${label(e.from)} → ${label(e.to)}`), '');

  const a = result.analysis;
  lines.push('## Chi phí và triển khai', '');
  lines.push(`- Hằng tháng: $${a.monthlyUsd}`, `- TCO 3 năm: $${a.tco3yUsd}`, `- Chi phí một lần: $${a.oneOffUsd}`, `- Thời gian ra mắt ước tính: ${a.calendarMonths} tháng`);
  if (a.unfamiliarTech.length) lines.push(`- Công nghệ team chưa quen: ${a.unfamiliarTech.join(', ')}`);
  lines.push('', '## Kết quả review', '');
  for (const g of result.goals) lines.push(`- ${g.passed ? '✅' : '❌'} ${g.text}${g.actual ? ` (thực tế: ${g.actual})` : ''}`);
  lines.push('', ...result.stakeholders.map((s) => `> **${s.name}** (${s.role}): “${s.quote}”`), '');
  return lines.join('\n');
}
