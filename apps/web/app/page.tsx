import { HomeClient } from '@/components/home/HomeClient';
import { TopNav } from '@/components/ui/TopNav';

export default function Home() {
  return (
    <>
      <TopNav active="worlds" />
      <HomeClient />
    </>
  );
}
