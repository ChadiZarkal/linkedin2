"use client";
import { useEffect, useState } from "react";

interface Topic {
  id: string;
  title: string;
  description: string;
  category: string;
  recency: string;
  status: string;
  createdAt: string;
}

export default function TopicsPage() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadTopics(); }, []);

  async function loadTopics() {
    const data = await fetch("/api/topics").then(r => r.json()).catch(() => []);
    setTopics(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  async function updateStatus(id: string, status: string) {
    await fetch("/api/topics", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    await loadTopics();
  }

  async function deleteTopic(id: string) {
    if (!confirm("Supprimer ce sujet ?")) return;
    await fetch(`/api/topics?id=${id}`, { method: "DELETE" });
    await loadTopics();
  }

  const statusBadge = (status: string) => {
    const map: Record<string, { class: string; label: string }> = {
      suggested: { class: "badge-info", label: "Suggéré" },
      approved: { class: "badge-success", label: "Approuvé" },
      rejected: { class: "badge-danger", label: "Rejeté" },
      used: { class: "badge-muted", label: "Utilisé" },
    };
    const s = map[status] || { class: "badge-muted", label: status };
    return <span className={`badge ${s.class}`}>{s.label}</span>;
  };

  const categoryBadge = (cat: string) => (
    <span className="badge badge-info">{cat}</span>
  );

  if (loading) return <div style={{ display: "flex", justifyContent: "center", padding: "4rem" }}><div className="loader" /></div>;

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "1.5rem" }}>💡 Sujets</h1>

      {topics.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
          <p style={{ color: "var(--muted)" }}>Aucun sujet encore. Lancez un workflow pour en générer !</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {topics.map(topic => (
            <div key={topic.id} className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", flexWrap: "wrap", gap: "0.5rem" }}>
                <div>
                  <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
                    {statusBadge(topic.status)}
                    {categoryBadge(topic.category)}
                    <span className={`badge ${topic.recency === "recent" ? "badge-warning" : topic.recency === "trending" ? "badge-danger" : "badge-muted"}`}>
                      {topic.recency === "recent" ? "Récent" : topic.recency === "trending" ? "Tendance" : "Evergreen"}
                    </span>
                  </div>
                  <h3 style={{ fontWeight: 600 }}>{topic.title}</h3>
                  <p style={{ fontSize: "0.8125rem", color: "var(--muted)", marginTop: 4 }}>{topic.description}</p>
                  <p style={{ fontSize: "0.6875rem", color: "var(--muted)", marginTop: 4 }}>
                    {new Date(topic.createdAt).toLocaleString("fr-FR")}
                  </p>
                </div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  {topic.status === "suggested" && (
                    <>
                      <button className="btn btn-success" onClick={() => updateStatus(topic.id, "approved")}>✅</button>
                      <button className="btn btn-danger" onClick={() => updateStatus(topic.id, "rejected")}>❌</button>
                    </>
                  )}
                  <button className="btn btn-outline" onClick={() => deleteTopic(topic.id)}>🗑️</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
