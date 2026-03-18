import type { Metadata } from 'next';
import './globals.css';
import Sidebar from '@/components/Sidebar';

export const metadata: Metadata = {
  title: 'LinkedIn AutoPilot',
  description: 'Génération automatisée de posts LinkedIn',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="antialiased">
        <Sidebar />
        <main className="md:ml-56 min-h-screen pb-20 md:pb-0">
          <div className="max-w-4xl mx-auto p-4 md:p-8">
            {children}
          </div>
        </main>
      </body>
    </html>
  );
}
