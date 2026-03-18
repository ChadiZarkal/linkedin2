'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/', label: 'Générer', icon: '⚡' },
  { href: '/posts', label: 'Posts', icon: '📄' },
  { href: '/prompts', label: 'Prompts', icon: '🧠' },
  { href: '/schedule', label: 'Planning', icon: '📅' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  function handleLogout() {
    document.cookie = 'api_key=; path=/; max-age=0';
    router.push('/login');
    router.refresh();
  }

  // Don't show sidebar on login page
  if (pathname === '/login') return null;

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-56 h-screen fixed left-0 top-0 border-r border-[var(--border)] bg-[var(--background)] z-50">
        <div className="p-5 border-b border-[var(--border)]">
          <h1 className="text-lg font-bold">LinkedIn AutoPilot</h1>
          <p className="text-xs text-[var(--muted)] mt-1">v2 — Simplifié</p>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV_ITEMS.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                pathname === item.href
                  ? 'bg-[var(--accent)] text-white font-medium shadow-lg shadow-[var(--accent)]/20'
                  : 'text-[var(--muted)] hover:text-white hover:bg-[var(--card)]'
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-3 border-t border-[var(--border)]">
          <button onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[var(--muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors w-full">
            <span className="text-base">🚪</span>
            Déconnexion
          </button>
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[var(--background)] border-t border-[var(--border)] z-50 flex">
        {NAV_ITEMS.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs transition-colors ${
              pathname === item.href
                ? 'text-[var(--accent)] font-medium'
                : 'text-[var(--muted)]'
            }`}
          >
            <span className="text-lg">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>
    </>
  );

}
