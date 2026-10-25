import { notFound } from 'next/navigation';
import { worlds } from '@sa/content';
import { TopNav } from '@/components/ui/TopNav';
import { WorldClient } from '@/components/world/WorldClient';

export function generateStaticParams() {
  return worlds.filter((w) => w.status === 'open').map((w) => ({ world: w.id }));
}

export default async function WorldPage({ params }: { params: Promise<{ world: string }> }) {
  const { world } = await params;
  const w = worlds.find((x) => x.id === world && x.status === 'open');
  if (!w) notFound();
  return (
    <>
      <TopNav active="worlds" />
      <WorldClient worldId={w.id} />
    </>
  );
}
