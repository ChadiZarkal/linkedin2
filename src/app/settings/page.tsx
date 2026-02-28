"use client";
import { useEffect, useState } from "react";

interface Model { id: string; name: string; description: string; }
interface Settings {
  postsPerWeek: number;
  autoPublish: boolean;
  autoApproveTopics: boolean;
  defaultTone: string;
  globalModel: string;
  globalPrompt: string;
  topicPreferences: { recency: string; categories: string[]; customInstructions: string; };
  publishSchedule: { days: number[]; timeSlots: string[]; timezone: string; };
  linkedinProfile: { name: string; urn: string; email: string; };
}

const DAYS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
const CATEGORIES = ["tech", "ai", "innovation", "management", "career", "data", "startup", "leadership"];
const TIMEZONES = ["Europe/Paris", "Europe/London", "America/New_York", "America/Los_Angeles", "Asia/Tokyo", "UTC"];

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [geminiStatus, setGeminiStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [linkedinStatus, setLinkedinStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [newTimeSlot, setNewTimeSlot] = useState("09:00");

  useEffect(() => {
    Promise.all([
      fetch("/api/settings").then(r => r.json()),
      fetch("/api/models").then(r => r.json()),
    ]).then(([s, m]) => { setSettings(s); setModels(m); setLoading(false); });
  }, []);

  async function saveSettings() {
    if (!settings) return;
    setSaving(true);
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    setMessage("Paramètres sauvegardés !");
    setSaving(false);
    setTimeout(() => setMessage(""), 3000);
  }

  async function testGemini() {
    setGeminiStatus("testing");
    try {
      const res = await fetch("/api/test-gemini");
      const data = await res.json();
      setGeminiStatus(data.success ? "success" : "error");
    } catch { setGeminiStatus("error"); }
  }

  async function testLinkedIn() {
    setLinkedinStatus("testing");
    try {
      const res = await fetch("/api/posts");
      setLinkedinStatus(res.ok ? "success" : "error");
    } catch { setLinkedinStatus("error"); }
  }

  function toggleDay(day: number) {
    if (!settings) return;
    const days = settings.publishSchedule.days.includes(day)
      ? settings.publishSchedule.days.filter(d => d !== day)
      : [...settings.publishSchedule.days, day].sort();
    setSettings({ ...settings, publishSchedule: { ...settings.publishSchedule, days } });
  }

  function toggleCategory(cat: string) {
    if (!settings) return;
    const cats = settings.topicPreferences.categories.includes(cat)
      ? settings.topicPreferences.categories.filter(c => c !== cat)
      : [...settings.topicPreferences.categories, cat];
    setSettings({ ...settings, topicPreferences: { ...settings.topicPreferences, categories: cats } });
  }

  function addTimeSlot() {
    if (!settings) return;
    if (settings.publishSchedule.timeSlots.includes(newTimeSlot)) return;
    const slots = [...settings.publishSchedule.timeSlots, newTimeSlot].sort();
    setSettings({ ...settings, publishSchedule: { ...settings.publishSchedule, timeSlots: slots } });
  }

  function removeTimeSlot(slot: string) {
    if (!settings) return;
    const slots = settings.publishSchedule.timeSlots.filter(s => s !== slot);
    setSettings({ ...settings, publishSchedule: { ...settings.publishSchedule, timeSlots: slots } });
  }

  if (loading || !settings) return <div style={{ display: "flex", justifyContent: "center", padding: "4rem" }}><div className="loader" /></div>;

  return (
    <div style={{ maxWidth: 700, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>⚙️ Paramètres</h1>
        <button className="btn btn-primary" onClick={saveSettings} disabled={saving}>
          {saving ? "Sauvegarde..." : "💾 Sauvegarder"}
        </button>
      </div>
      {message && <div className="card" style={{ marginBottom: "1rem", borderColor: "var(--success)" }}>✅ {message}</div>}

      {/* ─── Global Model ─── */}
      <div className="card" style={{ marginBottom: "1rem" }}>
        <h2 style={{ fontWeight: 600, marginBottom: "1rem" }}>🧠 Modèle LLM par défaut</h2>
        <select value={settings.globalModel || "gemini-2.5-pro"} onChange={e => setSettings({ ...settings, globalModel: e.target.value })}>
          {models.map(m => (
            <option key={m.id} value={m.id}>{m.name} — {m.description}</option>
          ))}
        </select>
        <p style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: 8 }}>
          Ce modèle sera utilisé par défaut dans le workflow. Chaque agent peut aussi avoir son propre modèle.
        </p>
      </div>

      {/* ─── Global Prompt ─── */}
      <div className="card" style={{ marginBottom: "1rem", borderColor: "rgba(59,130,246,0.2)" }}>
        <h2 style={{ fontWeight: 600, marginBottom: "0.5rem" }}>📝 Prompt Global</h2>
        <p style={{ fontSize: "0.8125rem", color: "var(--muted)", marginBottom: "0.75rem", lineHeight: 1.5 }}>
          Ce prompt est <strong>injecté automatiquement</strong> dans tous les agents (recherche, analyse, synthèse, rédaction).
          Utilisez-le pour donner du contexte sur vous, votre entreprise, votre audience, ou des instructions générales.
        </p>
        <textarea
          value={settings.globalPrompt || ""}
          onChange={e => setSettings({ ...settings, globalPrompt: e.target.value })}
          placeholder={"Ex:\n- Je suis CTO d'une startup IA de 50 personnes\n- Mon audience LinkedIn : tech leaders, recruteurs, développeurs\n- Toujours mentionner des exemples concrets\n- Ne jamais utiliser de jargon marketing creux\n- Privilégier un ton direct et authentique"}
          style={{ minHeight: 140, fontSize: "0.875rem", lineHeight: 1.6 }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
          <span style={{ fontSize: "0.6875rem", color: "var(--muted)" }}>
            {(settings.globalPrompt || "").length} caractères
          </span>
          <span style={{ fontSize: "0.6875rem", color: "var(--muted)" }}>
            💡 Chaque agent recevra : son propre rôle + votre prompt global
          </span>
        </div>
      </div>

      {/* ─── Publication Schedule ─── */}
      <div className="card" style={{ marginBottom: "1rem" }}>
        <h2 style={{ fontWeight: 600, marginBottom: "1rem" }}>📅 Planning de publication</h2>

        <div style={{ marginBottom: "1rem" }}>
          <label style={{ fontSize: "0.8125rem", color: "var(--muted)", display: "block", marginBottom: 8 }}>Posts par semaine (max)</label>
          <input type="number" min={1} max={7} value={settings.postsPerWeek} onChange={e => setSettings({ ...settings, postsPerWeek: parseInt(e.target.value) || 3 })} style={{ width: 100 }} />
        </div>

        <div style={{ marginBottom: "1rem" }}>
          <label style={{ fontSize: "0.8125rem", color: "var(--muted)", display: "block", marginBottom: 8 }}>Jours de publication</label>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {DAYS.map((day, i) => (
              <button key={i} className={`btn ${settings.publishSchedule.days.includes(i) ? "btn-primary" : "btn-outline"}`} onClick={() => toggleDay(i)}>
                {day}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: "1rem" }}>
          <label style={{ fontSize: "0.8125rem", color: "var(--muted)", display: "block", marginBottom: 8 }}>⏰ Horaires de publication</label>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: 8 }}>
            {(settings.publishSchedule.timeSlots || []).map(slot => (
              <span key={slot} className="badge badge-info" style={{ display: "flex", alignItems: "center", gap: 4, padding: "0.375rem 0.75rem" }}>
                🕐 {slot}
                <button onClick={() => removeTimeSlot(slot)} style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", padding: 0, marginLeft: 4, fontSize: "0.875rem" }}>✕</button>
              </span>
            ))}
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <input type="time" value={newTimeSlot} onChange={e => setNewTimeSlot(e.target.value)} style={{ width: 140 }} />
            <button className="btn btn-outline" onClick={addTimeSlot}>+ Ajouter</button>
          </div>
        </div>

        <div style={{ marginBottom: "1rem" }}>
          <label style={{ fontSize: "0.8125rem", color: "var(--muted)", display: "block", marginBottom: 8 }}>🌍 Fuseau horaire</label>
          <select value={settings.publishSchedule.timezone || "Europe/Paris"} onChange={e => setSettings({ ...settings, publishSchedule: { ...settings.publishSchedule, timezone: e.target.value } })}>
            {TIMEZONES.map(tz => (<option key={tz} value={tz}>{tz}</option>))}
          </select>
        </div>

        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
            <input type="checkbox" checked={settings.autoPublish} onChange={e => setSettings({ ...settings, autoPublish: e.target.checked })} />
            <span style={{ fontSize: "0.875rem" }}>Publication automatique</span>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
            <input type="checkbox" checked={settings.autoApproveTopics} onChange={e => setSettings({ ...settings, autoApproveTopics: e.target.checked })} />
            <span style={{ fontSize: "0.875rem" }}>Approbation auto des sujets</span>
          </label>
        </div>
      </div>

      {/* ─── Tone & Content ─── */}
      <div className="card" style={{ marginBottom: "1rem" }}>
        <h2 style={{ fontWeight: 600, marginBottom: "1rem" }}>✍️ Ton & Contenu</h2>
        <div style={{ marginBottom: "1rem" }}>
          <label style={{ fontSize: "0.8125rem", color: "var(--muted)", display: "block", marginBottom: 8 }}>Ton par défaut</label>
          <input value={settings.defaultTone} onChange={e => setSettings({ ...settings, defaultTone: e.target.value })} placeholder="ex: professionnel mais accessible, inspirant..." />
        </div>
        <div style={{ marginBottom: "1rem" }}>
          <label style={{ fontSize: "0.8125rem", color: "var(--muted)", display: "block", marginBottom: 8 }}>Préférence de récence</label>
          <select value={settings.topicPreferences.recency} onChange={e => setSettings({ ...settings, topicPreferences: { ...settings.topicPreferences, recency: e.target.value } })}>
            <option value="recent">Sujets récents</option>
            <option value="mixed">Mixte</option>
            <option value="evergreen">Intemporels</option>
          </select>
        </div>
        <div style={{ marginBottom: "1rem" }}>
          <label style={{ fontSize: "0.8125rem", color: "var(--muted)", display: "block", marginBottom: 8 }}>Catégories</label>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {CATEGORIES.map(cat => (
              <button key={cat} className={`btn ${settings.topicPreferences.categories.includes(cat) ? "btn-primary" : "btn-outline"}`} onClick={() => toggleCategory(cat)} style={{ textTransform: "capitalize" }}>
                {cat}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label style={{ fontSize: "0.8125rem", color: "var(--muted)", display: "block", marginBottom: 8 }}>Instructions personnalisées</label>
          <textarea value={settings.topicPreferences.customInstructions} onChange={e => setSettings({ ...settings, topicPreferences: { ...settings.topicPreferences, customInstructions: e.target.value } })} placeholder="Instructions supplémentaires..." />
        </div>
      </div>

      {/* ─── LinkedIn Profile ─── */}
      <div className="card" style={{ marginBottom: "1rem" }}>
        <h2 style={{ fontWeight: 600, marginBottom: "1rem" }}>🔗 Profil LinkedIn</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
          <div>
            <label style={{ fontSize: "0.75rem", color: "var(--muted)", display: "block", marginBottom: 4 }}>Nom</label>
            <input value={settings.linkedinProfile.name} onChange={e => setSettings({ ...settings, linkedinProfile: { ...settings.linkedinProfile, name: e.target.value } })} />
          </div>
          <div>
            <label style={{ fontSize: "0.75rem", color: "var(--muted)", display: "block", marginBottom: 4 }}>Email</label>
            <input value={settings.linkedinProfile.email} onChange={e => setSettings({ ...settings, linkedinProfile: { ...settings.linkedinProfile, email: e.target.value } })} />
          </div>
          <div style={{ gridColumn: "span 2" }}>
            <label style={{ fontSize: "0.75rem", color: "var(--muted)", display: "block", marginBottom: 4 }}>URN</label>
            <input value={settings.linkedinProfile.urn} readOnly style={{ opacity: 0.6 }} />
          </div>
        </div>
      </div>

      {/* ─── Vercel Cron Info ─── */}
      <div className="card" style={{ marginBottom: "1rem" }}>
        <h2 style={{ fontWeight: 600, marginBottom: "1rem" }}>🔄 Publication automatique (Vercel Cron)</h2>
        <p style={{ fontSize: "0.8125rem", color: "var(--muted)", lineHeight: 1.6, marginBottom: "0.75rem" }}>
          Une fois déployé sur Vercel, un <strong>cron job</strong> se déclenche automatiquement selon le planning configuré dans <code>vercel.json</code>. 
          <strong> L'application fonctionne même quand votre PC est éteint.</strong>
        </p>
        <p style={{ fontSize: "0.8125rem", color: "var(--muted)", lineHeight: 1.6 }}>
          Le cron vérifie le jour, l'horaire et le quota hebdomadaire avant de publier. 
          Pour modifier l'heure du cron, éditez le fichier <code>vercel.json</code> → <code>"schedule": "0 8 * * 1-5"</code> (format crontab UTC).
        </p>
        <p style={{ fontSize: "0.75rem", color: "var(--warning)", marginTop: 8 }}>
          ⚠️ Vercel Hobby = 1 cron/jour max. Vercel Pro = jusqu'à 1/minute.
        </p>
      </div>

      {/* ─── Connection Tests ─── */}
      <div className="card">
        <h2 style={{ fontWeight: 600, marginBottom: "1rem" }}>🔌 Tests de connexion</h2>
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
          <button className="btn btn-outline" onClick={testGemini}>
            {geminiStatus === "testing" ? "⏳" : geminiStatus === "success" ? "✅" : geminiStatus === "error" ? "❌" : "🧪"} Test Gemini AI
          </button>
          <button className="btn btn-outline" onClick={testLinkedIn}>
            {linkedinStatus === "testing" ? "⏳" : linkedinStatus === "success" ? "✅" : linkedinStatus === "error" ? "❌" : "🧪"} Test LinkedIn
          </button>
        </div>
      </div>
    </div>
  );
}
