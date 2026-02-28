"use client";
import { useEffect, useState } from "react";

interface Settings {
  autoPublish: boolean;
  pendingBuffer: number;
  globalModel: string;
  linkedinProfile: {
    name: string;
    urn: string;
  };
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [linkedinOk, setLinkedinOk] = useState<boolean | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const data = await fetch("/api/settings").then((r) => r.json());
      setSettings(data);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    if (!settings) return;
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (res.ok) setMessage("Paramètres sauvegardés !");
      else setMessage("Erreur lors de la sauvegarde");
    } catch {
      setMessage("Erreur réseau");
    } finally {
      setSaving(false);
    }
  }

  async function testLinkedIn() {
    setLinkedinOk(null);
    try {
      const res = await fetch("/api/test-gemini");
      setLinkedinOk(res.ok);
    } catch {
      setLinkedinOk(false);
    }
  }

  async function triggerCron() {
    setMessage("Lancement du cron...");
    try {
      const res = await fetch("/api/cron");
      const data = await res.json();
      setMessage(`Cron terminé: ${data.generated || 0} généré(s), ${data.published || 0} publié(s)`);
    } catch (e) {
      setMessage("Erreur: " + e);
    }
  }

  if (loading || !settings)
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "4rem" }}>
        <div className="loader" />
      </div>
    );

  return (
    <div style={{ maxWidth: 700, margin: "0 auto" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "2rem" }}>⚙️ Paramètres</h1>

      {message && (
        <div className="card" style={{ marginBottom: "1rem", borderColor: message.includes("Erreur") ? "var(--danger)" : "var(--success)" }}>
          {message}
        </div>
      )}

      {/* Auto-publish */}
      <div className="card" style={{ marginBottom: "1rem" }}>
        <h2 style={{ fontWeight: 600, marginBottom: "0.75rem" }}>Publication automatique</h2>
        <label style={{ display: "flex", alignItems: "center", gap: "0.75rem", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={settings.autoPublish}
            onChange={(e) => setSettings({ ...settings, autoPublish: e.target.checked })}
            style={{ width: 20, height: 20 }}
          />
          <div>
            <p style={{ fontWeight: 500 }}>Auto-publication</p>
            <p style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
              {settings.autoPublish
                ? "Les posts sont publiés automatiquement chaque jour sans intervention"
                : "Les posts sont générés et mis en attente — vous validez avant publication"}
            </p>
          </div>
        </label>
      </div>

      {/* Buffer */}
      <div className="card" style={{ marginBottom: "1rem" }}>
        <h2 style={{ fontWeight: 600, marginBottom: "0.75rem" }}>Buffer de posts</h2>
        <p style={{ fontSize: "0.8125rem", color: "var(--muted)", marginBottom: "0.5rem" }}>
          Nombre de posts en attente à toujours maintenir. Le cron génère automatiquement de nouveaux posts si le buffer est insuffisant.
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <input
            type="number"
            min={1}
            max={20}
            value={settings.pendingBuffer}
            onChange={(e) => setSettings({ ...settings, pendingBuffer: parseInt(e.target.value) || 5 })}
            style={{ width: 80 }}
          />
          <span style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>posts en réserve</span>
        </div>
      </div>

      {/* Model */}
      <div className="card" style={{ marginBottom: "1rem" }}>
        <h2 style={{ fontWeight: 600, marginBottom: "0.75rem" }}>Modèle IA</h2>
        <select
          value={settings.globalModel}
          onChange={(e) => setSettings({ ...settings, globalModel: e.target.value })}
        >
          <option value="gemini-2.0-flash">Gemini 2.0 Flash (rapide, fiable)</option>
          <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
          <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
        </select>
      </div>

      {/* LinkedIn */}
      <div className="card" style={{ marginBottom: "1rem" }}>
        <h2 style={{ fontWeight: 600, marginBottom: "0.75rem" }}>LinkedIn</h2>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          <p style={{ fontSize: "0.875rem" }}>
            Profil : <strong>{settings.linkedinProfile.name}</strong>
          </p>
          <button className="btn btn-outline" onClick={testLinkedIn} style={{ fontSize: "0.75rem" }}>
            Tester la connexion
          </button>
          {linkedinOk !== null && (
            <span style={{ color: linkedinOk ? "var(--success)" : "var(--danger)", fontSize: "0.8125rem" }}>
              {linkedinOk ? "✅ Connecté" : "❌ Non connecté"}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        <button className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? "⏳ Sauvegarde..." : "💾 Sauvegarder"}
        </button>
        <button className="btn btn-outline" onClick={triggerCron}>
          🔄 Lancer le cron manuellement
        </button>
      </div>
    </div>
  );
}
