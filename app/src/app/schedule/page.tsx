'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/components/Toast';

import type { Schedule } from '@/lib/types';

const DAY_LABELS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const DAY_FULL = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

export default function SchedulePage() {
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [original, setOriginal] = useState<Schedule | null>(null);
  const { toast } = useToast();

  useEffect(() => { fetchSchedule(); }, []);

  // Warn on leave with unsaved changes
  const beforeUnload = useCallback((e: BeforeUnloadEvent) => {
    if (hasChanges) { e.preventDefault(); }
  }, [hasChanges]);

  useEffect(() => {
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [beforeUnload]);

  async function fetchSchedule() {
    try {
      const res = await fetch('/api/schedule');
      const data = await res.json();
      if (data.success) {
        setSchedule(data.data);
        setOriginal(data.data);
      } else toast('Erreur chargement', 'error');
    } catch {
      toast('Erreur de connexion', 'error');
    } finally {
      setLoading(false);
    }
  }

  function update(patch: Partial<Schedule>) {
    if (!schedule) return;
    const updated = { ...schedule, ...patch };
    setSchedule(updated);
    setHasChanges(JSON.stringify(updated) !== JSON.stringify(original));
  }

  function toggleDay(day: number) {
    if (!schedule) return;
    const days = schedule.days.includes(day)
      ? schedule.days.filter(d => d !== day)
      : [...schedule.days, day].sort();
    update({ days });
  }

  async function handleSave() {
    if (!schedule) return;
    setSaving(true);
    try {
      const res = await fetch('/api/schedule', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(schedule),
      });
      const data = await res.json();
      if (data.success) {
        setSchedule(data.data);
        setOriginal(data.data);
        setHasChanges(false);
        toast('Planning sauvegardé !', 'success');
      } else {
        toast(`Erreur: ${data.error}`, 'error');
      }
    } catch {
      toast('Erreur de sauvegarde', 'error');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div><h1 className="text-2xl font-bold">Planning</h1></div>
        {[1, 2, 3].map(i => <div key={i} className="card animate-shimmer h-28 rounded-xl" />)}
      </div>
    );
  }

  if (!schedule) return (
    <div className="card text-center py-12">
      <p className="text-red-400">Erreur de chargement</p>
      <button onClick={fetchSchedule} className="btn btn-primary btn-sm mt-3">Réessayer</button>
    </div>
  );

  // Build human-readable summary
  const activeDays = schedule.days.map(d => DAY_FULL[d]).join(', ');
  const summary = schedule.enabled
    ? `Publication automatique ${activeDays || 'aucun jour'} à ${schedule.time} UTC`
    : 'Publication automatique désactivée';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between sticky top-0 bg-[var(--background)] py-3 z-10">
        <div>
          <h1 className="text-2xl font-bold">Planning</h1>
          <p className="text-[var(--muted)] text-sm mt-1">{summary}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleSave} disabled={saving || !hasChanges}
            className={`btn btn-sm ${hasChanges ? 'btn-primary' : 'btn-ghost opacity-50'}`}>
            {saving ? <><span className="spinner" /> Sauvegarde...</> : '💾 Sauvegarder'}
          </button>
        </div>
      </div>

      {hasChanges && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-4 py-2 text-xs text-yellow-400 flex items-center gap-2 animate-fadeIn">
          <span>⚠️</span> Modifications non sauvegardées
        </div>
      )}

      {/* Enable/Disable - BIG toggle */}
      <div className="card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className={`text-3xl ${schedule.enabled ? '' : 'opacity-40'}`}>🤖</span>
            <div>
              <h2 className="font-semibold text-lg">Publication automatique</h2>
              <p className="text-xs text-[var(--muted)] mt-0.5">
                Publie automatiquement vos posts en attente selon le planning configuré
              </p>
            </div>
          </div>
          <button onClick={() => update({ enabled: !schedule.enabled })}
            className={`toggle ${schedule.enabled ? 'toggle-on' : 'toggle-off'}`}>
            <span className={`toggle-dot ${schedule.enabled ? 'toggle-dot-on' : 'toggle-dot-off'}`} />
          </button>
        </div>
      </div>

      {/* Days */}
      <div className={`card space-y-4 transition-opacity ${schedule.enabled ? '' : 'opacity-40 pointer-events-none'}`}>
        <h2 className="font-semibold">📅 Jours de publication</h2>
        <div className="grid grid-cols-7 gap-2">
          {DAY_LABELS.map((label, i) => (
            <button key={i} onClick={() => toggleDay(i)}
              className={`h-12 rounded-lg text-sm font-medium transition-all ${
                schedule.days.includes(i)
                  ? 'bg-[var(--accent)] text-white shadow-lg shadow-[var(--accent)]/20'
                  : 'bg-[var(--background)] text-[var(--muted)] border border-[var(--border)] hover:border-[var(--accent)]'
              }`}>
              {label}
            </button>
          ))}
        </div>
        <p className="text-xs text-[var(--muted)]">
          {schedule.days.length === 0 ? 'Aucun jour sélectionné' : `${schedule.days.length} jour${schedule.days.length > 1 ? 's' : ''} par semaine`}
        </p>
      </div>

      {/* Time */}
      <div className={`card space-y-3 transition-opacity ${schedule.enabled ? '' : 'opacity-40 pointer-events-none'}`}>
        <h2 className="font-semibold">⏰ Heure de publication</h2>
        <div className="flex items-center gap-4">
          <input type="time" value={schedule.time}
            onChange={e => update({ time: e.target.value })}
            className="input w-auto text-lg font-mono" />
          <span className="text-xs text-[var(--muted)] bg-[var(--background)] px-3 py-1.5 rounded-lg border border-[var(--border)]">
            UTC ({schedule.time} UTC = {getLocalTime(schedule.time)} heure locale)
          </span>
        </div>
      </div>

      {/* Auto-generate buffer */}
      <div className={`card space-y-4 transition-opacity ${schedule.enabled ? '' : 'opacity-40 pointer-events-none'}`}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold">🔄 Auto-génération de buffer</h2>
            <p className="text-xs text-[var(--muted)] mt-1">
              Quand le nombre de posts en attente est trop bas, génère automatiquement de nouveaux posts
            </p>
          </div>
          <button onClick={() => update({ autoGenerate: !schedule.autoGenerate })}
            className={`toggle ${schedule.autoGenerate ? 'toggle-on' : 'toggle-off'}`}>
            <span className={`toggle-dot ${schedule.autoGenerate ? 'toggle-dot-on' : 'toggle-dot-off'}`} />
          </button>
        </div>

        {schedule.autoGenerate && (
          <div className="space-y-4 pt-3 border-t border-[var(--border)] animate-fadeIn">
            <div>
              <label className="text-xs font-medium text-[var(--muted)] block mb-2">Buffer minimum de posts en attente</label>
              <div className="flex items-center gap-3">
                <button onClick={() => update({ minBuffer: Math.max(1, schedule.minBuffer - 1) })}
                  className="btn btn-ghost btn-sm w-10 h-10 !p-0">−</button>
                <span className="text-2xl font-bold w-8 text-center">{schedule.minBuffer}</span>
                <button onClick={() => update({ minBuffer: Math.min(20, schedule.minBuffer + 1) })}
                  className="btn btn-ghost btn-sm w-10 h-10 !p-0">+</button>
                <span className="text-xs text-[var(--muted)]">posts</span>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-[var(--muted)] block mb-2">Sujet par défaut pour la génération automatique</label>
              <input type="text" value={schedule.defaultTopic}
                onChange={e => update({ defaultTopic: e.target.value })}
                className="input" placeholder="Ex: intelligence artificielle et innovation tech" />
            </div>
          </div>
        )}
      </div>

      {/* How it works */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-5 text-sm text-blue-300">
        <p className="font-medium mb-3">ℹ️ Comment ça marche</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-blue-300/80">
          <div className="flex gap-2"><span>1️⃣</span><span>Le cron Vercel appelle <code className="bg-blue-500/20 px-1 rounded">/api/cron</code> toutes les heures</span></div>
          <div className="flex gap-2"><span>2️⃣</span><span>Les posts programmés dont l&apos;heure est passée sont publiés</span></div>
          <div className="flex gap-2"><span>3️⃣</span><span>Si c&apos;est un jour de publication → le plus ancien post en attente est publié</span></div>
          <div className="flex gap-2"><span>4️⃣</span><span>Si le buffer est activé et trop bas → nouveaux posts générés</span></div>
        </div>
      </div>
    </div>
  );
}

function getLocalTime(utcTime: string): string {
  try {
    const [h, m] = utcTime.split(':').map(Number);
    const offsetMinutes = -new Date().getTimezoneOffset();
    const totalMinutes = h * 60 + m + offsetMinutes;
    const localH = ((totalMinutes / 60 | 0) % 24 + 24) % 24;
    const localM = ((totalMinutes % 60) + 60) % 60;
    return `${String(localH).padStart(2, '0')}:${String(localM).padStart(2, '0')}`;
  } catch {
    return utcTime;
  }
}
