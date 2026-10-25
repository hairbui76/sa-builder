# SA Builder MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A playable web game where each level is a client engagement (Discovery → Design → Simulate → Review), with World 1 "Hợp đồng đầu tiên" (8 levels).

**Architecture:** pnpm monorepo. `packages/engine` is a pure deterministic evaluator (compile graph → static analyzers → fluid tick simulation → rules → review). `packages/content` holds the neutral catalog, concepts and level data typed against the engine. `apps/web` is Next.js + React Flow; progress in localStorage, optional Supabase for auth, server-verified runs and leaderboard.

**Tech Stack:** TypeScript 5, pnpm workspaces, Vitest, Zod, Next.js 16 (App Router), React 19, @xyflow/react 12, Tailwind CSS 4, Supabase (`@supabase/ssr`, `@supabase/supabase-js`), Playwright.

**Spec:** `docs/superpowers/specs/2026-10-25-sa-builder-mvp-design.md`

## Global Constraints

- Engine: no I/O, no `Date`, no `Math.random`, no `Math.pow/exp/log/sqrt`; same input → same output.
- All player-facing content in Vietnamese; UI chrome strings via a small `vi`/`en` dictionary.
- Every catalog component carries a mapping `{ aws, azure, gcp, onprem }`.
- The game must be fully playable with no env vars (local mode); Supabase features activate only when env vars exist.
- UI imitates 200Lab's layout/sketch style with original code; no copied assets, data or text.

## Review Focus

- Design with zero nodes / dangling edges / edge to a node type that cannot accept it → engine returns validation reasons, never throws.
- A hidden (undiscovered) rule fails → review names the missed fact so the lesson is visible.
- Level content edited after a player saved a design (node type no longer in palette) → load drops unknown nodes instead of crashing.
- localStorage unavailable (private mode) → game still plays, progress just isn't kept.
- Supabase env present but user signed out → runs evaluate locally, no API errors surface.

Each line is pinned by a test in the owning task (engine validation tests in Task 3, review test in Task 5, `loadDesign` test in Task 8, storage wrapper test in Task 8, API route test in Task 10).

---

### Task 1: Monorepo scaffold

**Files:** `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.gitignore`, `packages/engine/{package.json,tsconfig.json,vitest.config.ts}`, `packages/content/{package.json,tsconfig.json}`.

- [ ] `pnpm install` succeeds; `pnpm -r test` runs (no tests yet → passes with `--passWithNoTests`).
- [ ] Commit `chore: scaffold monorepo`.

### Task 2: Engine types + catalog schema

**Files:** `packages/engine/src/types.ts`, `packages/engine/src/schema.ts`, `packages/engine/src/index.ts`.

**Produces:** `Behavior`, `ComponentDef`, `TierDef`, `TrafficKind`, `Level`, `Design`, `DesignNode`, `DesignEdge`, `Rule` (discriminated union on `check`), `Decision`, `DecisionOption`, `Effects`, `EvalResult`, `Pillar`; `componentDefSchema`, `levelSchema` (zod).

- [ ] Test: `schema.test.ts` — a minimal valid level parses; a rule with unknown `check` fails.
- [ ] Commit.

### Task 3: Compile (validation + routing)

**Files:** `packages/engine/src/compile.ts`, test `compile.test.ts`.

**Produces:** `compile(level, design, catalog): Compiled` where `Compiled = { nodes: Map<string, CNode>; routes: Record<kindId, Route>; issues: Reason[] }`, `Route = { visits: Visit[]; queueId?: string; jobVisits: Visit[]; ok: boolean; touched: Set<nodeId> }`, `Visit = { nodeId: string; weight: number; tags: DataTag[] }`.

- [ ] Tests: users→LB→2 app→DB gives each app weight 0.5 and DB weight = calls count; cache with hit 0.8 sends 0.2 of reads to DB; missing provider gives `no_path` reason; edge to unknown node is ignored with `invalid_edge` reason; empty design does not throw.
- [ ] Commit.

### Task 4: Static analyzers + simulation

**Files:** `packages/engine/src/analyze.ts`, `packages/engine/src/simulate.ts`, tests.

**Produces:** `analyze(level, design, compiled, catalog): Analysis` (`monthlyUsd`, `costBreakdown`, `tco3yUsd`, `devMonths`, `calendarMonths`, `unfamiliarTech`, `flags`, `touchedBy: Record<DataTag, nodeId[]>`, `rto/rpo per decision`), `simulate(level, compiled): SimResult` (`perKind: { offered, answered, avgLatencyMs, series }`, `jobs: { done, total, maxWaitS }`, `nodePeak: Record<id,{util, dropped}>`, `breaches`).

- [ ] Tests: overload ratio 2 → answered ≈ 50 %; node_down with standby keeps answered ≥ 99 %; queue+worker drains backlog at provider rate; WAF blocks malicious kind; region latency adds per hop; determinism (two runs deep-equal).
- [ ] Commit.

### Task 5: Rules, review, evaluate

**Files:** `packages/engine/src/rules.ts`, `packages/engine/src/review.ts`, `packages/engine/src/evaluate.ts`.

**Produces:** `evaluate(level, design, catalog): EvalResult` — `{ passed, stars, goals: GoalResult[], pillars: Record<Pillar, number|null>, overall, stakeholders: Verdict[], reasons: Reason[], missedFacts: string[], sim, analysis }`.

- [ ] Tests: hidden rule failing is reported with `missedFacts`; stars thresholds 70/85 + TCO; stakeholder verdict maps concerns.
- [ ] Commit.

### Task 6: Content — catalog, concepts, World 1 levels + golden tests

**Files:** `packages/content/src/catalog.ts`, `concepts.ts`, `levels/l1..l8.ts`, `worlds.ts`, `index.ts`; tests `content.test.ts`, `golden.test.ts`.

- [ ] Each level exports `reference` (passes with ≥ 2★) and `naive` designs (fail with expected reason/rule ids).
- [ ] All content parses with zod schemas.
- [ ] Commit per 2 levels.

### Task 7: Web shell + world pages

**Files:** `apps/web` (Next.js), `app/page.tsx`, `app/worlds/[world]/page.tsx`, `app/concepts/page.tsx`, `components/ui/*`, `lib/i18n.ts`, sketch theme CSS.

- [ ] `pnpm --filter web build` passes.

### Task 8: Level player

**Files:** `app/levels/[level]/page.tsx`, `components/game/{Board,Palette,Inspector,GoalsPanel,Discovery,Decisions,RunPanel,ReviewPanel,Header}.tsx`, `lib/store.ts` (zustand), `lib/storage.ts`.

**Produces:** `loadDesign(level, raw): Design` (drops unknown nodes/edges), `safeStorage` (try/catch wrapper).

- [ ] Unit tests for `loadDesign` and `safeStorage`.
- [ ] Commit.

### Task 9: Playwright smoke

- [ ] Script opens level 1, asks questions, builds the reference design via store helper, runs, sees stars.

### Task 10: Supabase (optional mode)

**Files:** `supabase/migrations/0001_init.sql`, `lib/supabase/*`, `app/api/runs/route.ts`, `app/leaderboard/page.tsx`, `app/login/page.tsx`.

- [ ] Migration applies on local Postgres 16 (with a stub `auth.users`).
- [ ] API route test: no env → 501 JSON; invalid body → 400.
- [ ] Commit, push, README with setup.
