'use client';

import { useState } from 'react';
import { useToast } from '@/components/Toast';

import type { ResearchResult, Post } from '@/lib/types';

const TOPIC_SUGGESTIONS = [
  'IA générative 2026',
  'Cybersécurité entreprise',
  'Leadership & management',
  'Green Tech / Tech durable',
  'Productivité au travail',
  'Tendances blockchain',
];

export default function GeneratePage() {
  const [topic, setTopic] = useState('');
  const [research, setResearch] = useState<ResearchResult | null>(null);
  const [post, setPost] = useState<Post | null>(null);
  const [step, setStep] = useState<'topic' | 'research' | 'generating' | 'done'>('topic');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { toast } = useToast();

  async function handleResearch() {
    if (!topic.trim()) return;
    setLoading(true);
    setError('');
    setResearch(null);
    setPost(null);
    setStep('research');

    try {
      const res = await fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: topic.trim() }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setResearch(data.data);
      toast('Recherche terminée !', 'success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur recherche');
      setStep('topic');
      toast('Erreur lors de la recherche', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerate() {
    if (!research) return;
    setLoading(true);
    setError('');
    setStep('generating');

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
      setStep('done');
      toast('Post généré et sauvegardé !', 'success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur génération');
      setStep('research');
      toast('Erreur lors de la génération', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleAutoGenerate() {
    if (!topic.trim()) return;
    setLoading(true);
    setError('');
    setResearch(null);
    setPost(null);
    setStep('research');

    try {
      const resRes = await fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: topic.trim() }),
      });
      const resData = await resRes.json();
      if (!resData.success) throw new Error(resData.error);
      setResearch(resData.data);

      setStep('generating');
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
      setStep('done');
      toast('Post auto-généré avec succès !', 'success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
      setStep('topic');
      toast('Erreur lors de la génération', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handlePublishNow() {
    if (!post) return;
    setLoading(true);
    try {
      const res = await fetch('/api/posts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: post.id, action: 'publish' }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setPost(data.data);
      toast('Publié sur LinkedIn !', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Erreur publication', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!post) return;
    try {
      await navigator.clipboard.writeText(post.content);
      toast('Copié dans le presse-papier !', 'success');
    } catch {
      toast('Impossible de copier', 'error');
    }
  }

  function reset() {
    setTopic('');
    setResearch(null);
    setPost(null);
    setError('');
    setStep('topic');
    setLoading(false);
  }

  const steps = ['Sujet', 'Recherche', 'Rédaction', 'Terminé'];
  const stageKeys = ['topic', 'research', 'generating', 'done'];
  const currentIdx = stageKeys.indexOf(step);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Générer un post</h1>
        <p className="text-[var(--muted)] text-sm mt-1">
          Un sujet → Recherche IA → Post LinkedIn prêt à publier
        </p>
      </div>

      {/* Progress bar */}
      <div className="flex items-center gap-2 text-xs">
        {steps.map((label, i) => (
          <div key={label} className="flex items-center gap-2 flex-1">
            <div className={`flex items-center gap-2 ${i <= currentIdx ? 'text-[var(--accent)]' : 'text-[var(--muted)]'}`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all
                ${i === currentIdx && loading ? 'border-[var(--accent)] animate-pulse-slow' : ''}
                ${i <= currentIdx ? 'border-[var(--accent)] bg-[var(--accent)]/20' : 'border-[var(--border)]'}`}>
                {i < currentIdx ? '✓' : i + 1}
              </div>
              <span className="hidden sm:inline font-medium">{label}</span>
            </div>
            {i < 3 && <div className={`flex-1 h-0.5 rounded ${i < currentIdx ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'}`} />}
          </div>
        ))}
      </div>

      {/* Topic input */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium">Sujet / Mot-clé</label>
          {step !== 'topic' && (
            <button onClick={reset} className="text-xs text-[var(--accent)] hover:underline">↺ Recommencer</button>
          )}
        </div>
        <div className="flex gap-3">
          <input
            type="text"
            value={topic}
            onChange={e => setTopic(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !loading && handleResearch()}
            placeholder="Ex: IA générative, cybersécurité, React 2026..."
            className="input flex-1"
            disabled={loading}
          />
          <button onClick={handleResearch} disabled={loading || !topic.trim()} className="btn btn-primary">
            {loading && step === 'research' && !research ? <><span className="spinner" /> Recherche...</> : '🔍 Rechercher'}
          </button>
          <button onClick={handleAutoGenerate} disabled={loading || !topic.trim()} className="btn btn-success" title="Recherche + rédaction en un clic">
            ⚡ Auto
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-[var(--muted)] self-center">Suggestions :</span>
          {TOPIC_SUGGESTIONS.map(s => (
            <button key={s} onClick={() => setTopic(s)} disabled={loading}
              className="text-xs px-2.5 py-1 rounded-full bg-[var(--background)] border border-[var(--border)] text-[var(--muted)] hover:text-white hover:border-[var(--accent)] transition-colors disabled:opacity-40">
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm animate-fadeIn flex items-center gap-3">
          <span className="text-lg">❌</span>
          <div className="flex-1">
            <p className="font-medium">Erreur</p>
            <p className="text-xs mt-0.5 opacity-80">{error}</p>
          </div>
          <button onClick={() => setError('')} className="text-red-400/60 hover:text-red-400 text-xl">&times;</button>
        </div>
      )}

      {/* Research results */}
      {research && (
        <div className="card space-y-4 animate-slideUp">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">🔍</span>
              Résultat de la recherche
            </h2>
            {!post && !loading && (
              <button onClick={handleGenerate} disabled={loading} className="btn btn-primary">
                ✍️ Rédiger le post
              </button>
            )}
          </div>
          <div className="bg-[var(--background)] rounded-lg p-4 text-sm whitespace-pre-wrap max-h-72 overflow-y-auto leading-relaxed">
            {research.content}
          </div>
          {research.sources.length > 0 && (
            <div>
              <p className="text-xs font-medium text-[var(--muted)] mb-2">📌 Sources ({research.sources.length})</p>
              <div className="flex flex-wrap gap-2">
                {research.sources.map((s, i) => {
                  try {
                    return (
                      <a key={i} href={s} target="_blank" rel="noopener noreferrer"
                        className="text-xs bg-[var(--background)] px-2.5 py-1 rounded-full border border-[var(--border)] text-[var(--accent)] hover:border-[var(--accent)] transition-colors truncate max-w-xs">
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
        <div className="card space-y-4 animate-slideUp">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">✅</span>
              Post généré
            </h2>
            <span className={`text-xs px-3 py-1 rounded-full border ${
              post.status === 'published' 
                ? 'bg-green-500/20 text-green-400 border-green-500/30' 
                : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
            }`}>
              {post.status === 'published' ? '🟢 Publié' : '⏳ En attente'}
            </span>
          </div>

          <div className="bg-[var(--background)] rounded-lg p-5 text-sm whitespace-pre-wrap leading-relaxed border border-[var(--border)]">
            {post.content}
          </div>

          <div className="flex items-center justify-between text-xs text-[var(--muted)]">
            <span>{post.content.length} caractères</span>
            <span>{post.content.split('\n').filter(l => l.trim()).length} lignes</span>
          </div>

          <div className="flex flex-wrap gap-3 pt-3 border-t border-[var(--border)]">
            {post.status !== 'published' && (
              <button onClick={handlePublishNow} disabled={loading} className="btn btn-success btn-lg">
                {loading ? <><span className="spinner" /> Publication...</> : '🚀 Publier sur LinkedIn'}
              </button>
            )}
            <button onClick={handleCopy} className="btn btn-ghost">📋 Copier</button>
            <a href="/posts" className="btn btn-ghost">📄 Voir les posts</a>
            <button onClick={reset} className="btn btn-ghost">🔄 Nouveau</button>
          </div>
        </div>
      )}

      {/* Loading states */}
      {loading && !research && !post && (
        <div className="card text-center py-10 animate-fadeIn">
          <div className="w-10 h-10 border-[3px] border-[var(--accent)]/30 border-t-[var(--accent)] rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-[var(--muted)]">
            {step === 'research' ? "L'agent recherche les dernières actualités..." : "L'agent rédige votre post LinkedIn..."}
          </p>
          <p className="text-xs text-[var(--muted)] mt-2 opacity-60">Cela peut prendre 15-30 secondes</p>
        </div>
      )}
      {loading && research && !post && (
        <div className="card text-center py-8 animate-fadeIn">
          <div className="w-8 h-8 border-[3px] border-[var(--accent)]/30 border-t-[var(--accent)] rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-[var(--muted)]">L&apos;agent rédige votre post LinkedIn...</p>
        </div>
      )}
    </div>
  );
}
