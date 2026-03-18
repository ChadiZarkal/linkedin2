'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const [testing, setTesting] = useState(false);
  const router = useRouter();

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!key.trim()) return;
    document.cookie = `api_key=${key.trim()}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=strict`;
    router.push('/');
    router.refresh();
  }

  async function testKey() {
    if (!key.trim()) return;
    setError('');
    setTesting(true);
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
      setError('Erreur de connexion au serveur');
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
      <div className="card w-full max-w-sm space-y-6 animate-slideUp">
        <div className="text-center">
          <div className="text-4xl mb-3">🚀</div>
          <h1 className="text-xl font-bold">LinkedIn AutoPilot</h1>
          <p className="text-xs text-[var(--muted)] mt-1">Entrez votre clé API pour accéder au dashboard</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="password"
            value={key}
            onChange={e => setKey(e.target.value)}
            placeholder="Clé API (API_SECRET)"
            className="input text-center"
            autoFocus
          />

          {error && (
            <p className="text-red-400 text-xs text-center animate-fadeIn">{error}</p>
          )}

          <div className="flex gap-3">
            <button type="button" onClick={testKey} disabled={testing || !key.trim()}
              className="btn btn-ghost flex-1">
              {testing ? <span className="spinner spinner-accent" /> : 'Tester'}
            </button>
            <button type="submit" disabled={!key.trim()} className="btn btn-primary flex-1">
              Connexion
            </button>
          </div>
        </form>

        <p className="text-xs text-[var(--muted)] text-center">
          La clé est définie dans la variable <code className="bg-[var(--background)] px-1 rounded">API_SECRET</code>
        </p>
      </div>
    </div>
  );
}
