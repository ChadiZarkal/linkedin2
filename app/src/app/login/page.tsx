'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!key.trim()) return;

    // Set cookie and redirect
    document.cookie = `api_key=${key.trim()}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=strict`;
    router.push('/');
    router.refresh();
  }

  // Quick test if key works
  async function testKey() {
    if (!key.trim()) return;
    setError('');
    try {
      const res = await fetch('/api/prompts', {
        headers: { 'x-api-key': key.trim() },
      });
      if (res.ok) {
        document.cookie = `api_key=${key.trim()}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=strict`;
        router.push('/');
        router.refresh();
      } else {
        setError('Clé invalide');
      }
    } catch {
      setError('Erreur de connexion');
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
      <div className="bg-[var(--card)] rounded-xl p-8 border border-[var(--border)] w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-xl font-bold">LinkedIn AutoPilot</h1>
          <p className="text-xs text-[var(--muted)] mt-1">Entrez votre clé API pour accéder au dashboard</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="password"
            value={key}
            onChange={e => setKey(e.target.value)}
            placeholder="Clé API (API_SECRET)"
            className="w-full bg-[var(--background)] border border-[var(--border)] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[var(--accent)] transition-colors"
            autoFocus
          />

          {error && (
            <p className="text-red-400 text-xs">{error}</p>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={testKey}
              className="flex-1 px-4 py-2.5 bg-[var(--border)] hover:bg-[var(--card-hover)] rounded-lg text-sm transition-colors"
            >
              Tester
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] rounded-lg text-sm font-medium transition-colors"
            >
              Connexion
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
