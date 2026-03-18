'use client';

import { useState, useEffect } from 'react';

interface Prompts {
  research: string;
  writer: string;
  globalPrompt: string;
}

export default function PromptsPage() {
  const [prompts, setPrompts] = useState<Prompts | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { fetchPrompts(); }, []);

  async function fetchPrompts() {
    try {
      const res = await fetch('/api/prompts');
      const data = await res.json();
      if (data.success) setPrompts(data.data);
    } catch (err) {
      console.error('Fetch prompts error:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!prompts) return;
    setSaving(true);
    setSaved(false);

    try {
      const res = await fetch('/api/prompts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prompts),
      });
      const data = await res.json();
      if (data.success) {
        setPrompts(data.data);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        alert(`Erreur: ${data.error}`);
      }
    } catch (err) {
      alert(`Erreur: ${err instanceof Error ? err.message : 'unknown'}`);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="text-center py-12 text-[var(--muted)]">
        <div className="w-6 h-6 border-2 border-[var(--accent)]/30 border-t-[var(--accent)] rounded-full animate-spin mx-auto mb-3" />
        Chargement...
      </div>
    );
  }

  if (!prompts) return <p className="text-red-400">Erreur de chargement</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Prompts</h1>
          <p className="text-[var(--muted)] text-sm mt-1">
            Configure les instructions pour chaque agent. Sauvegardé sur GitHub.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
            saved
              ? 'bg-[var(--success)] text-black'
              : 'bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50'
          }`}
        >
          {saving ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Sauvegarde...
            </span>
          ) : saved ? '✅ Sauvegardé !' : '💾 Sauvegarder'}
        </button>
      </div>

      {/* Global Prompt */}
      <div className="bg-[var(--card)] rounded-xl p-5 border border-[var(--border)] space-y-3">
        <div>
          <h2 className="font-semibold flex items-center gap-2">
            🌐 Prompt Global
          </h2>
          <p className="text-xs text-[var(--muted)] mt-1">
            Appliqué à TOUS les agents. Idéal pour définir le ton, le contexte ou des règles globales.
          </p>
        </div>
        <textarea
          value={prompts.globalPrompt}
          onChange={e => setPrompts({ ...prompts, globalPrompt: e.target.value })}
          placeholder="Ex: Tu écris pour un profil LinkedIn tech. Ton : professionnel mais décontracté. Évite le jargon excessif."
          className="w-full bg-[var(--background)] border border-[var(--border)] rounded-lg p-3 text-sm min-h-[100px] focus:outline-none focus:border-[var(--accent)] transition-colors"
        />
      </div>

      {/* Research Agent Prompt */}
      <div className="bg-[var(--card)] rounded-xl p-5 border border-[var(--border)] space-y-3">
        <div>
          <h2 className="font-semibold flex items-center gap-2">
            🔍 Agent Recherche
          </h2>
          <p className="text-xs text-[var(--muted)] mt-1">
            Cet agent cherche sur internet les dernières actualités pour un sujet donné.
          </p>
        </div>
        <textarea
          value={prompts.research}
          onChange={e => setPrompts({ ...prompts, research: e.target.value })}
          className="w-full bg-[var(--background)] border border-[var(--border)] rounded-lg p-3 text-sm min-h-[200px] focus:outline-none focus:border-[var(--accent)] transition-colors font-mono"
        />
      </div>

      {/* Writer Agent Prompt */}
      <div className="bg-[var(--card)] rounded-xl p-5 border border-[var(--border)] space-y-3">
        <div>
          <h2 className="font-semibold flex items-center gap-2">
            ✍️ Agent Rédacteur
          </h2>
          <p className="text-xs text-[var(--muted)] mt-1">
            Cet agent rédige le post LinkedIn à partir des informations de recherche.
          </p>
        </div>
        <textarea
          value={prompts.writer}
          onChange={e => setPrompts({ ...prompts, writer: e.target.value })}
          className="w-full bg-[var(--background)] border border-[var(--border)] rounded-lg p-3 text-sm min-h-[200px] focus:outline-none focus:border-[var(--accent)] transition-colors font-mono"
        />
      </div>
    </div>
  );
}
