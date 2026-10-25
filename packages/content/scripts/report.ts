// Prints how each level's reference and naive designs score. Usage: pnpm tsx scripts/report.ts [levelId]
import { evaluate } from '@sa/engine';
import { catalog, levelExamples, levels } from '../src';

const only = process.argv[2];
for (const level of levels) {
  if (only && level.id !== only) continue;
  const ex = levelExamples[level.id];
  const designs = [{ name: 'REFERENCE', design: ex.reference }, ...ex.naive];
  console.log(`\n## ${level.order}. ${level.title} (${level.id})`);
  for (const { name, design } of designs) {
    const r = evaluate(level, design, catalog);
    console.log(`- ${name}: passed=${r.passed} stars=${r.stars} overall=${r.overall} $${r.analysis.monthlyUsd}/mo tco=$${r.analysis.tco3yUsd} cal=${r.analysis.calendarMonths}m`);
    console.log(`    pillars ${JSON.stringify(r.pillars)}`);
    for (const g of r.goals) if (!g.passed) console.log(`    ✗ ${g.ruleId} (${g.hard ? 'hard' : 'soft'}) actual=${g.actual}`);
    for (const x of r.reasons) if (x.code !== 'goal_failed' && x.code !== 'goal_missed') console.log(`    · [${x.severity}] ${x.code}: ${x.text}`);
    if (name === 'REFERENCE') {
      const kinds = Object.entries(r.sim.perKind).map(([k, v]) => `${k}:${v.answeredPct}%/${v.avgLatencyMs}ms`).join(' ');
      console.log(`    kinds ${kinds}`);
      console.log(`    jobs ${JSON.stringify(r.sim.jobs)}`);
      console.log(`    peaks ${Object.entries(r.sim.nodes).map(([k, v]) => `${k}:${Math.round(v.peakUtil * 100)}%`).join(' ')}`);
      console.log(`    cost ${r.analysis.costLines.map((c) => `${c.label}=${c.monthlyUsd}`).join(', ')}`);
    }
  }
}
