import type { Level } from '@sa/engine';
import { safeStorage } from './storage';

export interface LevelProgress {
  bestStars: number;
  bestScore: number;
  passed: boolean;
  runs: number;
}

export type Progress = Record<string, LevelProgress>;

const KEY = 'sab:progress:v1';

export function loadProgress(): Progress {
  return safeStorage.getJson<Progress>(KEY, {});
}

export function recordRun(levelId: string, stars: number, score: number, passed: boolean): Progress {
  const all = loadProgress();
  const prev = all[levelId] ?? { bestStars: 0, bestScore: 0, passed: false, runs: 0 };
  all[levelId] = {
    bestStars: Math.max(prev.bestStars, stars),
    bestScore: Math.max(prev.bestScore, score),
    passed: prev.passed || passed,
    runs: prev.runs + 1,
  };
  safeStorage.setJson(KEY, all);
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('sab-progress'));
  return all;
}

export function totalStars(p: Progress): number {
  return Object.values(p).reduce((s, x) => s + x.bestStars, 0);
}

/** A level opens once the previous level of its world has been passed. */
export function isUnlocked(levels: Level[], levelId: string, p: Progress): boolean {
  const sorted = [...levels].sort((a, b) => a.order - b.order);
  const idx = sorted.findIndex((l) => l.id === levelId);
  if (idx <= 0) return true;
  return !!p[sorted[idx - 1].id]?.passed;
}

export const TITLES: { min: number; title: string; blurb: string }[] = [
  { min: 0, title: 'Senior Dev', blurb: 'Code giỏi, giờ học cách nghĩ như kiến trúc sư.' },
  { min: 5, title: 'Junior SA', blurb: 'Đã biết hỏi trước khi vẽ.' },
  { min: 11, title: 'Solution Architect', blurb: 'Cân được build/buy, DR, legacy và migration.' },
  { min: 17, title: 'Senior SA', blurb: 'Khách hàng khó tính nhất cũng gật đầu.' },
  { min: 23, title: 'Principal Architect', blurb: 'Thắng thầu với điểm gần tuyệt đối.' },
];

export function titleFor(stars: number) {
  let t = TITLES[0];
  for (const x of TITLES) if (stars >= x.min) t = x;
  const next = TITLES.find((x) => x.min > stars);
  return { ...t, next };
}
