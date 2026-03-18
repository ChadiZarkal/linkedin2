'use client';

import { useState, useEffect } from 'react';

interface Schedule {
  enabled: boolean;
  days: number[];
  time: string;
  autoGenerate: boolean;
  minBuffer: number;
  defaultTopic: string;
}

const DAY_LABELS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

export default function SchedulePage() {
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { fetchSchedule(); }, []);

  async function fetchSchedule() {
    try {
      const res = await fetch('/api/schedule');
      const data = await res.json();
      if (data.success) setSchedule(data.data);
    } catch (err) {
      console.error('Fetch schedule error:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!schedule) return;
    setSaving(true);
    setSaved(false);

    try {
      const res = await fetch('/api/schedule', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(schedule),
      });
      const data = await res.json();
      if (data.success) {
        setSchedule(data.data);
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

  function toggleDay(day: number) {
    if (!schedule) return;
    const days = schedule.days.includes(day)
      ? schedule.days.filter(d => d !== day)
      : [...schedule.days, day].sort();
    setSchedule({ ...schedule, days });
  }

  if (loading) {
    return (
      <div className="text-center py-12 text-[var(--muted)]">
        <div className="w-6 h-6 border-2 border-[var(--accent)]/30 border-t-[var(--accent)] rounded-full animate-spin mx-auto mb-3" />
        Chargement...
      </div>
    );
  }

  if (!schedule) return <p className="text-red-400">Erreur de chargement</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Planning</h1>
          <p className="text-[var(--muted)] text-sm mt-1">
            Configuration de la publication automatique. Sauvegardé sur GitHub.
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
          {saving ? 'Sauvegarde...' : saved ? '✅ Sauvegardé !' : '💾 Sauvegarder'}
        </button>
      </div>

      {/* Enable/Disable */}
      <div className="bg-[var(--card)] rounded-xl p-5 border border-[var(--border)]">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Publication automatique</h2>
            <p className="text-xs text-[var(--muted)] mt-1">
              Publie automatiquement le plus ancien post en attente aux jours et heures définis.
            </p>
          </div>
          <button
            onClick={() => setSchedule({ ...schedule, enabled: !schedule.enabled })}
            className={`relative w-12 h-6 rounded-full transition-colors ${
              schedule.enabled ? 'bg-[var(--success)]' : 'bg-[var(--border)]'
            }`}
          >
            <span
              className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                schedule.enabled ? 'translate-x-6' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Days */}
      <div className="bg-[var(--card)] rounded-xl p-5 border border-[var(--border)] space-y-3">
        <h2 className="font-semibold">Jours de publication</h2>
        <div className="flex gap-2">
          {DAY_LABELS.map((label, i) => (
            <button
              key={i}
              onClick={() => toggleDay(i)}
              className={`w-11 h-11 rounded-lg text-xs font-medium transition-colors ${
                schedule.days.includes(i)
                  ? 'bg-[var(--accent)] text-white'
                  : 'bg-[var(--background)] text-[var(--muted)] border border-[var(--border)] hover:border-[var(--accent)]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Time */}
      <div className="bg-[var(--card)] rounded-xl p-5 border border-[var(--border)] space-y-3">
        <h2 className="font-semibold">Heure de publication (UTC)</h2>
        <input
          type="time"
          value={schedule.time}
          onChange={e => setSchedule({ ...schedule, time: e.target.value })}
          className="bg-[var(--background)] border border-[var(--border)] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[var(--accent)]"
        />
      </div>

      {/* Auto-generate */}
      <div className="bg-[var(--card)] rounded-xl p-5 border border-[var(--border)] space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Génération automatique de buffer</h2>
            <p className="text-xs text-[var(--muted)] mt-1">
              Génère automatiquement des posts quand le buffer descend sous le minimum.
            </p>
          </div>
          <button
            onClick={() => setSchedule({ ...schedule, autoGenerate: !schedule.autoGenerate })}
            className={`relative w-12 h-6 rounded-full transition-colors ${
              schedule.autoGenerate ? 'bg-[var(--success)]' : 'bg-[var(--border)]'
            }`}
          >
            <span
              className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                schedule.autoGenerate ? 'translate-x-6' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>

        {schedule.autoGenerate && (
          <div className="space-y-3 pt-2 border-t border-[var(--border)]">
            <div>
              <label className="text-xs font-medium text-[var(--muted)]">Buffer minimum</label>
              <input
                type="number"
                min={1}
                max={20}
                value={schedule.minBuffer}
                onChange={e => setSchedule({ ...schedule, minBuffer: parseInt(e.target.value) || 3 })}
                className="mt-1 w-20 bg-[var(--background)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-[var(--muted)]">Sujet par défaut pour la génération auto</label>
              <input
                type="text"
                value={schedule.defaultTopic}
                onChange={e => setSchedule({ ...schedule, defaultTopic: e.target.value })}
                className="mt-1 w-full bg-[var(--background)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 text-sm text-blue-300">
        <p className="font-medium mb-1">ℹ️ Comment ça marche</p>
        <ul className="text-xs space-y-1 text-blue-300/80">
          <li>• Le cron Vercel appelle <code>/api/cron</code> toutes les heures</li>
          <li>• S&apos;il y a des posts programmés dont l&apos;heure est passée → publiés automatiquement</li>
          <li>• Si c&apos;est un jour de publication et qu&apos;aucun post n&apos;a été publié aujourd&apos;hui → le plus ancien post en attente est publié</li>
          <li>• Si le buffer est activé et trop bas → de nouveaux posts sont générés automatiquement</li>
          <li>• Toute l&apos;activité est sauvegardée sur GitHub</li>
        </ul>
      </div>
    </div>
  );
}
