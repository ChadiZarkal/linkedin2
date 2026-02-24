"use client";
import { useEffect, useState, useRef, useCallback } from "react";

interface PromptMode { id: string; name: string; prompt: string; }
interface Model { id: string; name: string; description: string; }
interface Agent {
  id: string; name: string; role: string; description: string;
  prompt: string; promptModes: PromptMode[]; activePromptModeId: string;
  model: string; enabled: boolean; order: number;
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingModeId, setEditingModeId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const contentRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    Promise.all([
      fetch("/api/agents").then(r => r.json()),
      fetch("/api/models").then(r => r.json()),
    ]).then(([a, m]) => { setAgents(a); setModels(m); setLoading(false); });
  }, []);

  const toggleExpand = useCallback((id: string) => {
    setExpandedId(prev => prev === id ? null : id);
    setEditingModeId(null);
  }, []);

  async function saveAgent(agent: Agent) {
    setSaving(true);
    await fetch("/api/agents", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(agent),
    });
    setSaving(false);
  }

  function updateAgent(id: string, updates: Partial<Agent>) {
    setAgents(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
  }

  async function toggleEnabled(agent: Agent) {
    const updated = { ...agent, enabled: !agent.enabled };
    updateAgent(agent.id, { enabled: !agent.enabled });
    await saveAgent(updated);
  }

  async function setActiveMode(agent: Agent, modeId: string) {
    const mode = agent.promptModes.find(m => m.id === modeId);
    if (!mode) return;
    updateAgent(agent.id, { activePromptModeId: modeId, prompt: mode.prompt });
    await saveAgent({ ...agent, activePromptModeId: modeId, prompt: mode.prompt });
  }

  function addPromptMode(agent: Agent) {
    const newMode: PromptMode = {
      id: `mode-${Date.now().toString(36)}`,
      name: `Mode ${(agent.promptModes?.length || 0) + 1}`,
      prompt: agent.prompt || "",
    };
    const modes = [...(agent.promptModes || []), newMode];
    updateAgent(agent.id, { promptModes: modes });
    setEditingModeId(newMode.id);
  }

  function deletePromptMode(agent: Agent, modeId: string) {
    if ((agent.promptModes?.length || 0) <= 1) return;
    const modes = agent.promptModes.filter(m => m.id !== modeId);
    const updates: Partial<Agent> = { promptModes: modes };
    if (agent.activePromptModeId === modeId) {
      updates.activePromptModeId = modes[0].id;
      updates.prompt = modes[0].prompt;
    }
    updateAgent(agent.id, updates);
    if (editingModeId === modeId) setEditingModeId(null);
  }

  function updatePromptMode(agent: Agent, modeId: string, updates: Partial<PromptMode>) {
    const modes = (agent.promptModes || []).map(m => m.id === modeId ? { ...m, ...updates } : m);
    const agentUpdates: Partial<Agent> = { promptModes: modes };
    if (agent.activePromptModeId === modeId && updates.prompt) {
      agentUpdates.prompt = updates.prompt;
    }
    updateAgent(agent.id, agentUpdates);
  }

  if (loading) return <div style={{ display: "flex", justifyContent: "center", padding: "4rem" }}><div className="loader" /></div>;

  return (
    <div style={{ maxWidth: 860, margin: "0 auto" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "1.5rem" }}>🤖 Agents IA</h1>

      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {agents.map(agent => {
          const isExpanded = expandedId === agent.id;
          const modes = agent.promptModes || [];
          const activeMode = modes.find(m => m.id === agent.activePromptModeId);

          return (
            <div key={agent.id} className="card" style={{ transition: "all 0.3s ease" }}>
              {/* Header — clic pour ouvrir */}
              <div
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
                onClick={() => toggleExpand(agent.id)}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <span style={{ fontSize: "1.5rem" }}>{agent.name.split(" ")[0]}</span>
                  <div>
                    <h3 style={{ fontWeight: 600, fontSize: "1rem" }}>{agent.name}</h3>
                    <p style={{ fontSize: "0.75rem", color: "var(--muted)", lineHeight: 1.4 }}>{agent.description}</p>
                  </div>
                </div>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  {activeMode && modes.length > 1 && (
                    <span className="badge badge-info" style={{ fontSize: "0.6875rem" }}>
                      {activeMode.name}
                    </span>
                  )}
                  <span className="badge badge-muted" style={{ fontSize: "0.625rem" }}>{agent.model}</span>
                  <button
                    className={`btn ${agent.enabled ? "btn-success" : "btn-outline"}`}
                    onClick={(e) => { e.stopPropagation(); toggleEnabled(agent); }}
                    style={{ fontSize: "0.75rem", padding: "0.25rem 0.75rem" }}
                  >
                    {agent.enabled ? "ON" : "OFF"}
                  </button>
                  <span style={{ fontSize: "0.75rem", color: "var(--muted)", transition: "transform 0.3s", transform: isExpanded ? "rotate(180deg)" : "none" }}>▼</span>
                </div>
              </div>

              {/* Contenu auto-déployé */}
              <div
                ref={el => { contentRefs.current[agent.id] = el; }}
                style={{
                  maxHeight: isExpanded ? 2000 : 0,
                  overflow: "hidden",
                  transition: "max-height 0.4s ease, opacity 0.3s ease, margin-top 0.3s ease",
                  opacity: isExpanded ? 1 : 0,
                  marginTop: isExpanded ? "1rem" : 0,
                }}
              >
                <div style={{ borderTop: "1px solid var(--card-border)", paddingTop: "1rem" }}>
                  {/* Model selector */}
                  <div style={{ marginBottom: "1rem" }}>
                    <label style={{ fontSize: "0.8125rem", color: "var(--muted)", display: "block", marginBottom: 6 }}>🧠 Modèle LLM</label>
                    <div style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap" }}>
                      {models.map(m => (
                        <button key={m.id}
                          className={`btn ${agent.model === m.id ? "btn-primary" : "btn-outline"}`}
                          onClick={() => updateAgent(agent.id, { model: m.id })}
                          style={{ fontSize: "0.75rem", padding: "0.375rem 0.625rem" }}
                        >{m.name}</button>
                      ))}
                    </div>
                  </div>

                  {/* Modes de prompt — affichés en cartes, pas en dropdown */}
                  {modes.length > 0 && (
                    <div style={{ marginBottom: "1rem" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                        <label style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>
                          ✍️ Modes de prompt ({modes.length})
                        </label>
                        <button className="btn btn-outline" onClick={() => addPromptMode(agent)} style={{ fontSize: "0.6875rem", padding: "0.25rem 0.5rem" }}>
                          + Nouveau mode
                        </button>
                      </div>

                      {/* Toutes les cartes de mode visibles */}
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                        {modes.map(mode => {
                          const isActive = agent.activePromptModeId === mode.id;
                          const isEditingThis = editingModeId === mode.id;

                          return (
                            <div key={mode.id}
                              style={{
                                borderRadius: 10,
                                padding: "0.75rem",
                                border: isActive ? "2px solid var(--primary)" : "1px solid var(--card-border)",
                                background: isActive ? "rgba(59,130,246,0.04)" : "var(--background)",
                                transition: "all 0.2s",
                              }}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: isEditingThis ? 8 : 0 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flex: 1 }}>
                                  {isActive && <span style={{ fontSize: "0.75rem" }}>✅</span>}
                                  {isEditingThis ? (
                                    <input value={mode.name}
                                      onChange={e => updatePromptMode(agent, mode.id, { name: e.target.value })}
                                      style={{ fontWeight: 600, fontSize: "0.875rem", width: "auto", flex: 1 }}
                                      placeholder="Nom du mode" onClick={e => e.stopPropagation()}
                                    />
                                  ) : (
                                    <span style={{ fontWeight: 600, fontSize: "0.875rem", cursor: "pointer" }}
                                      onClick={() => setActiveMode(agent, mode.id)}
                                    >{mode.name}</span>
                                  )}
                                  {!isActive && !isEditingThis && (
                                    <span style={{ fontSize: "0.6875rem", color: "var(--muted)", cursor: "pointer" }}
                                      onClick={() => setActiveMode(agent, mode.id)}
                                    >cliquer pour activer</span>
                                  )}
                                </div>
                                <div style={{ display: "flex", gap: "0.25rem" }}>
                                  <button className={`btn ${isEditingThis ? "btn-primary" : "btn-outline"}`}
                                    onClick={() => setEditingModeId(isEditingThis ? null : mode.id)}
                                    style={{ fontSize: "0.6875rem", padding: "0.2rem 0.5rem" }}
                                  >{isEditingThis ? "✓ OK" : "✏️"}</button>
                                  {modes.length > 1 && (
                                    <button className="btn btn-outline" onClick={() => deletePromptMode(agent, mode.id)}
                                      style={{ fontSize: "0.6875rem", padding: "0.2rem 0.5rem", color: "var(--danger)" }}
                                    >🗑</button>
                                  )}
                                </div>
                              </div>

                              {/* Prompt preview / edit */}
                              {isEditingThis ? (
                                <textarea value={mode.prompt}
                                  onChange={e => updatePromptMode(agent, mode.id, { prompt: e.target.value })}
                                  style={{ minHeight: 200, fontSize: "0.8125rem", marginTop: 4 }}
                                />
                              ) : (
                                <p style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: 6, whiteSpace: "pre-wrap", lineHeight: 1.5,
                                  maxHeight: isActive ? 120 : 50, overflow: "hidden", position: "relative" }}>
                                  {mode.prompt.slice(0, isActive ? 400 : 150)}{mode.prompt.length > (isActive ? 400 : 150) ? "..." : ""}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Save button */}
                  <button
                    className="btn btn-primary"
                    onClick={() => { saveAgent(agents.find(a => a.id === agent.id)!); toggleExpand(agent.id); }}
                    disabled={saving}
                    style={{ width: "100%" }}
                  >
                    {saving ? "Sauvegarde..." : "💾 Sauvegarder les modifications"}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
