import type { Metadata } from 'next';
import { Be_Vietnam_Pro, Patrick_Hand } from 'next/font/google';
import './globals.css';

const hand = Patrick_Hand({ weight: '400', subsets: ['latin', 'vietnamese'], variable: '--font-patrick' });
const body = Be_Vietnam_Pro({ weight: ['400', '500', '600', '700'], subsets: ['latin', 'vietnamese'], variable: '--font-bevn' });

export const metadata: Metadata = {
  title: 'SA Builder — Game cho Solution Architect',
  description: 'Dựng kiến trúc, cho traffic và sự cố chạy qua, đạt mọi ràng buộc của một Solution Architect.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={`${hand.variable} ${body.variable}`}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
