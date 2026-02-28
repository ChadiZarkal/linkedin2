"use client";
import { useEffect, useState, useCallback } from "react";

interface Post {
  id: string;
  content: string;
  status: string;
  tone: string;
  linkedinPostId: string | null;
  publishedAt: string | null;
  scheduledAt: string | null;
  createdAt: string;
  imageSuggestions?: string[];
  imageUrl?: string | null;
  agentLogs: { agentName: string; output: string }[];
}

export default function PostsPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [revisionTexts, setRevisionTexts] = useState<Record<string, string>>({});
  const [revisingId, setRevisingId] = useState<string | null>(null);
  const [schedulingId, setSchedulingId] = useState<string | null>(null);
  const [scheduleDates, setScheduleDates] = useState<Record<string, string>>({});
  const [scheduleTimes, setScheduleTimes] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<"all" | "pending" | "published" | "rejected">("all");
  const [bufferLoading, setBufferLoading] = useState(false);

  const loadPosts = useCallback(async () => {
    const data = await fetch("/api/posts").then(r => r.json()).catch(() => []);
    setPosts(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);

  useEffect(() => { loadPosts(); }, [loadPosts]);

  async function handleAction(postId: string, action: string) {
    setActionLoading(postId);
    await fetch("/api/posts", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: postId, action }),
    });
    await loadPosts();
    setActionLoading(null);
  }

  async function handleEdit(postId: string, newContent: string) {
    await fetch("/api/posts", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: postId, content: newContent }),
    });
    await loadPosts();
  }

  async function handleDelete(postId: string) {
    if (!confirm("Supprimer ce post ?")) return;
    await fetch(`/api/posts?id=${postId}`, { method: "DELETE" });
    await loadPosts();
  }

  async function handleRevise(postId: string) {
    const feedback = revisionTexts[postId]?.trim();
    if (!feedback) return;
    setRevisingId(postId);
    try {
      const res = await fetch("/api/workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "revise", postId, feedback }),
      });
      const data = await res.json();
      if (res.ok) {
        setRevisionTexts(prev => ({ ...prev, [postId]: "" }));
        await loadPosts();
      } else {
        alert(data.error || "Erreur lors de la révision");
      }
    } catch { alert("Erreur réseau"); }
    finally { setRevisingId(null); }
  }

  async function handleSchedule(postId: string) {
    const date = scheduleDates[postId];
    const time = scheduleTimes[postId] || "09:00";
    if (!date) return;
    setActionLoading(postId);
    try {
      const scheduledAt = new Date(`${date}T${time}:00`).toISOString();
      const res = await fetch("/api/posts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: postId, action: "schedule", scheduledAt }),
      });
      if (res.ok) {
        setSchedulingId(null);
        await loadPosts();
      } else {
        const data = await res.json();
        alert(data.error || "Erreur de programmation");
      }
    } catch { alert("Erreur réseau"); }
    finally { setActionLoading(null); }
  }

  const statusBadge = (status: string) => {
    const map: Record<string, { class: string; label: string }> = {
      published: { class: "badge-success", label: "✅ Publié" },
      pending_approval: { class: "badge-warning", label: "⏳ En attente" },
      approved: { class: "badge-info", label: "👍 Approuvé" },
      draft: { class: "badge-muted", label: "📝 Brouillon" },
      rejected: { class: "badge-danger", label: "❌ Rejeté" },
      failed: { class: "badge-danger", label: "💥 Échoué" },
    };
    const s = map[status] || { class: "badge-muted", label: status };
    return <span className={`badge ${s.class}`}>{s.label}</span>;
  };

  if (loading) return <div style={{ display: "flex", justifyContent: "center", padding: "4rem" }}><div className="loader" /></div>;

  const filterMap: Record<string, (p: Post) => boolean> = {
    all: () => true,
    pending: (p) => p.status === "pending_approval" || p.status === "approved" || p.status === "draft",
    published: (p) => p.status === "published",
    rejected: (p) => p.status === "rejected" || p.status === "failed",
  };
  const filteredPosts = posts.filter(filterMap[filter]);
  const pendingCount = posts.filter(p => p.status === "pending_approval" || p.status === "approved").length;
  const publishedCount = posts.filter(p => p.status === "published").length;
  const rejectedCount = posts.filter(p => p.status === "rejected" || p.status === "failed").length;

  async function handleEnsureBuffer() {
    setBufferLoading(true);
    try {
      await fetch("/api/workflow", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "ensure_buffer" }) });
      await loadPosts();
    } catch { /* ignore */ }
    finally { setBufferLoading(false); }
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>📝 Publications</h1>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <span style={{ fontSize: "0.75rem", color: pendingCount < 5 ? "var(--warning)" : "var(--success)" }}>
            {pendingCount}/5 en attente
          </span>
          <button className="btn btn-outline" onClick={handleEnsureBuffer} disabled={bufferLoading} style={{ fontSize: "0.75rem" }}>
            {bufferLoading ? "⏳ Génération..." : "🔄 Remplir le buffer"}
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
        {([
          { id: "all" as const, label: "Tous", count: posts.length },
          { id: "pending" as const, label: "⏳ En attente", count: pendingCount },
          { id: "published" as const, label: "✅ Publiés", count: publishedCount },
          { id: "rejected" as const, label: "❌ Rejetés", count: rejectedCount },
        ]).map(tab => (
          <button key={tab.id}
            className={`btn ${filter === tab.id ? "btn-primary" : "btn-outline"}`}
            onClick={() => setFilter(tab.id)}
            style={{ fontSize: "0.8125rem" }}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {filteredPosts.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
          <p style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>📭</p>
          <p style={{ color: "var(--muted)" }}>Aucun post encore. Lancez un workflow pour générer votre premier post !</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {filteredPosts.map(post => {
            const isExpanded = expandedId === post.id;

            return (
              <div key={post.id} className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "0.75rem", flexWrap: "wrap", gap: "0.5rem" }}>
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                    {statusBadge(post.status)}
                    <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                      {new Date(post.createdAt).toLocaleString("fr-FR")}
                    </span>
                    <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                      · {post.content.length} car.
                    </span>
                    {post.scheduledAt && (
                      <span className="badge badge-info" style={{ fontSize: "0.625rem" }}>
                        📅 {new Date(post.scheduledAt).toLocaleString("fr-FR")}
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    {post.status === "pending_approval" && (
                      <>
                        <button className="btn btn-success" onClick={() => handleAction(post.id, "publish")} disabled={actionLoading === post.id}>
                          {actionLoading === post.id ? "..." : "✅ Publier"}
                        </button>
                        <button className="btn btn-primary" onClick={() => setSchedulingId(schedulingId === post.id ? null : post.id)} style={{ fontSize: "0.8125rem" }}>
                          📅 Programmer
                        </button>
                        <button className="btn btn-danger" onClick={() => handleAction(post.id, "reject")} disabled={actionLoading === post.id}>
                          ❌ Rejeter
                        </button>
                      </>
                    )}
                    {post.status === "approved" && !post.scheduledAt && (
                      <>
                        <button className="btn btn-success" onClick={() => handleAction(post.id, "publish")} disabled={actionLoading === post.id}>
                          🚀 Publier maintenant
                        </button>
                        <button className="btn btn-primary" onClick={() => setSchedulingId(schedulingId === post.id ? null : post.id)} style={{ fontSize: "0.8125rem" }}>
                          📅 Programmer
                        </button>
                      </>
                    )}
                    {post.status === "approved" && post.scheduledAt && (
                      <button className="btn btn-outline" onClick={() => setSchedulingId(schedulingId === post.id ? null : post.id)} style={{ fontSize: "0.8125rem" }}>
                        📅 Modifier la date
                      </button>
                    )}
                    <button className="btn btn-outline" onClick={() => handleDelete(post.id)} style={{ fontSize: "0.75rem" }}>🗑️</button>
                  </div>
                </div>

                {/* Scheduling panel */}
                {schedulingId === post.id && (
                  <div style={{ background: "rgba(59,130,246,0.06)", borderRadius: 10, padding: "0.75rem", marginBottom: "0.75rem", border: "1px solid rgba(59,130,246,0.15)" }}>
                    <p style={{ fontSize: "0.8125rem", fontWeight: 600, marginBottom: 8 }}>📅 Programmer la publication</p>
                    <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-end", flexWrap: "wrap" }}>
                      <div>
                        <label style={{ fontSize: "0.6875rem", color: "var(--muted)", display: "block", marginBottom: 4 }}>Date</label>
                        <input type="date"
                          value={scheduleDates[post.id] || new Date(Date.now() + 86400000).toISOString().split("T")[0]}
                          onChange={e => setScheduleDates(prev => ({ ...prev, [post.id]: e.target.value }))}
                          min={new Date().toISOString().split("T")[0]}
                          style={{ width: 160 }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: "0.6875rem", color: "var(--muted)", display: "block", marginBottom: 4 }}>Heure</label>
                        <input type="time"
                          value={scheduleTimes[post.id] || "09:00"}
                          onChange={e => setScheduleTimes(prev => ({ ...prev, [post.id]: e.target.value }))}
                          style={{ width: 110 }}
                        />
                      </div>
                      <button className="btn btn-success" onClick={() => handleSchedule(post.id)} disabled={actionLoading === post.id}
                        style={{ whiteSpace: "nowrap", fontSize: "0.8125rem" }}
                      >
                        {actionLoading === post.id ? "⏳..." : "✅ Confirmer"}
                      </button>
                      <button className="btn btn-outline" onClick={() => setSchedulingId(null)} style={{ fontSize: "0.8125rem" }}>Annuler</button>
                    </div>
                    <p style={{ fontSize: "0.625rem", color: "var(--muted)", marginTop: 6 }}>
                      Le cron Vercel publiera automatiquement à l&apos;heure prévue.
                    </p>
                  </div>
                )}

                {/* Post Content */}
                <div
                  style={{
                    background: "var(--background)",
                    borderRadius: 8,
                    padding: "1rem",
                    whiteSpace: "pre-wrap",
                    fontSize: "0.875rem",
                    lineHeight: 1.6,
                    maxHeight: isExpanded ? "none" : 200,
                    overflow: "hidden",
                    position: "relative",
                    cursor: "pointer",
                  }}
                  onClick={() => setExpandedId(isExpanded ? null : post.id)}
                >
                  {post.content}
                  {!isExpanded && post.content.length > 300 && (
                    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 60, background: "linear-gradient(transparent, var(--background))" }} />
                  )}
                </div>

                {/* Expanded: edit + revision */}
                {isExpanded && (
                  <div style={{ marginTop: "0.75rem" }}>
                    {/* Inline edit */}
                    {post.status !== "published" && (
                      <textarea
                        defaultValue={post.content}
                        style={{ fontSize: "0.875rem", marginBottom: "0.75rem" }}
                        onBlur={(e) => {
                          if (e.target.value !== post.content) handleEdit(post.id, e.target.value);
                        }}
                      />
                    )}

                    {/* Revision feedback zone */}
                    {post.status !== "published" && (
                      <div style={{
                        background: "rgba(59,130,246,0.04)",
                        borderRadius: 10,
                        padding: "0.75rem",
                        border: "1px solid rgba(59,130,246,0.15)",
                      }}>
                        <label style={{ fontSize: "0.8125rem", fontWeight: 600, display: "block", marginBottom: 6 }}>
                          🔄 Demander une modification IA
                        </label>
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                          <input
                            value={revisionTexts[post.id] || ""}
                            onChange={e => setRevisionTexts(prev => ({ ...prev, [post.id]: e.target.value }))}
                            placeholder="Ex: Rends le plus court, ajoute un CTA, change le ton..."
                            style={{ flex: 1 }}
                          />
                          <button className="btn btn-primary"
                            onClick={() => handleRevise(post.id)}
                            disabled={revisingId === post.id || !(revisionTexts[post.id]?.trim())}
                            style={{ whiteSpace: "nowrap" }}
                          >
                            {revisingId === post.id ? "⏳ Révision..." : "🔄 Réviser"}
                          </button>
                        </div>
                        <div style={{ display: "flex", gap: "0.375rem", marginTop: 8, flexWrap: "wrap" }}>
                          {["Plus court", "Plus agressif", "Ajoute un CTA", "Ton storytelling", "Plus professionnel"].map(s => (
                            <button key={s} className="btn btn-outline"
                              onClick={() => setRevisionTexts(prev => ({ ...prev, [post.id]: s }))}
                              style={{ fontSize: "0.625rem", padding: "0.2rem 0.375rem" }}
                            >{s}</button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {post.linkedinPostId && (
                  <div style={{ marginTop: "0.5rem", fontSize: "0.75rem", color: "var(--success)" }}>
                    ✅ LinkedIn ID: {post.linkedinPostId}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
