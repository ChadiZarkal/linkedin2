"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

interface Post {
  id: string;
  topic: string;
  content: string;
  status: string;
  publishedAt: string | null;
  createdAt: string;
}

interface Settings {
  autoPublish: boolean;
  pendingBuffer: number;
}

export default function Dashboard() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [postsData, settingsData] = await Promise.all([
        fetch("/api/posts").then((r) => r.json()).catch(() => []),
        fetch("/api/settings").then((r) => r.json()).catch(() => null),
      ]);
      setPosts(Array.isArray(postsData) ? postsData : []);
      setSettings(settingsData);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }

  async function generateNow() {
    setGenerating(true);
    setMessage("");
    try {
      const res = await fetch("/api/posts", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setMessage("Post généré avec succès !");
        loadData();
      } else {
        setMessage("Erreur : " + (data.error || "Erreur inconnue"));
      }
    } catch (e) {
      setMessage("Erreur réseau : " + e);
    } finally {
      setGenerating(false);
    }
  }

  if (loading)
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "4rem" }}>
        <div className="loader" />
      </div>
    );

  const pending = posts.filter((p) => p.status === "pending" || p.status === "approved");
  const published = posts.filter((p) => p.status === "published");
  const today = new Date().toISOString().split("T")[0];
  const publishedToday = published.filter((p) => p.publishedAt?.startsWith(today));

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>📊 Dashboard</h1>
          <p style={{ color: "var(--muted)", fontSize: "0.875rem", marginTop: 4 }}>
            LinkedIn AutoPilot — Tech Wow
          </p>
        </div>
        <button className="btn btn-primary" onClick={generateNow} disabled={generating}>
          {generating ? "⏳ Génération..." : "⚡ Générer un post"}
        </button>
      </div>

      {/* Message */}
      {message && (
        <div className="card" style={{ marginBottom: "1.5rem", borderColor: message.includes("succès") ? "var(--success)" : "var(--danger)" }}>
          {message}
        </div>
      )}

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem", marginBottom: "2rem" }}>
        <StatCard label="En attente" value={pending.length} sub={`sur ${settings?.pendingBuffer || 5} cible`} color="var(--warning)" />
        <StatCard label="Publié aujourd'hui" value={publishedToday.length} sub="post(s)" color="var(--success)" />
        <StatCard label="Total publié" value={published.length} sub="publications" color="var(--primary)" />
        <StatCard label="Mode" value={settings?.autoPublish ? "Auto" : "Manuel"} sub={settings?.autoPublish ? "publie tout seul" : "validation requise"} color="var(--primary)" />
      </div>

      {/* Pending posts to approve */}
      {!settings?.autoPublish && pending.length > 0 && (
        <div style={{ marginBottom: "2rem" }}>
          <h2 style={{ fontWeight: 600, marginBottom: "1rem" }}>⏳ Posts en attente de validation</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {pending.slice(0, 3).map((post) => (
              <PendingCard key={post.id} post={post} onAction={() => loadData()} />
            ))}
            {pending.length > 3 && (
              <Link href="/posts" style={{ color: "var(--primary)", fontSize: "0.875rem", textDecoration: "none" }}>
                Voir les {pending.length - 3} autres posts en attente →
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Recent published */}
      {published.length > 0 && (
        <div>
          <h2 style={{ fontWeight: 600, marginBottom: "1rem" }}>✅ Dernières publications</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {published.slice(0, 5).map((post) => (
              <div key={post.id} className="card" style={{ padding: "0.75rem 1rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <span style={{ fontWeight: 600, fontSize: "0.875rem" }}>{post.topic}</span>
                    <span style={{ color: "var(--muted)", fontSize: "0.75rem", marginLeft: 8 }}>
                      {post.publishedAt ? new Date(post.publishedAt).toLocaleDateString("fr-FR") : ""}
                    </span>
                  </div>
                  <span className="badge badge-success">Publié</span>
                </div>
              </div>
            ))}
          </div>
          <Link href="/posts" style={{ color: "var(--primary)", fontSize: "0.875rem", textDecoration: "none", display: "block", marginTop: "0.5rem" }}>
            Voir tout l'historique →
          </Link>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub: string; color?: string }) {
  return (
    <div className="card">
      <p style={{ fontSize: "0.75rem", color: "var(--muted)", marginBottom: 4 }}>{label}</p>
      <p style={{ fontSize: "1.5rem", fontWeight: 700, color }}>{value}</p>
      <p style={{ fontSize: "0.6875rem", color: "var(--muted)", marginTop: 2 }}>{sub}</p>
    </div>
  );
}

function PendingCard({ post, onAction }: { post: Post; onAction: () => void }) {
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  async function handleAction(action: string) {
    setLoading(true);
    try {
      await fetch("/api/posts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: post.id, action }),
      });
      onAction();
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
        <div>
          <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>{post.topic}</span>
          <span style={{ color: "var(--muted)", fontSize: "0.75rem", marginLeft: 8 }}>
            {new Date(post.createdAt).toLocaleDateString("fr-FR")}
          </span>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button className="btn btn-success" onClick={() => handleAction("publish")} disabled={loading} style={{ fontSize: "0.8125rem" }}>
            Publier
          </button>
          <button className="btn btn-danger" onClick={() => handleAction("reject")} disabled={loading} style={{ fontSize: "0.8125rem" }}>
            Rejeter
          </button>
        </div>
      </div>
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          background: "var(--background)",
          borderRadius: 8,
          padding: "0.75rem",
          fontSize: "0.8125rem",
          lineHeight: 1.6,
          whiteSpace: "pre-wrap",
          maxHeight: expanded ? "none" : 120,
          overflow: "hidden",
          cursor: "pointer",
          position: "relative",
        }}
      >
        {post.content}
        {!expanded && (
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 40, background: "linear-gradient(transparent, var(--card-bg))" }} />
        )}
      </div>
    </div>
  );
}
