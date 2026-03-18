'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

function setCookie(key: string) {
  const secure = location.protocol === 'https:' ? '; secure' : '';
  document.cookie = `api_key=${encodeURIComponent(key.trim())}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=strict${secure}`;
}

export default function LoginPage() {
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!key.trim()) return;
    setError('');
    setLoading(true);
    try {
      // Always validate the key before saving it
      const res = await fetch('/api/prompts', {
        headers: { 'x-api-key': key.trim() },
      });
      if (res.ok) {
        setCookie(key);
        router.push('/');
        router.refresh();
      } else {
        setError('Clé invalide');
      }
    } catch {
      setError('Erreur de connexion au serveur');
    } finally {
      setLoading(false);
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

          <button type="submit" disabled={loading || !key.trim()} className="btn btn-primary w-full">
            {loading ? <><span className="spinner" /> Vérification...</> : '🔑 Se connecter'}
          </button>
        </form>

        <p className="text-xs text-[var(--muted)] text-center">
          La clé est définie dans la variable <code className="bg-[var(--background)] px-1 rounded">API_SECRET</code>
        </p>
      </div>
    </div>
  );
}
