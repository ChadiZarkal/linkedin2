'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/components/Toast';

import type { Prompts } from '@/lib/types';

export default function PromptsPage() {
  const [prompts, setPrompts] = useState<Prompts | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [original, setOriginal] = useState<Prompts | null>(null);
  const { toast } = useToast();

  useEffect(() => { fetchPrompts(); }, []);

  // Warn on leave with unsaved changes
  const beforeUnload = useCallback((e: BeforeUnloadEvent) => {
    if (hasChanges) { e.preventDefault(); }
  }, [hasChanges]);

  useEffect(() => {
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [beforeUnload]);

  async function fetchPrompts() {
    try {
      const res = await fetch('/api/prompts');
      const data = await res.json();
      if (data.success) {
        setPrompts(data.data);
        setOriginal(data.data);
      } else toast('Erreur chargement', 'error');
    } catch {
      toast('Erreur de connexion', 'error');
    } finally {
      setLoading(false);
    }
  }

  function updatePrompt(key: keyof Prompts, value: string) {
    if (!prompts) return;
    const updated = { ...prompts, [key]: value };
    setPrompts(updated);
    setHasChanges(JSON.stringify(updated) !== JSON.stringify(original));
  }

  async function handleSave() {
    if (!prompts) return;
    setSaving(true);
    try {
      const res = await fetch('/api/prompts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prompts),
      });
      const data = await res.json();
      if (data.success) {
        setPrompts(data.data);
        setOriginal(data.data);
        setHasChanges(false);
        toast('Prompts sauvegardés sur GitHub !', 'success');
      } else {
        toast(`Erreur: ${data.error}`, 'error');
      }
    } catch {
      toast('Erreur de sauvegarde', 'error');
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    if (original) {
      setPrompts({ ...original });
      setHasChanges(false);
      toast('Modifications annulées', 'info');
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div><h1 className="text-2xl font-bold">Prompts</h1></div>
        {[1, 2, 3].map(i => <div key={i} className="card animate-shimmer h-40 rounded-xl" />)}
      </div>
    );
  }

  if (!prompts) return (
    <div className="card text-center py-12">
      <p className="text-red-400">Erreur de chargement</p>
      <button onClick={fetchPrompts} className="btn btn-primary btn-sm mt-3">Réessayer</button>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header with save button */}
      <div className="flex items-center justify-between sticky top-0 bg-[var(--background)] py-3 z-10">
        <div>
          <h1 className="text-2xl font-bold">Prompts</h1>
          <p className="text-[var(--muted)] text-sm mt-1">
            Configure les instructions de chaque agent IA
          </p>
        </div>
        <div className="flex gap-2">
          {hasChanges && (
            <button onClick={handleReset} className="btn btn-ghost btn-sm animate-fadeIn">
              ↺ Annuler
            </button>
          )}
          <button onClick={handleSave} disabled={saving || !hasChanges}
            className={`btn btn-sm ${hasChanges ? 'btn-primary' : 'btn-ghost opacity-50'}`}>
            {saving ? <><span className="spinner" /> Sauvegarde...</> : '💾 Sauvegarder'}
          </button>
        </div>
      </div>

      {/* Unsaved changes banner */}
      {hasChanges && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-4 py-2 text-xs text-yellow-400 flex items-center gap-2 animate-fadeIn">
          <span>⚠️</span> Modifications non sauvegardées
        </div>
      )}

      {/* Global Prompt */}
      <PromptCard
        icon="🌐"
        title="Prompt Global"
        description="Appliqué à TOUS les agents. Définissez ici le ton, le contexte général, votre style d'écriture."
        placeholder="Ex: Tu écris pour un profil LinkedIn tech B2B. Ton : pro mais décontracté. Cible : décideurs IT en France."
        value={prompts.globalPrompt}
        onChange={v => updatePrompt('globalPrompt', v)}
        minHeight="100px"
        highlighted
      />

      {/* Research Agent */}
      <PromptCard
        icon="🔍"
        title="Agent Recherche"
        description="Cet agent recherche sur internet les dernières actualités liées au sujet. Il utilise Google Search en temps réel."
        value={prompts.research}
        onChange={v => updatePrompt('research', v)}
        minHeight="180px"
      />

      {/* Writer Agent */}
      <PromptCard
        icon="✍️"
        title="Agent Rédacteur"
        description="Cet agent transforme la recherche en post LinkedIn engageant. Le résultat dépend beaucoup de ce prompt."
        value={prompts.writer}
        onChange={v => updatePrompt('writer', v)}
        minHeight="180px"
      />

      {/* Tips */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 text-sm text-blue-300">
        <p className="font-medium mb-2">💡 Conseils pour de meilleurs prompts</p>
        <ul className="text-xs space-y-1 text-blue-300/80 list-disc pl-4">
          <li>Soyez spécifique sur le ton voulu (formel, conversationnel, provocant...)</li>
          <li>Précisez la longueur idéale du post (800-1500 caractères recommandé)</li>
          <li>Indiquez votre audience cible (développeurs, managers, RH...)</li>
          <li>Ajoutez des exemples de posts que vous aimez dans le prompt global</li>
          <li>Testez différentes variantes et comparez les résultats</li>
        </ul>
      </div>
    </div>
  );
}

function PromptCard({ icon, title, description, value, onChange, placeholder, minHeight = '150px', highlighted }: {
  icon: string;
  title: string;
  description: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  minHeight?: string;
  highlighted?: boolean;
}) {
  return (
    <div className={`card space-y-3 ${highlighted ? 'border-[var(--accent)]/30 bg-[var(--accent)]/5' : ''}`}>
      <div>
        <h2 className="font-semibold flex items-center gap-2">
          <span className="w-8 h-8 rounded-lg bg-[var(--background)] flex items-center justify-center">{icon}</span>
          {title}
        </h2>
        <p className="text-xs text-[var(--muted)] mt-1 ml-10">{description}</p>
      </div>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="input font-mono text-sm leading-relaxed"
        style={{ minHeight }}
      />
      <p className="text-xs text-[var(--muted)] text-right">{value.length} caractères</p>
    </div>
  );
}
