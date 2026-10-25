import { Star } from 'lucide-react';

export function Stars({ value, max = 3, size = 16 }: { value: number; max?: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} trên ${max} sao`}>
      {Array.from({ length: max }, (_, i) => (
        <Star
          key={i}
          width={size}
          height={size}
          strokeWidth={1.8}
          className={i < value ? 'fill-yellow-400 text-ink' : 'text-line'}
        />
      ))}
    </span>
  );
}
