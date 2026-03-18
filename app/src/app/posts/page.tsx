'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/components/Toast';

import type { Post } from '@/lib/types';

export default function PostsPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [scheduleDates, setScheduleDates] = useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => { fetchPosts(); }, []);

  async function fetchPosts() {
    setLoading(true);
    try {
      const res = await fetch('/api/posts');
      const data = await res.json();
      if (data.success) setPosts(data.data);
      else toast('Erreur chargement des posts', 'error');
    } catch {
      toast('Erreur de connexion', 'error');
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
        
        const messages: Record<string, string> = {
          publish: 'Publié sur LinkedIn !',
          schedule: 'Post programmé !',
          edit: 'Post modifié !',
          approve: 'Post approuvé !',
          reject: 'Post rejeté',
        };
        toast(messages[action] || 'Action effectuée', action === 'reject' ? 'warning' : 'success');
      } else {
        toast(`Erreur: ${data.error}`, 'error');
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Erreur', 'error');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDelete(id: string) {
    setActionLoading(id);
    setConfirmDelete(null);
    try {
      const res = await fetch('/api/posts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (data.success) {
        setPosts(prev => prev.filter(p => p.id !== id));
        toast('Post supprimé', 'info');
      }
    } catch {
      toast('Erreur suppression', 'error');
    } finally {
      setActionLoading(null);
    }
  }

  const filtered = filter === 'all' ? posts : posts.filter(p => p.status === filter);
  const counts: Record<string, number> = {
    all: posts.length,
    pending: posts.filter(p => p.status === 'pending').length,
    scheduled: posts.filter(p => p.status === 'scheduled').length,
    published: posts.filter(p => p.status === 'published').length,
  };

  const statusConfig: Record<string, { color: string; label: string; icon: string }> = {
    draft: { color: 'bg-gray-500/20 text-gray-400', label: 'Brouillon', icon: '📝' },
    pending: { color: 'bg-yellow-500/20 text-yellow-400', label: 'En attente', icon: '⏳' },
    scheduled: { color: 'bg-blue-500/20 text-blue-400', label: 'Programmé', icon: '📅' },
    published: { color: 'bg-green-500/20 text-green-400', label: 'Publié', icon: '✅' },
    rejected: { color: 'bg-red-500/20 text-red-400', label: 'Rejeté', icon: '❌' },
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Posts</h1>
          <p className="text-[var(--muted)] text-sm mt-1">Chargement...</p>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="card animate-shimmer h-24 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Posts</h1>
          <p className="text-[var(--muted)] text-sm mt-1">
            {posts.length} post{posts.length > 1 ? 's' : ''} — {counts.pending} en attente
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchPosts} className="btn btn-ghost btn-sm">↻ Rafraîchir</button>
          <a href="/" className="btn btn-primary btn-sm">+ Nouveau</a>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { key: 'pending', label: 'En attente', icon: '⏳', color: 'text-yellow-400' },
          { key: 'scheduled', label: 'Programmés', icon: '📅', color: 'text-blue-400' },
          { key: 'published', label: 'Publiés', icon: '✅', color: 'text-green-400' },
          { key: 'all', label: 'Total', icon: '📊', color: 'text-[var(--foreground)]' },
        ].map(s => (
          <button key={s.key} onClick={() => setFilter(s.key)}
            className={`card text-center py-3 transition-all hover:border-[var(--accent)] ${filter === s.key ? 'border-[var(--accent)]' : ''}`}>
            <p className="text-2xl mb-1">{s.icon}</p>
            <p className={`text-xl font-bold ${s.color}`}>{counts[s.key] || 0}</p>
            <p className="text-xs text-[var(--muted)]">{s.label}</p>
          </button>
        ))}
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'pending', 'scheduled', 'published'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === f ? 'bg-[var(--accent)] text-white' : 'bg-[var(--card)] text-[var(--muted)] hover:text-white border border-[var(--border)]'
            }`}>
            {f === 'all' ? 'Tous' : statusConfig[f]?.label} ({counts[f] || 0})
          </button>
        ))}
      </div>

      {/* Posts list */}
      {filtered.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-3xl mb-2">📭</p>
          <p className="text-sm text-[var(--muted)]">
            {filter !== 'all' ? `Aucun post "${statusConfig[filter]?.label}"` : 'Aucun post encore'}
          </p>
          <a href="/" className="btn btn-primary btn-sm mt-4 inline-flex">Créer un post</a>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(post => {
            const cfg = statusConfig[post.status] || statusConfig.draft;
            const isExpanded = expandedId === post.id;
            const isLoading = actionLoading === post.id;

            return (
              <div key={post.id} className="card overflow-hidden animate-fadeIn p-0">
                {/* Post header - clickable */}
                <div className="p-4 cursor-pointer hover:bg-[var(--card-hover)] transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : post.id)}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-lg">{cfg.icon}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span>
                      <span className="text-sm font-medium truncate">{post.topic}</span>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {/* Quick publish button (visible even when collapsed) */}
                      {post.status === 'pending' && (
                        <button
                          onClick={e => { e.stopPropagation(); handleAction(post.id, 'publish'); }}
                          disabled={isLoading}
                          className="btn btn-success btn-sm"
                        >
                          {isLoading ? <span className="spinner" /> : '🚀 Publier'}
                        </button>
                      )}
                      <span className="text-xs text-[var(--muted)]">
                        {new Date(post.createdAt).toLocaleDateString('fr-FR')}
                      </span>
                      <span className="text-[var(--muted)]">{isExpanded ? '▲' : '▼'}</span>
                    </div>
                  </div>
                  {!isExpanded && (
                    <p className="text-xs text-[var(--muted)] mt-2 line-clamp-2">{post.content.substring(0, 180)}...</p>
                  )}
                </div>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="border-t border-[var(--border)] p-4 space-y-4 animate-fadeIn">
                    {/* Content view/edit */}
                    {editingId === post.id ? (
                      <div className="space-y-3">
                        <textarea
                          value={editContent}
                          onChange={e => setEditContent(e.target.value)}
                          className="input min-h-[200px] font-mono text-sm"
                        />
                        <div className="flex gap-2">
                          <button onClick={() => handleAction(post.id, 'edit', { content: editContent })}
                            disabled={isLoading} className="btn btn-primary btn-sm">
                            💾 Sauvegarder
                          </button>
                          <button onClick={() => setEditingId(null)} className="btn btn-ghost btn-sm">Annuler</button>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-[var(--background)] rounded-lg p-4 text-sm whitespace-pre-wrap leading-relaxed max-h-80 overflow-y-auto">
                        {post.content}
                      </div>
                    )}

                    {/* Schedule input */}
                    {post.status !== 'published' && (
                      <div className="flex items-center gap-3 flex-wrap">
                        <input type="datetime-local" value={scheduleDates[post.id] || ''}
                          onChange={e => setScheduleDates(prev => ({ ...prev, [post.id]: e.target.value }))}
                          className="input w-auto text-xs" />
                        <button
                          onClick={() => scheduleDates[post.id] && handleAction(post.id, 'schedule', { scheduledAt: new Date(scheduleDates[post.id]).toISOString() })}
                          disabled={!scheduleDates[post.id] || isLoading}
                          className="btn btn-primary btn-sm">
                          📅 Programmer
                        </button>
                      </div>
                    )}

                    {/* Actions toolbar */}
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-[var(--border)]">
                      {post.status !== 'published' && (
                        <button onClick={() => handleAction(post.id, 'publish')} disabled={isLoading}
                          className="btn btn-success btn-sm">
                          {isLoading ? <span className="spinner" /> : '🚀 Publier'}
                        </button>
                      )}
                      {editingId !== post.id && post.status !== 'published' && (
                        <button onClick={() => { setEditingId(post.id); setEditContent(post.content); }}
                          className="btn btn-ghost btn-sm">✏️ Modifier</button>
                      )}
                      <button onClick={async () => { try { await navigator.clipboard.writeText(post.content); toast('Copié !', 'success'); } catch { toast('Erreur copie', 'error'); } }}
                        className="btn btn-ghost btn-sm">📋 Copier</button>

                      {/* Delete with confirmation */}
                      {confirmDelete === post.id ? (
                        <div className="flex items-center gap-2 ml-auto">
                          <span className="text-xs text-red-400">Confirmer ?</span>
                          <button onClick={() => handleDelete(post.id)} className="btn btn-sm bg-red-500/30 text-red-400">Oui</button>
                          <button onClick={() => setConfirmDelete(null)} className="btn btn-ghost btn-sm">Non</button>
                        </div>
                      ) : (
                        <button onClick={() => setConfirmDelete(post.id)} className="btn btn-sm bg-red-500/10 text-red-400 hover:bg-red-500/20 ml-auto">
                          🗑️
                        </button>
                      )}
                    </div>

                    {/* Sources */}
                    {post.sources?.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-[var(--muted)] mb-2">📌 Sources</p>
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
                    <div className="text-xs text-[var(--muted)] space-y-1 pt-2 border-t border-[var(--border)]">
                      {post.scheduledAt && <p>📅 Programmé : {new Date(post.scheduledAt).toLocaleString('fr-FR')}</p>}
                      {post.publishedAt && <p>✅ Publié : {new Date(post.publishedAt).toLocaleString('fr-FR')}</p>}
                      <p>🔑 {post.id}</p>
                    </div>
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
