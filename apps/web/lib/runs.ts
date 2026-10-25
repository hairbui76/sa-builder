import { z } from 'zod';
import { evaluate } from '@sa/engine';
import { catalog, levels } from '@sa/content';
import { loadDesign } from './design';

export interface RunRecord {
  userId: string;
  levelId: string;
  evaluationId: string;
  passed: boolean;
  stars: number;
  overall: number;
  monthlyUsd: number;
  tco3yUsd: number;
  design: unknown;
}

export interface RunDeps {
  currentUserId(): Promise<string | null>;
  saveRun(r: RunRecord): Promise<void>;
}

const body = z.object({ levelId: z.string().max(100), design: z.unknown() });

/**
 * Re-evaluate a run on the server so the leaderboard only holds results the engine produced.
 * `deps` is null when Supabase is not configured.
 */
export async function handleRun(raw: unknown, deps: RunDeps | null): Promise<{ status: number; json: Record<string, unknown> }> {
  if (!deps) return { status: 501, json: { error: 'supabase_not_configured' } };
  const parsed = body.safeParse(raw);
  if (!parsed.success) return { status: 400, json: { error: 'invalid_body' } };
  const level = levels.find((l) => l.id === parsed.data.levelId);
  if (!level) return { status: 400, json: { error: 'unknown_level' } };
  const userId = await deps.currentUserId();
  if (!userId) return { status: 401, json: { error: 'not_signed_in' } };

  const design = loadDesign(level, catalog, parsed.data.design);
  const r = evaluate(level, design, catalog);
  await deps.saveRun({
    userId,
    levelId: level.id,
    evaluationId: r.evaluationId,
    passed: r.passed,
    stars: r.stars,
    overall: r.overall,
    monthlyUsd: r.analysis.monthlyUsd,
    tco3yUsd: r.analysis.tco3yUsd,
    design,
  });
  return { status: 200, json: { passed: r.passed, stars: r.stars, overall: r.overall, evaluationId: r.evaluationId } };
}
