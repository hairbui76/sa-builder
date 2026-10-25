import { notFound } from 'next/navigation';
import { levels } from '@sa/content';
import { GameClient } from '@/components/game/GameClient';

export function generateStaticParams() {
  return levels.map((l) => ({ level: l.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ level: string }> }) {
  const { level } = await params;
  const l = levels.find((x) => x.id === level);
  return { title: l ? `${l.title} · SA Builder` : 'SA Builder' };
}

export default async function LevelPage({ params }: { params: Promise<{ level: string }> }) {
  const { level } = await params;
  if (!levels.some((l) => l.id === level)) notFound();
  return <GameClient levelId={level} />;
}
