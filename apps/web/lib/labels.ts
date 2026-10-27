export const DIFFICULTY: Record<number, { label: string; cls: string }> = {
  1: { label: 'Dễ', cls: 'bg-ok-soft text-ok' },
  2: { label: 'Vừa', cls: 'bg-sky/40 text-ink' },
  3: { label: 'Khó', cls: 'bg-warn-soft text-warn' },
  4: { label: 'Boss', cls: 'bg-bad-soft text-bad' },
};

export function usd(v: number): string {
  return '$' + (Math.round(v * 100) / 100).toLocaleString('en-US', { maximumFractionDigits: v >= 1000 ? 0 : 2 });
}
