"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

interface Post { status: string; publishedAt: string | null; }
interface Agent { enabled: boolean; }
interface Workflow { startedAt: string; status: string; }
interface Settings { postsPerWeek: number; }

export default function Dashboard() {
  const [stats, setStats] = useState({ published: 0, pending: 0, total: 0, agents: 0, thisWeek: 0, maxWeek: 3, lastRun: "" });
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const [posts, agents, workflows, settings] = await Promise.all([
        fetch("/api/posts").then(r => r.json()).catch(() => []),
        fetch("/api/agents").then(r => r.json()).catch(() => []),
        fetch("/api/workflow").then(r => r.json()).catch(() => []),
        fetch("/api/settings").then(r => r.json()).catch(() => ({})),
      ]);
      const p = Array.isArray(posts) ? posts : [];
      const a = Array.isArray(agents) ? agents : [];
      const w = Array.isArray(workflows) ? workflows : [];
      const now = new Date();
      const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay()); weekStart.setHours(0,0,0,0);
      setStats({
        published: p.filter((x: Post) => x.status === "published").length,
        pending: p.filter((x: Post) => x.status === "pending_approval").length,
        total: p.length,
        agents: a.filter((x: Agent) => x.enabled).length,
        thisWeek: p.filter((x: Post) => x.status === "published" && x.publishedAt && new Date(x.publishedAt) >= weekStart).length,
        maxWeek: (settings as Settings).postsPerWeek || 3,
        lastRun: w.length > 0 ? (w as Workflow[])[0].startedAt : "",
      });
    } catch { /* ignore */ } finally { setLoading(false); }
  }

  async function triggerWorkflow() {
    setGenerating(true); setMessage("");
    try {
      const res = await fetch("/api/workflow", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const result = await res.json();
      if (result.status === "completed") setMessage("✅ Post généré avec succès !");
      else if (result.status === "failed") setMessage("❌ Erreur: " + result.error);
      else setMessage("⏳ Workflow en cours...");
      loadData();
    } catch (e) { setMessage("❌ " + e); } finally { setGenerating(false); }
  }

  if (loading) return <div style={{ display: "flex", justifyContent: "center", padding: "4rem" }}><div className="loader" /></div>;

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>📊 Dashboard</h1>
          <p style={{ color: "var(--muted)", fontSize: "0.875rem", marginTop: 4 }}>Vue d&apos;ensemble LinkedIn AutoPilot</p>
        </div>
        <button className="btn btn-primary" onClick={triggerWorkflow} disabled={generating}>
          {generating ? <><div className="loader" style={{ width: 16, height: 16, borderWidth: 2 }} /> Génération...</> : "⚡ Générer un post"}
        </button>
      </div>

      {message && <div className="card" style={{ marginBottom: "1.5rem", borderColor: message.includes("✅") ? "var(--success)" : "var(--danger)" }}>{message}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem", marginBottom: "2rem" }}>
        <StatCard label="Cette semaine" value={`${stats.thisWeek}/${stats.maxWeek}`} sub="posts publiés" />
        <StatCard label="En attente" value={stats.pending} sub="à approuver" color="var(--warning)" />
        <StatCard label="Total publié" value={stats.published} sub="publications" color="var(--success)" />
        <StatCard label="Agents actifs" value={stats.agents} sub="agents IA" color="var(--primary)" />
      </div>

      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ fontWeight: 600, marginBottom: "1rem" }}>Actions rapides</h2>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <Link href="/posts" className="btn btn-outline">📝 Publications</Link>
          <Link href="/agents" className="btn btn-outline">🤖 Agents</Link>
          <Link href="/workflow" className="btn btn-outline">⚡ Workflows</Link>
          <Link href="/settings" className="btn btn-outline">⚙️ Paramètres</Link>
        </div>
      </div>

      {stats.lastRun && (
        <div className="card">
          <h2 style={{ fontWeight: 600, marginBottom: "0.5rem" }}>Dernier workflow</h2>
          <p style={{ color: "var(--muted)", fontSize: "0.875rem" }}>Exécuté le {new Date(stats.lastRun).toLocaleString("fr-FR")}</p>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub: string; color?: string }) {
  return (
    <div className="card">
      <div style={{ color: "var(--muted)", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: 1 }}>{label}</div>
      <div style={{ fontSize: "2rem", fontWeight: 700, marginTop: 4, color: color || "var(--foreground)" }}>{value}</div>
      <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>{sub}</div>
    </div>
  );
}
