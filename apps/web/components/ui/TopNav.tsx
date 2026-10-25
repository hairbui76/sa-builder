import Link from 'next/link';
import { AuthButton } from './AuthButton';

export function TopNav({ active }: { active?: 'worlds' | 'concepts' | 'leaderboard' }) {
  const item = (href: string, key: string, label: string) => (
    <Link
      href={href}
      className={`font-hand text-lg px-2 ${active === key ? 'wavy-underline' : 'text-ink-2 hover:text-ink'}`}
    >
      {label}
    </Link>
  );
  return (
    <header className="border-b-2 border-ink bg-paper">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="font-hand text-2xl text-mint">SA</span>
          <span className="font-hand text-2xl">Builder</span>
        </Link>
        <span className="hidden text-sm text-muted sm:inline">Game cho Solution Architect</span>
        <nav className="ml-auto flex items-center gap-1 sm:gap-3">
          {item('/', 'worlds', 'Thế giới')}
          {item('/concepts', 'concepts', 'Khái niệm')}
          {item('/leaderboard', 'leaderboard', 'Bảng xếp hạng')}
          <AuthButton />
        </nav>
      </div>
    </header>
  );
}
