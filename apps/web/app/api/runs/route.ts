import { NextResponse } from 'next/server';
import { handleRun, type RunDeps } from '@/lib/runs';
import { adminClient, serverClient } from '@/lib/supabase/server';

async function deps(): Promise<RunDeps | null> {
  const user = await serverClient();
  const admin = adminClient();
  if (!user || !admin) return null;
  return {
    async currentUserId() {
      const { data } = await user.auth.getUser();
      return data.user?.id ?? null;
    },
    async saveRun(r) {
      const { error } = await admin.from('runs').insert({
        user_id: r.userId,
        level_id: r.levelId,
        evaluation_id: r.evaluationId,
        passed: r.passed,
        stars: r.stars,
        overall: r.overall,
        monthly_usd: r.monthlyUsd,
        tco3y_usd: r.tco3yUsd,
        design: r.design,
      });
      if (error) throw new Error(error.message);
    },
  };
}

export async function POST(request: Request) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  try {
    const out = await handleRun(raw, await deps());
    return NextResponse.json(out.json, { status: out.status });
  } catch {
    return NextResponse.json({ error: 'save_failed' }, { status: 500 });
  }
}
