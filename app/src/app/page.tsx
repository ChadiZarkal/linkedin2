'use client';

import { useState } from 'react';

interface ResearchResult {
  topic: string;
  content: string;
  sources: string[];
}

interface Post {
  id: string;
  topic: string;
  content: string;
  status: string;
}

export default function GeneratePage() {
  const [topic, setTopic] = useState('');
  const [research, setResearch] = useState<ResearchResult | null>(null);
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState<'idle' | 'researching' | 'generating'>('idle');
  const [error, setError] = useState('');

  // Step 1: Research
  async function handleResearch() {
    if (!topic.trim()) return;
    setLoading('researching');
    setError('');
    setResearch(null);
    setPost(null);

    try {
      const res = await fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: topic.trim() }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setResearch(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur recherche');
    } finally {
      setLoading('idle');
    }
  }

  // Step 2: Generate post
  async function handleGenerate() {
    if (!research) return;
    setLoading('generating');
    setError('');

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: research.topic,
          research: research.content,
          sources: research.sources,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setPost(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur génération');
    } finally {
      setLoading('idle');
    }
  }

  // Quick auto: research + generate in one click
  async function handleAuto() {
    if (!topic.trim()) return;
    setLoading('researching');
    setError('');
    setResearch(null);
    setPost(null);

    try {
      // Research
      const resRes = await fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: topic.trim() }),
      });
      const resData = await resRes.json();
      if (!resData.success) throw new Error(resData.error);
      setResearch(resData.data);

      // Generate
      setLoading('generating');
      const genRes = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: resData.data.topic,
          research: resData.data.content,
          sources: resData.data.sources,
        }),
      });
      const genData = await genRes.json();
      if (!genData.success) throw new Error(genData.error);
      setPost(genData.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setLoading('idle');
    }
  }

  function reset() {
    setTopic('');
    setResearch(null);
    setPost(null);
    setError('');
    setLoading('idle');
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Générer un post</h1>
        <p className="text-[var(--muted)] text-sm mt-1">
          Donne un sujet → l&apos;agent recherche → l&apos;agent rédige → sauvegardé sur GitHub
        </p>
      </div>

      {/* Topic input */}
      <div className="bg-[var(--card)] rounded-xl p-5 border border-[var(--border)] space-y-4">
        <label className="block text-sm font-medium">Sujet / Mot-clé</label>
        <div className="flex gap-3">
          <input
            type="text"
            value={topic}
            onChange={e => setTopic(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleResearch()}
            placeholder="Ex: IA générative, cybersécurité, React 2026..."
            className="flex-1 bg-[var(--background)] border border-[var(--border)] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[var(--accent)] transition-colors"
            disabled={loading !== 'idle'}
          />
          <button
            onClick={handleResearch}
            disabled={loading !== 'idle' || !topic.trim()}
            className="px-5 py-2.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-40 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
          >
            {loading === 'researching' ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Recherche...
              </span>
            ) : '🔍 Rechercher'}
          </button>
          <button
            onClick={handleAuto}
            disabled={loading !== 'idle' || !topic.trim()}
            className="px-5 py-2.5 bg-[var(--success)] hover:opacity-90 disabled:opacity-40 rounded-lg text-sm font-medium transition-colors whitespace-nowrap text-black"
          >
            ⚡ Auto
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm animate-fadeIn">
          {error}
        </div>
      )}

      {/* Research results */}
      {research && (
        <div className="bg-[var(--card)] rounded-xl p-5 border border-[var(--border)] space-y-4 animate-fadeIn">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">🔍 Résultat de la recherche</h2>
            {!post && (
              <button
                onClick={handleGenerate}
                disabled={loading !== 'idle'}
                className="px-4 py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-40 rounded-lg text-sm font-medium transition-colors"
              >
                {loading === 'generating' ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Rédaction...
                  </span>
                ) : '✍️ Rédiger le post'}
              </button>
            )}
          </div>
          <div className="bg-[var(--background)] rounded-lg p-4 text-sm whitespace-pre-wrap max-h-80 overflow-y-auto leading-relaxed">
            {research.content}
          </div>
          {research.sources.length > 0 && (
            <div>
              <p className="text-xs font-medium text-[var(--muted)] mb-2">Sources ({research.sources.length})</p>
              <div className="flex flex-wrap gap-2">
                {research.sources.map((s, i) => {
                  try {
                    return (
                      <a
                        key={i}
                        href={s}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs bg-[var(--background)] px-2.5 py-1 rounded-full border border-[var(--border)] text-[var(--accent)] hover:border-[var(--accent)] transition-colors truncate max-w-xs"
                      >
                        {new URL(s).hostname}
                      </a>
                    );
                  } catch {
                    return <span key={i} className="text-xs text-[var(--muted)]">{s}</span>;
                  }
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Generated post */}
      {post && (
        <div className="bg-[var(--card)] rounded-xl p-5 border border-[var(--border)] space-y-4 animate-fadeIn">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">✅ Post généré</h2>
            <span className="text-xs bg-[var(--success)]/20 text-[var(--success)] px-2.5 py-1 rounded-full">
              Sauvegardé sur GitHub
            </span>
          </div>
          <div className="bg-[var(--background)] rounded-lg p-4 text-sm whitespace-pre-wrap leading-relaxed">
            {post.content}
          </div>
          <div className="flex gap-3">
            <button
              onClick={reset}
              className="px-4 py-2 bg-[var(--border)] hover:bg-[var(--card-hover)] rounded-lg text-sm transition-colors"
            >
              🔄 Nouveau post
            </button>
            <a
              href="/posts"
              className="px-4 py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] rounded-lg text-sm font-medium transition-colors"
            >
              📄 Voir les posts
            </a>
          </div>
        </div>
      )}

      {/* Loading state overlay */}
      {loading !== 'idle' && !research && !post && (
        <div className="bg-[var(--card)] rounded-xl p-8 border border-[var(--border)] text-center animate-fadeIn">
          <div className="w-8 h-8 border-3 border-[var(--accent)]/30 border-t-[var(--accent)] rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-[var(--muted)]">
            {loading === 'researching' 
              ? 'L\'agent recherche les dernières actualités...' 
              : 'L\'agent rédige votre post LinkedIn...'}
          </p>
        </div>
      )}
    </div>
  );
}
