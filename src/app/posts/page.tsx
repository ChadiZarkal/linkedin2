"use client";
import { useEffect, useState, useCallback } from "react";

interface Post {
  id: string;
  topic: string;
  content: string;
  status: string;
  linkedinPostId: string | null;
  publishedAt: string | null;
  createdAt: string;
}

type Filter = "all" | "pending" | "published" | "rejected";

export default function PostsPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");

  const loadPosts = useCallback(async () => {
    const data = await fetch("/api/posts").then((r) => r.json()).catch(() => []);
    setPosts(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  const filtered = posts.filter((p) => {
    if (filter === "all") return true;
    if (filter === "pending") return p.status === "pending" || p.status === "approved";
    return p.status === filter;
  });

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

  async function handleSave(postId: string) {
    setActionLoading(postId);
    await fetch("/api/posts", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: postId, content: editContent }),
    });
    setEditingId(null);
    await loadPosts();
    setActionLoading(null);
  }

  async function handleDelete(postId: string) {
    if (!confirm("Supprimer ce post ?")) return;
    await fetch(`/api/posts?id=${postId}`, { method: "DELETE" });
    await loadPosts();
  }

  async function generateNew() {
    setActionLoading("generating");
    try {
      await fetch("/api/posts", { method: "POST" });
      await loadPosts();
    } catch {
      /* ignore */
    } finally {
      setActionLoading(null);
    }
  }

  const statusBadge = (status: string) => {
    const map: Record<string, { cls: string; label: string }> = {
      published: { cls: "badge-success", label: "Publié" },
      pending: { cls: "badge-warning", label: "En attente" },
      approved: { cls: "badge-info", label: "Approuvé" },
      rejected: { cls: "badge-danger", label: "Rejeté" },
    };
    const s = map[status] || { cls: "badge-muted", label: status };
    return <span className={`badge ${s.cls}`}>{s.label}</span>;
  };

  const counts = {
    all: posts.length,
    pending: posts.filter((p) => p.status === "pending" || p.status === "approved").length,
    published: posts.filter((p) => p.status === "published").length,
    rejected: posts.filter((p) => p.status === "rejected").length,
  };

  if (loading)
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "4rem" }}>
        <div className="loader" />
      </div>
    );

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", flexWrap: "wrap", gap: "0.5rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>📝 Publications</h1>
        <button
          className="btn btn-primary"
          onClick={generateNew}
          disabled={actionLoading === "generating"}
          style={{ fontSize: "0.875rem" }}
        >
          {actionLoading === "generating" ? "⏳ Génération..." : "⚡ Nouveau post"}
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
        {(["all", "pending", "published", "rejected"] as Filter[]).map((f) => (
          <button
            key={f}
            className={`btn ${filter === f ? "btn-primary" : "btn-outline"}`}
            onClick={() => setFilter(f)}
            style={{ fontSize: "0.8125rem" }}
          >
            {f === "all" ? "Tous" : f === "pending" ? "En attente" : f === "published" ? "Publiés" : "Rejetés"}
            <span style={{ marginLeft: 6, opacity: 0.7 }}>({counts[f]})</span>
          </button>
        ))}
      </div>

      {/* Posts list */}
      {filtered.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
          <p style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>📭</p>
          <p style={{ color: "var(--muted)" }}>
            {filter === "all"
              ? "Aucun post. Le cron en générera automatiquement."
              : `Aucun post ${filter === "pending" ? "en attente" : filter === "published" ? "publié" : "rejeté"}.`}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {filtered.map((post) => {
            const isExpanded = expandedId === post.id;
            const isEditing = editingId === post.id;

            return (
              <div key={post.id} className="card">
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "0.75rem", flexWrap: "wrap", gap: "0.5rem" }}>
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                    {statusBadge(post.status)}
                    <span style={{ fontWeight: 600, fontSize: "0.875rem" }}>{post.topic}</span>
                    <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                      {new Date(post.createdAt).toLocaleDateString("fr-FR")}
                    </span>
                    {post.publishedAt && (
                      <span style={{ fontSize: "0.7rem", color: "var(--muted)" }}>
                        · publié le {new Date(post.publishedAt).toLocaleDateString("fr-FR")}
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: "0.375rem" }}>
                    {(post.status === "pending" || post.status === "approved") && (
                      <>
                        <button className="btn btn-success" onClick={() => handleAction(post.id, "publish")} disabled={actionLoading === post.id} style={{ fontSize: "0.75rem" }}>
                          {actionLoading === post.id ? "..." : "Publier"}
                        </button>
                        <button className="btn btn-danger" onClick={() => handleAction(post.id, "reject")} disabled={actionLoading === post.id} style={{ fontSize: "0.75rem" }}>
                          Rejeter
                        </button>
                      </>
                    )}
                    {post.status !== "published" && (
                      <button className="btn btn-outline" onClick={() => { setEditingId(isEditing ? null : post.id); setEditContent(post.content); }} style={{ fontSize: "0.75rem" }}>
                        {isEditing ? "Annuler" : "Modifier"}
                      </button>
                    )}
                    <button className="btn btn-outline" onClick={() => handleDelete(post.id)} style={{ fontSize: "0.75rem" }}>🗑️</button>
                  </div>
                </div>

                {/* Content */}
                {isEditing ? (
                  <div>
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      style={{ minHeight: 200, width: "100%", fontSize: "0.875rem", lineHeight: 1.6 }}
                    />
                    <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                      <button className="btn btn-success" onClick={() => handleSave(post.id)} disabled={actionLoading === post.id}>
                        Sauvegarder
                      </button>
                      <span style={{ fontSize: "0.75rem", color: "var(--muted)", alignSelf: "center" }}>
                        {editContent.split(/\s+/).length} mots
                      </span>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => setExpandedId(isExpanded ? null : post.id)}
                    style={{
                      background: "var(--background)",
                      borderRadius: 8,
                      padding: "0.75rem",
                      fontSize: "0.8125rem",
                      lineHeight: 1.6,
                      whiteSpace: "pre-wrap",
                      maxHeight: isExpanded ? "none" : 150,
                      overflow: "hidden",
                      cursor: "pointer",
                      position: "relative",
                    }}
                  >
                    {post.content}
                    {!isExpanded && post.content.length > 300 && (
                      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 50, background: "linear-gradient(transparent, var(--card-bg))" }} />
                    )}
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
