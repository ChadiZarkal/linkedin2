'use client';

import { useState, useEffect } from 'react';

interface Post {
  id: string;
  topic: string;
  research: string;
  content: string;
  sources: string[];
  status: string;
  createdAt: string;
  scheduledAt?: string;
  publishedAt?: string;
}

export default function PostsPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [scheduleDate, setScheduleDate] = useState('');

  useEffect(() => { fetchPosts(); }, []);

  async function fetchPosts() {
    setLoading(true);
    try {
      const res = await fetch('/api/posts');
      const data = await res.json();
      if (data.success) setPosts(data.data);
    } catch (err) {
      console.error('Fetch posts error:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(id: string, action: string, extra?: Record<string, unknown>) {
    setActionLoading(id);
    try {
      const res = await fetch('/api/posts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action, ...extra }),
      });
      const data = await res.json();
      if (data.success) {
        setPosts(prev => prev.map(p => p.id === id ? data.data : p));
        setEditingId(null);
      } else {
        alert(`Erreur: ${data.error}`);
      }
    } catch (err) {
      alert(`Erreur: ${err instanceof Error ? err.message : 'unknown'}`);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer ce post ?')) return;
    setActionLoading(id);
    try {
      const res = await fetch('/api/posts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (data.success) {
        setPosts(prev => prev.filter(p => p.id !== id));
      }
    } catch (err) {
      console.error('Delete error:', err);
    } finally {
      setActionLoading(null);
    }
  }

  const filtered = filter === 'all' ? posts : posts.filter(p => p.status === filter);
  const counts = {
    all: posts.length,
    pending: posts.filter(p => p.status === 'pending').length,
    scheduled: posts.filter(p => p.status === 'scheduled').length,
    published: posts.filter(p => p.status === 'published').length,
    rejected: posts.filter(p => p.status === 'rejected').length,
  };

  const statusColors: Record<string, string> = {
    draft: 'bg-gray-500/20 text-gray-400',
    pending: 'bg-yellow-500/20 text-yellow-400',
    scheduled: 'bg-blue-500/20 text-blue-400',
    published: 'bg-green-500/20 text-green-400',
    rejected: 'bg-red-500/20 text-red-400',
  };

  const statusLabels: Record<string, string> = {
    draft: 'Brouillon',
    pending: 'En attente',
    scheduled: 'Programmé',
    published: 'Publié',
    rejected: 'Rejeté',
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Posts</h1>
        <p className="text-[var(--muted)] text-sm mt-1">Gérer, publier et programmer vos posts LinkedIn</p>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'pending', 'scheduled', 'published', 'rejected'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === f
                ? 'bg-[var(--accent)] text-white'
                : 'bg-[var(--card)] text-[var(--muted)] hover:text-white border border-[var(--border)]'
            }`}
          >
            {f === 'all' ? 'Tous' : statusLabels[f]} ({counts[f]})
          </button>
        ))}
      </div>

      {/* Posts list */}
      {loading ? (
        <div className="text-center py-12 text-[var(--muted)]">
          <div className="w-6 h-6 border-2 border-[var(--accent)]/30 border-t-[var(--accent)] rounded-full animate-spin mx-auto mb-3" />
          Chargement...
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-[var(--muted)] bg-[var(--card)] rounded-xl border border-[var(--border)]">
          <p className="text-3xl mb-2">📭</p>
          <p className="text-sm">Aucun post {filter !== 'all' ? `avec le statut "${statusLabels[filter]}"` : ''}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(post => (
            <div
              key={post.id}
              className="bg-[var(--card)] rounded-xl border border-[var(--border)] overflow-hidden animate-fadeIn"
            >
              {/* Header */}
              <div
                className="p-4 cursor-pointer hover:bg-[var(--card-hover)] transition-colors"
                onClick={() => setExpandedId(expandedId === post.id ? null : post.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[post.status]}`}>
                      {statusLabels[post.status]}
                    </span>
                    <span className="text-sm font-medium truncate">{post.topic}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-[var(--muted)] flex-shrink-0">
                    <span>{new Date(post.createdAt).toLocaleDateString('fr-FR')}</span>
                    <span>{expandedId === post.id ? '▲' : '▼'}</span>
                  </div>
                </div>
                {/* Preview */}
                {expandedId !== post.id && (
                  <p className="text-xs text-[var(--muted)] mt-2 line-clamp-2">{post.content.substring(0, 150)}...</p>
                )}
              </div>

              {/* Expanded view */}
              {expandedId === post.id && (
                <div className="border-t border-[var(--border)] p-4 space-y-4">
                  {/* Content */}
                  {editingId === post.id ? (
                    <div className="space-y-3">
                      <textarea
                        value={editContent}
                        onChange={e => setEditContent(e.target.value)}
                        className="w-full bg-[var(--background)] border border-[var(--border)] rounded-lg p-3 text-sm min-h-[200px] focus:outline-none focus:border-[var(--accent)]"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleAction(post.id, 'edit', { content: editContent })}
                          disabled={actionLoading === post.id}
                          className="px-3 py-1.5 bg-[var(--accent)] rounded-lg text-xs font-medium"
                        >
                          Sauvegarder
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="px-3 py-1.5 bg-[var(--border)] rounded-lg text-xs"
                        >
                          Annuler
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-[var(--background)] rounded-lg p-4 text-sm whitespace-pre-wrap leading-relaxed max-h-80 overflow-y-auto">
                      {post.content}
                    </div>
                  )}

                  {/* Schedule input */}
                  {post.status !== 'published' && (
                    <div className="flex items-center gap-3">
                      <input
                        type="datetime-local"
                        value={scheduleDate}
                        onChange={e => setScheduleDate(e.target.value)}
                        className="bg-[var(--background)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-[var(--accent)]"
                      />
                      <button
                        onClick={() => scheduleDate && handleAction(post.id, 'schedule', { scheduledAt: new Date(scheduleDate).toISOString() })}
                        disabled={!scheduleDate || actionLoading === post.id}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 rounded-lg text-xs font-medium transition-colors"
                      >
                        📅 Programmer
                      </button>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2">
                    {post.status !== 'published' && (
                      <button
                        onClick={() => handleAction(post.id, 'publish')}
                        disabled={actionLoading === post.id}
                        className="px-3 py-1.5 bg-[var(--success)] text-black hover:opacity-90 disabled:opacity-40 rounded-lg text-xs font-medium transition-colors"
                      >
                        {actionLoading === post.id ? '...' : '🚀 Publier'}
                      </button>
                    )}
                    {editingId !== post.id && post.status !== 'published' && (
                      <button
                        onClick={() => { setEditingId(post.id); setEditContent(post.content); }}
                        className="px-3 py-1.5 bg-[var(--border)] hover:bg-[var(--card-hover)] rounded-lg text-xs transition-colors"
                      >
                        ✏️ Modifier
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(post.id)}
                      disabled={actionLoading === post.id}
                      className="px-3 py-1.5 bg-red-500/20 text-red-400 hover:bg-red-500/30 disabled:opacity-40 rounded-lg text-xs transition-colors"
                    >
                      🗑️ Supprimer
                    </button>
                  </div>

                  {/* Sources */}
                  {post.sources && post.sources.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-[var(--muted)] mb-2">Sources</p>
                      <div className="flex flex-wrap gap-1.5">
                        {post.sources.map((s, i) => {
                          try {
                            return (
                              <a key={i} href={s} target="_blank" rel="noopener noreferrer"
                                className="text-xs text-[var(--accent)] bg-[var(--background)] px-2 py-0.5 rounded-full border border-[var(--border)] hover:border-[var(--accent)]">
                                {new URL(s).hostname}
                              </a>
                            );
                          } catch {
                            return <span key={i} className="text-xs text-[var(--muted)]">{s}</span>;
                          }
                        })}
                      </div>
                    </div>
                  )}

                  {/* Meta */}
                  <div className="text-xs text-[var(--muted)] space-y-1">
                    {post.scheduledAt && <p>📅 Programmé : {new Date(post.scheduledAt).toLocaleString('fr-FR')}</p>}
                    {post.publishedAt && <p>✅ Publié : {new Date(post.publishedAt).toLocaleString('fr-FR')}</p>}
                    <p>ID : {post.id}</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
