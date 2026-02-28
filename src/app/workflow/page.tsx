"use client";
import { useEffect, useState, useCallback } from "react";

interface TopicSuggestion { title: string; description: string; angle: string; category: string; recency: string; }
interface PromptMode { id: string; name: string; prompt: string; }
interface Agent { id: string; name: string; role: string; promptModes: PromptMode[]; activePromptModeId: string; model: string; enabled: boolean; }
interface Model { id: string; name: string; description: string; }
interface WorkflowStep { agentId: string; agentName: string; status: string; input: string; output: string; }
interface OrchestratorDecision { needsResearch: boolean; needsDeepResearch: boolean; needsSynthesis: boolean; directToWriter: boolean; topicTitle: string; topicDescription: string; reasoning: string; promptTweaks?: Record<string, string>; }
interface WorkflowRun { id: string; mode: string; status: string; currentStep: string; steps: WorkflowStep[]; topicSuggestions: TopicSuggestion[]; orchestratorDecision: OrchestratorDecision | null; postId: string | null; startedAt: string; completedAt: string | null; error: string | null; }
interface Post { id: string; content: string; status: string; imageSuggestions: string[]; imageUrl: string | null; scheduledAt: string | null; }

const RECENCY_OPTIONS = [
  { value: "today", label: "< 24h", icon: "🔴" },
  { value: "3days", label: "< 3j", icon: "🟠" },
  { value: "week", label: "< 1 sem", icon: "🟡" },
  { value: "month", label: "< 1 mois", icon: "🟢" },
  { value: "anytime", label: "Tout", icon: "🔵" },
];

const CATEGORIES = ["ai", "tech", "innovation", "management", "career", "data", "startup", "leadership"];

type FlowStep = "config" | "researching" | "topics" | "generating" | "result";

// ─── Unicode preview helper (client-side) ───
function formatPreview(text: string): string {
  const BOLD_UPPER = "𝗔𝗕𝗖𝗗𝗘𝗙𝗚𝗛𝗜𝗝𝗞𝗟𝗠𝗡𝗢𝗣𝗤𝗥𝗦𝗧𝗨𝗩𝗪𝗫𝗬𝗭";
  const BOLD_LOWER = "𝗮𝗯𝗰𝗱𝗲𝗳𝗴𝗵𝗶𝗷𝗸𝗹𝗺𝗻𝗼𝗽𝗾𝗿𝘀𝘁𝘂𝘃𝘄𝘅𝘆𝘇";
  const BOLD_DIGITS = "𝟬𝟭𝟮𝟯𝟰𝟱𝟲𝟳𝟴𝟵";
  const ITALIC_UPPER = "𝘈𝘉𝘊𝘋𝘌𝘍𝘎𝘏𝘐𝘑𝘒𝘓𝘔𝘕𝘖𝘗𝘘𝘙𝘚𝘛𝘜𝘝𝘞𝘟𝘠𝘡";
  const ITALIC_LOWER = "𝘢𝘣𝘤𝘥𝘦𝘧𝘨𝘩𝘪𝘫𝘬𝘭𝘮𝘯𝘰𝘱𝘲𝘳𝘴𝘵𝘶𝘷𝘸𝘹𝘺𝘻";

  function toBold(ch: string): string {
    const c = ch.charCodeAt(0);
    if (c >= 65 && c <= 90) return [...BOLD_UPPER][c - 65];
    if (c >= 97 && c <= 122) return [...BOLD_LOWER][c - 97];
    if (c >= 48 && c <= 57) return [...BOLD_DIGITS][c - 48];
    return ch;
  }
  function toItalic(ch: string): string {
    const c = ch.charCodeAt(0);
    if (c >= 65 && c <= 90) return [...ITALIC_UPPER][c - 65];
    if (c >= 97 && c <= 122) return [...ITALIC_LOWER][c - 97];
    return ch;
  }
  const conv = (s: string, fn: (c: string) => string) => [...s].map(fn).join("");

  let r = text;
  r = r.replace(/\*\*(.+?)\*\*/g, (_, c) => conv(c, toBold));
  r = r.replace(/__(.+?)__/g, (_, c) => conv(c, toBold));
  r = r.replace(/(?<!\w)\*([^*\n]+?)\*(?!\w)/g, (_, c) => conv(c, toItalic));
  r = r.replace(/(?<!\w)_([^_\n]+?)_(?!\w)/g, (_, c) => conv(c, toItalic));
  r = r.replace(/^#{1,3}\s+(.+)$/gm, (_, c) => conv(c.trim(), toBold));
  return r;
}

export default function WorkflowPage() {
  const [step, setStep] = useState<FlowStep>("config");
  const [mode, setMode] = useState<"interactive" | "auto" | "custom" | "tech_wow">("tech_wow");
  const [recency, setRecency] = useState("week");
  const [categories, setCategories] = useState<string[]>(["ai", "tech"]);
  const [customTopic, setCustomTopic] = useState("");
  const [models, setModels] = useState<Model[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [includeImages, setIncludeImages] = useState(false);

  // Advanced overrides (collapsed by default)
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [overrideModel, setOverrideModel] = useState("");
  const [overrideWriterMode, setOverrideWriterMode] = useState("");

  const [workflowId, setWorkflowId] = useState<string | null>(null);
  const [topics, setTopics] = useState<TopicSuggestion[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<TopicSuggestion | null>(null);
  const [result, setResult] = useState<WorkflowRun | null>(null);
  const [post, setPost] = useState<Post | null>(null);
  const [editContent, setEditContent] = useState("");
  const [error, setError] = useState("");
  const [history, setHistory] = useState<WorkflowRun[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Revision
  const [revisionText, setRevisionText] = useState("");
  const [revising, setRevising] = useState(false);

  // Scheduling
  const [showScheduler, setShowScheduler] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("09:00");
  const [scheduling, setScheduling] = useState(false);

  // Preview toggle
  const [showPreview, setShowPreview] = useState(false);

  // Step detail expansion
  const [expandedStep, setExpandedStep] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/models").then(r => r.json()).then(setModels).catch(() => {});
    fetch("/api/agents").then(r => r.json()).then(setAgents).catch(() => {});
    loadHistory();

    // Default schedule date = tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setScheduleDate(tomorrow.toISOString().split("T")[0]);
  }, []);

  const loadHistory = useCallback(() => {
    fetch("/api/workflow").then(r => r.json()).then((runs: WorkflowRun[]) => setHistory(runs.slice(0, 10))).catch(() => {});
  }, []);

  const writerAgent = agents.find(a => a.role === "writer");
  const writerModes = writerAgent?.promptModes || [];

  function toggleCategory(cat: string) {
    setCategories(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]);
  }

  // Build request body with optional overrides
  function getModelParam(): string | undefined {
    return overrideModel || undefined;
  }
  function getWriterModeParam(): string | undefined {
    return overrideWriterMode || undefined;
  }

  // ─── RESEARCH ───
  async function launchResearch() {
    setError(""); setStep("researching");
    try {
      const res = await fetch("/api/workflow", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "research", recency, categories, customTopic: customTopic || "", maxSuggestions: 4, model: getModelParam() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur de recherche");
      setWorkflowId(data.workflowId);
      setTopics(data.topics || []);
      setStep("topics");
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); setStep("config"); }
  }

  // ─── GENERATE ───
  async function generatePost(topic: TopicSuggestion) {
    setSelectedTopic(topic); setError(""); setStep("generating");
    try {
      const res = await fetch("/api/workflow", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate", workflowId, selectedTopic: topic, model: getModelParam(), promptModeId: getWriterModeParam(), includeImages }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur de génération");
      setResult(data);
      if (data.postId) await loadPost(data.postId);
      setStep("result"); loadHistory();
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); setStep("topics"); }
  }

  // ─── AUTO ───
  async function launchAuto() {
    setError(""); setStep("generating");
    try {
      const res = await fetch("/api/workflow", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "auto", model: getModelParam() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      setResult(data);
      if (data.postId) await loadPost(data.postId);
      setStep("result"); loadHistory();
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); setStep("config"); }
  }

  // ─── ORCHESTRATE ───
  async function launchOrchestrator() {
    if (!customTopic.trim()) return;
    setError(""); setStep("generating");
    try {
      const res = await fetch("/api/workflow", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "orchestrate", instruction: customTopic, model: getModelParam(), promptModeId: getWriterModeParam(), includeImages }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      setResult(data);
      if (data.postId) await loadPost(data.postId);
      setStep("result"); loadHistory();
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); setStep("config"); }
  }

  // ─── TECH WOW ───
  async function launchTechWow() {
    setError(""); setStep("generating");
    try {
      const res = await fetch("/api/workflow", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "tech_wow", model: getModelParam() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      setResult(data);
      if (data.postId) await loadPost(data.postId);
      setStep("result"); loadHistory();
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); setStep("config"); }
  }

  // ─── REVISE ───
  async function handleRevise() {
    if (!post || !revisionText.trim()) return;
    setRevising(true); setError("");
    try {
      const res = await fetch("/api/workflow", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "revise", postId: post.id, feedback: revisionText, model: getModelParam(), promptModeId: getWriterModeParam() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur de révision");
      setEditContent(data.content);
      setPost({ ...post, content: data.content, status: "pending_approval" });
      setRevisionText("");
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setRevising(false); }
  }

  // ─── SCHEDULE ───
  async function handleSchedule() {
    if (!post || !scheduleDate) return;
    setScheduling(true); setError("");
    try {
      const scheduledAt = new Date(`${scheduleDate}T${scheduleTime}:00`).toISOString();
      if (editContent !== post.content) await savePost();
      const res = await fetch("/api/posts", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: post.id, action: "schedule", scheduledAt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur de programmation");
      setPost({ ...post, status: "approved", scheduledAt: data.scheduledAt });
      setShowScheduler(false);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setScheduling(false); }
  }

  async function loadPost(postId: string) {
    const postsRes = await fetch("/api/posts");
    const posts: Post[] = await postsRes.json();
    const p = posts.find(pp => pp.id === postId);
    if (p) { setPost(p); setEditContent(p.content); }
  }

  async function savePost() {
    if (!post) return;
    await fetch("/api/posts", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: post.id, content: editContent }) });
    setPost({ ...post, content: editContent });
  }

  async function publishPost() {
    if (!post) return;
    if (editContent !== post.content) await savePost();
    const res = await fetch("/api/posts", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: post.id, action: "publish" }) });
    if (res.ok) { setPost({ ...post, status: "published" }); }
    else { const data = await res.json(); setError(data.error || "Échec de la publication"); }
  }

  function reset() {
    setStep("config"); setTopics([]); setSelectedTopic(null); setResult(null);
    setPost(null); setEditContent(""); setError(""); setWorkflowId(null);
    setRevisionText(""); setExpandedStep(null); setShowScheduler(false); setShowPreview(false);
  }

  // Summary of current agent config
  const activeWriterMode = writerAgent?.promptModes?.find(m => m.id === writerAgent.activePromptModeId);

  return (
    <div style={{ maxWidth: 860, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", flexWrap: "wrap", gap: "0.75rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>⚡ Workflow LinkedIn</h1>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          {step !== "config" && <button className="btn btn-outline" onClick={reset}>🔄 Nouveau</button>}
          <button className="btn btn-outline" onClick={() => setShowHistory(!showHistory)}>📜 {showHistory ? "Masquer" : "Historique"}</button>
        </div>
      </div>

      {error && <div className="card" style={{ marginBottom: "1rem", borderColor: "var(--danger)", color: "var(--danger)" }}>❌ {error}</div>}

      {/* ═════════ CONFIG ═════════ */}
      {step === "config" && (
        <>
          {/* Mode selector */}
          <div className="card" style={{ marginBottom: "1rem" }}>
            <label style={{ fontSize: "0.75rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 10 }}>Mode de workflow</label>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              {([
                { id: "tech_wow" as const, label: "🔬 Tech Wow", desc: "IA avancée vulgarisée (≤600 mots)" },
                { id: "interactive" as const, label: "🔍 Interactif", desc: "Rechercher → Choisir → Générer" },
                { id: "custom" as const, label: "🧠 Orchestrateur IA", desc: "L'IA adapte le pipeline" },
                { id: "auto" as const, label: "🤖 Automatique", desc: "L'IA fait tout" },
              ]).map(m => (
                <button key={m.id}
                  className={`btn ${mode === m.id ? "btn-primary" : "btn-outline"}`}
                  onClick={() => setMode(m.id)}
                  style={{ flex: 1, minWidth: 160, flexDirection: "column", padding: "0.75rem", alignItems: "flex-start", textAlign: "left" }}
                >
                  <span style={{ fontWeight: 600 }}>{m.label}</span>
                  <span style={{ fontSize: "0.7rem", opacity: 0.7, marginTop: 2 }}>{m.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Current agent config summary (informational) */}
          <div className="card" style={{ marginBottom: "1rem", background: "rgba(59,130,246,0.04)", borderColor: "rgba(59,130,246,0.15)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <p style={{ fontSize: "0.75rem", color: "var(--muted)", marginBottom: 6 }}>📋 Configuration actuelle des agents</p>
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  {agents.filter(a => a.enabled).map(a => (
                    <span key={a.id} className="badge badge-muted" style={{ fontSize: "0.625rem" }}>
                      {a.name.split(" ")[0]} {a.model.replace("gemini-", "").replace("-preview", "")}
                    </span>
                  ))}
                </div>
                {activeWriterMode && (
                  <p style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: 6 }}>
                    ✍️ Style actif : <strong style={{ color: "var(--primary)" }}>{activeWriterMode.name}</strong>
                  </p>
                )}
              </div>
              <a href="/agents" style={{ fontSize: "0.75rem", color: "var(--primary)", textDecoration: "none" }}>Modifier →</a>
            </div>
          </div>

          {/* Interactive config */}
          {mode === "interactive" && (
            <div className="card" style={{ marginBottom: "1rem" }}>
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ fontSize: "0.8125rem", color: "var(--muted)", display: "block", marginBottom: 8 }}>⏰ Récence</label>
                <div style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap" }}>
                  {RECENCY_OPTIONS.map(opt => (
                    <button key={opt.value} className={`btn ${recency === opt.value ? "btn-primary" : "btn-outline"}`}
                      onClick={() => setRecency(opt.value)} style={{ fontSize: "0.8125rem" }}
                    >{opt.icon} {opt.label}</button>
                  ))}
                </div>
              </div>
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ fontSize: "0.8125rem", color: "var(--muted)", display: "block", marginBottom: 8 }}>🏷️ Catégories</label>
                <div style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap" }}>
                  {CATEGORIES.map(cat => (
                    <button key={cat} className={`btn ${categories.includes(cat) ? "btn-primary" : "btn-outline"}`}
                      onClick={() => toggleCategory(cat)} style={{ fontSize: "0.8125rem", textTransform: "capitalize" }}
                    >{cat}</button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ fontSize: "0.8125rem", color: "var(--muted)", display: "block", marginBottom: 8 }}>💬 Thématique optionnelle</label>
                <input value={customTopic} onChange={e => setCustomTopic(e.target.value)} placeholder="Ex: l'IA dans la santé..." />
              </div>
            </div>
          )}

          {/* Custom/Orchestrator config */}
          {mode === "custom" && (
            <div className="card" style={{ marginBottom: "1rem" }}>
              <label style={{ fontSize: "0.8125rem", color: "var(--muted)", display: "block", marginBottom: 8 }}>
                🧠 Instruction pour l&apos;orchestrateur
              </label>
              <textarea
                value={customTopic} onChange={e => setCustomTopic(e.target.value)}
                placeholder="Ex: Écris un post sur l'impact de l'IA sur le recrutement, avec un ton provocateur et des chiffres récents..."
                style={{ minHeight: 100 }}
              />
              <div style={{ background: "rgba(59,130,246,0.08)", borderRadius: 8, padding: "0.75rem", marginTop: 10 }}>
                <p style={{ fontSize: "0.8125rem", color: "var(--primary)", fontWeight: 500, marginBottom: 4 }}>🧠 Comment fonctionne l&apos;orchestrateur ?</p>
                <p style={{ fontSize: "0.75rem", color: "var(--muted)", lineHeight: 1.5 }}>
                  L&apos;orchestrateur IA analyse votre instruction et décide automatiquement :<br/>
                  • Quelles étapes activer (recherche, approfondissement, synthèse)<br/>
                  • Comment adapter <strong>temporairement</strong> les prompts de chaque agent<br/>
                  • Le ton et l&apos;angle à prendre<br/>
                  Vous verrez en détail les adaptations faites après la génération.
                </p>
              </div>
            </div>
          )}

          {/* Images checkbox */}
          {mode !== "tech_wow" && (
          <div className="card" style={{ marginBottom: "1rem" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", fontSize: "0.875rem" }}>
              <input type="checkbox" checked={includeImages} onChange={e => setIncludeImages(e.target.checked)} />
              🖼️ Suggérer des images (expérimental)
            </label>
          </div>
          )}

          {/* Advanced overrides (collapsed) */}
          <div className="card" style={{ marginBottom: "1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              <span style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>⚙️ Options avancées (override ponctuel)</span>
              <span style={{ fontSize: "0.7rem", color: "var(--muted)" }}>{showAdvanced ? "▲" : "▼"}</span>
            </div>
            {showAdvanced && (
              <div style={{ marginTop: "0.75rem", paddingTop: "0.75rem", borderTop: "1px solid var(--card-border)" }}>
                <p style={{ fontSize: "0.6875rem", color: "var(--muted)", marginBottom: 10, fontStyle: "italic" }}>
                  Ces options forcent un modèle ou un style ponctuellement, sans modifier la configuration de vos agents.
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <div>
                    <label style={{ fontSize: "0.75rem", color: "var(--muted)", display: "block", marginBottom: 4 }}>🧠 Forcer un modèle</label>
                    <select value={overrideModel} onChange={e => setOverrideModel(e.target.value)}>
                      <option value="">Par défaut (modèle de chaque agent)</option>
                      {models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: "0.75rem", color: "var(--muted)", display: "block", marginBottom: 4 }}>✍️ Forcer un style</label>
                    <select value={overrideWriterMode} onChange={e => setOverrideWriterMode(e.target.value)}>
                      <option value="">Par défaut (mode actif du rédacteur{activeWriterMode ? ` : ${activeWriterMode.name}` : ""})</option>
                      {writerModes.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Launch */}
          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
            {mode === "tech_wow" && (
              <button className="btn btn-success" onClick={launchTechWow} style={{ padding: "0.75rem 2rem", fontSize: "1rem" }}>
                🔬 Lancer Tech Wow
              </button>
            )}
            {mode === "auto" && (
              <button className="btn btn-success" onClick={launchAuto} style={{ padding: "0.75rem 2rem", fontSize: "1rem" }}>
                🤖 Lancer le workflow automatique
              </button>
            )}
            {mode === "interactive" && (
              <button className="btn btn-primary" onClick={launchResearch} style={{ padding: "0.75rem 2rem", fontSize: "1rem" }}>
                🔍 Rechercher des sujets
              </button>
            )}
            {mode === "custom" && (
              <button className="btn btn-primary" onClick={launchOrchestrator} disabled={!customTopic.trim() || customTopic.length < 5}
                style={{ padding: "0.75rem 2rem", fontSize: "1rem" }}
              >🧠 Lancer l&apos;orchestrateur</button>
            )}
          </div>

          {mode === "tech_wow" && (
            <div className="card" style={{ marginTop: "1.5rem", borderColor: "rgba(16,185,129,0.3)" }}>
              <p style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--success)", marginBottom: 6 }}>🔬 Mode Tech Wow — Comment ça marche ?</p>
              <p style={{ fontSize: "0.8125rem", color: "var(--muted)", lineHeight: 1.6, marginBottom: 8 }}>
                Ce workflow cherche des <strong>techniques ultra avancées en IA générative</strong>, sélectionne la plus impressionnante et vulgarisable, puis rédige un post court (≤600 mots) qui crée l&apos;effet &quot;wow&quot;.
              </p>
              <p style={{ fontSize: "0.75rem", color: "var(--muted)", lineHeight: 1.5 }}>
                🎯 Cible : non-développeurs impressionnés + devs curieux<br/>
                ⏰ Ce mode tourne <strong>automatiquement chaque jour</strong> via le cron Vercel<br/>
                📦 Il maintient un buffer de <strong>5 posts en attente</strong> en permanence
              </p>
            </div>
          )}

          {mode === "auto" && (
            <div className="card" style={{ marginTop: "1.5rem", opacity: 0.7 }}>
              <p style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>
                💡 <strong>Mode autonome Vercel :</strong> Ce workflow se déclenche aussi automatiquement via Vercel Cron (même PC éteint).
              </p>
            </div>
          )}
        </>
      )}

      {/* ═════════ RESEARCHING ═════════ */}
      {step === "researching" && (
        <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
          <div className="loader" style={{ margin: "0 auto 1rem" }} />
          <p style={{ fontWeight: 600 }}>🔍 Recherche en cours...</p>
          <p style={{ fontSize: "0.8125rem", color: "var(--muted)", marginTop: 8 }}>L&apos;agent explore le web pour trouver les meilleurs sujets</p>
        </div>
      )}

      {/* ═════════ TOPICS ═════════ */}
      {step === "topics" && (
        <>
          <div style={{ marginBottom: "1rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ fontWeight: 600 }}>💡 Sujets trouvés — cliquez pour générer</h2>
            <button className="btn btn-outline" onClick={launchResearch} style={{ fontSize: "0.8125rem" }}>🔄 Relancer</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "1.5rem" }}>
            {topics.map((topic, i) => (
              <button key={i} className="card" onClick={() => generatePost(topic)}
                style={{ cursor: "pointer", border: "1px solid var(--card-border)", textAlign: "left", transition: "all 0.2s", width: "100%" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--primary)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--card-border)"; e.currentTarget.style.transform = "none"; }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                  <h3 style={{ fontWeight: 600, fontSize: "0.9375rem", flex: 1, lineHeight: 1.3 }}>{topic.title}</h3>
                  <span className={`badge ${topic.recency === "recent" ? "badge-danger" : topic.recency === "trending" ? "badge-warning" : "badge-info"}`}
                    style={{ marginLeft: 8, flexShrink: 0 }}>{topic.recency}</span>
                </div>
                <p style={{ fontSize: "0.8125rem", color: "var(--muted)", marginBottom: 8, lineHeight: 1.5 }}>{topic.description}</p>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span className="badge badge-muted" style={{ textTransform: "capitalize" }}>{topic.category}</span>
                  <span style={{ fontSize: "0.75rem", color: "var(--primary)", fontWeight: 500 }}>Générer →</span>
                </div>
                {topic.angle && <p style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: 6, fontStyle: "italic" }}>💡 {topic.angle}</p>}
              </button>
            ))}
          </div>
          {topics.length === 0 && (
            <div className="card" style={{ textAlign: "center", padding: "2rem" }}>
              <p style={{ color: "var(--muted)" }}>Aucun sujet trouvé. Réessayez avec d&apos;autres paramètres.</p>
            </div>
          )}
        </>
      )}

      {/* ═════════ GENERATING ═════════ */}
      {step === "generating" && (
        <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
          <div className="loader" style={{ margin: "0 auto 1rem" }} />
          <p style={{ fontWeight: 600 }}>✍️ Génération en cours...</p>
          {selectedTopic && <p style={{ fontSize: "0.8125rem", color: "var(--muted)", marginTop: 8 }}>Sujet : {selectedTopic.title}</p>}
          {mode === "custom" && <p style={{ fontSize: "0.8125rem", color: "var(--primary)", marginTop: 8 }}>🧠 L&apos;orchestrateur adapte le pipeline...</p>}
          <div style={{ display: "flex", justifyContent: "center", gap: "1.5rem", marginTop: "1.5rem" }}>
            {(mode === "custom" ? ["🧠 Orchestrateur", "📚 Recherche", "🧩 Synthèse", "✍️ Rédaction"] : ["📚 Recherche", "🧩 Synthèse", "✍️ Rédaction"]).map((label, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <div className="step-dot running" />
                <span style={{ fontSize: "0.7rem", color: "var(--muted)" }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═════════ RESULT ═════════ */}
      {step === "result" && post && (
        <>
          {/* Orchestrator decision panel */}
          {result?.orchestratorDecision && (
            <div className="card" style={{ marginBottom: "1rem", borderColor: "rgba(59,130,246,0.3)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
                <span style={{ fontSize: "1.25rem" }}>🧠</span>
                <h3 style={{ fontWeight: 600 }}>Décisions de l&apos;orchestrateur</h3>
              </div>

              {/* Reasoning */}
              <div style={{ background: "rgba(59,130,246,0.06)", borderRadius: 8, padding: "0.75rem", marginBottom: "0.75rem" }}>
                <p style={{ fontSize: "0.75rem", color: "var(--primary)", fontWeight: 600, marginBottom: 4 }}>💡 Raisonnement</p>
                <p style={{ fontSize: "0.8125rem", color: "var(--foreground)", lineHeight: 1.5 }}>
                  {result.orchestratorDecision.reasoning}
                </p>
              </div>

              {/* Pipeline decisions */}
              <div style={{ marginBottom: "0.75rem" }}>
                <p style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 600, marginBottom: 6 }}>📋 Pipeline activé</p>
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  {[
                    { label: "🔍 Recherche", active: result.orchestratorDecision.needsResearch },
                    { label: "📚 Approfondissement", active: result.orchestratorDecision.needsDeepResearch },
                    { label: "🧩 Synthèse", active: result.orchestratorDecision.needsSynthesis },
                    { label: "✍️ Rédaction", active: true },
                  ].map((s, i) => (
                    <span key={i} className={`badge ${s.active ? "badge-success" : "badge-muted"}`} style={{ fontSize: "0.75rem" }}>
                      {s.active ? "✅" : "⏭️"} {s.label}
                    </span>
                  ))}
                </div>
              </div>

              {/* Prompt tweaks — FULL DISPLAY */}
              {result.orchestratorDecision.promptTweaks && Object.entries(result.orchestratorDecision.promptTweaks).some(([, v]) => v) && (
                <div>
                  <p style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 600, marginBottom: 6 }}>🔧 Instructions injectées dans chaque agent (temporaires)</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    {Object.entries(result.orchestratorDecision.promptTweaks).filter(([, v]) => v).map(([role, tweak]) => {
                      const roleNames: Record<string, string> = {
                        researcher: "🔍 Chercheur",
                        deep_researcher: "📚 Approfondissement",
                        synthesizer: "🧩 Synthétiseur",
                        writer: "✍️ Rédacteur",
                      };
                      return (
                        <div key={role} style={{ background: "var(--background)", borderRadius: 8, padding: "0.625rem", border: "1px solid var(--card-border)" }}>
                          <p style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--primary)", marginBottom: 4 }}>
                            {roleNames[role] || role}
                          </p>
                          <p style={{ fontSize: "0.75rem", color: "var(--muted)", whiteSpace: "pre-wrap", lineHeight: 1.4 }}>
                            &quot;{tweak}&quot;
                          </p>
                        </div>
                      );
                    })}
                  </div>
                  <p style={{ fontSize: "0.6875rem", color: "var(--muted)", marginTop: 8, fontStyle: "italic" }}>
                    Ces instructions ont été ajoutées temporairement par l&apos;orchestrateur pour ce run uniquement. Vos prompts d&apos;agents n&apos;ont pas été modifiés.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Generated post with editor + preview */}
          <div className="card" style={{ marginBottom: "1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h2 style={{ fontWeight: 600 }}>✍️ Post généré</h2>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                {post.scheduledAt && (
                  <span className="badge badge-info" style={{ fontSize: "0.6875rem" }}>
                    📅 {new Date(post.scheduledAt).toLocaleString("fr-FR")}
                  </span>
                )}
                <span className={`badge ${post.status === "published" ? "badge-success" : post.status === "approved" ? "badge-info" : "badge-warning"}`}>
                  {post.status === "published" ? "✅ Publié" : post.status === "approved" ? "⏰ Programmé" : "⏳ En attente"}
                </span>
              </div>
            </div>

            {/* Toggle edit/preview */}
            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem" }}>
              <button className={`btn ${!showPreview ? "btn-primary" : "btn-outline"}`} onClick={() => setShowPreview(false)} style={{ fontSize: "0.75rem", padding: "0.25rem 0.75rem" }}>
                ✏️ Éditeur
              </button>
              <button className={`btn ${showPreview ? "btn-primary" : "btn-outline"}`} onClick={() => setShowPreview(true)} style={{ fontSize: "0.75rem", padding: "0.25rem 0.75rem" }}>
                👁️ Rendu LinkedIn
              </button>
            </div>

            {showPreview ? (
              <div style={{ background: "var(--background)", borderRadius: 8, padding: "1rem", whiteSpace: "pre-wrap", fontSize: "0.9375rem", lineHeight: 1.7, minHeight: 200, border: "1px solid var(--card-border)" }}>
                {formatPreview(editContent)}
              </div>
            ) : (
              <textarea value={editContent} onChange={e => setEditContent(e.target.value)}
                style={{ minHeight: 280, fontFamily: "system-ui", lineHeight: 1.7, fontSize: "0.9375rem" }}
              />
            )}

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, flexWrap: "wrap", gap: 4 }}>
              <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                {editContent.length} caractères {editContent.length > 3000 ? "⚠️ Long" : editContent.length < 500 ? "✨ Court" : "👍 Idéal"}
              </span>
              <span style={{ fontSize: "0.6875rem", color: "var(--muted)" }}>
                💡 **gras**, *italique* → conversion Unicode auto à la publication
              </span>
            </div>
          </div>

          {/* Revision zone */}
          {post.status !== "published" && (
            <div className="card" style={{ marginBottom: "1rem" }}>
              <h3 style={{ fontWeight: 600, marginBottom: "0.5rem", fontSize: "0.9375rem" }}>🔄 Demander une modification</h3>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <input value={revisionText} onChange={e => setRevisionText(e.target.value)}
                  placeholder="Ex: Rends le plus court, ajoute des chiffres, change le ton..."
                  style={{ flex: 1 }}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleRevise(); } }}
                />
                <button className="btn btn-primary" onClick={handleRevise} disabled={revising || !revisionText.trim()}
                  style={{ whiteSpace: "nowrap" }}
                >
                  {revising ? "⏳ Révision..." : "🔄 Réviser"}
                </button>
              </div>
              <div style={{ display: "flex", gap: "0.375rem", marginTop: 8, flexWrap: "wrap" }}>
                {["Plus court", "Plus agressif", "Ajoute des chiffres", "Ton storytelling", "Plus de hashtags", "Simplifie le vocabulaire"].map(suggestion => (
                  <button key={suggestion} className="btn btn-outline"
                    onClick={() => setRevisionText(suggestion)}
                    style={{ fontSize: "0.6875rem", padding: "0.25rem 0.5rem" }}
                  >{suggestion}</button>
                ))}
              </div>
            </div>
          )}

          {/* Image suggestions */}
          {post.imageSuggestions && post.imageSuggestions.length > 0 && (
            <div className="card" style={{ marginBottom: "1rem" }}>
              <h3 style={{ fontWeight: 600, marginBottom: "0.75rem" }}>🖼️ Images suggérées</h3>
              <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                {post.imageSuggestions.map((url, i) => (
                  <div key={i} style={{ position: "relative", borderRadius: 8, overflow: "hidden",
                    border: post.imageUrl === url ? "3px solid var(--primary)" : "1px solid var(--card-border)",
                    cursor: "pointer", width: 160, height: 110 }}
                    onClick={() => setPost({ ...post, imageUrl: post.imageUrl === url ? null : url })}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={`Suggestion ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; (e.target as HTMLImageElement).parentElement!.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;background:var(--card);color:var(--muted);font-size:0.75rem;">Image ${i + 1}</div>`; }}
                    />
                    {post.imageUrl === url && (
                      <div style={{ position: "absolute", top: 4, right: 4, background: "var(--primary)", borderRadius: "50%", width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem" }}>✓</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Workflow steps detail */}
          {result?.steps && result.steps.length > 0 && (
            <div className="card" style={{ marginBottom: "1rem" }}>
              <h3 style={{ fontWeight: 600, marginBottom: "0.75rem" }}>📊 Pipeline d&apos;exécution</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {result.steps.map((s, i) => (
                  <div key={i}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", cursor: "pointer", padding: "0.5rem", borderRadius: 8, background: expandedStep === i ? "rgba(59,130,246,0.06)" : "transparent" }}
                      onClick={() => setExpandedStep(expandedStep === i ? null : i)}
                    >
                      <div className={`step-dot ${s.status}`} />
                      <span style={{ fontSize: "0.875rem", flex: 1 }}>{s.agentName}</span>
                      <span className={`badge badge-${s.status === "completed" ? "success" : s.status === "failed" ? "danger" : "muted"}`}>{s.status === "completed" ? "✅" : s.status === "failed" ? "❌" : "⏳"}</span>
                      <span style={{ fontSize: "0.7rem", color: "var(--muted)" }}>{expandedStep === i ? "▲" : "▼"}</span>
                    </div>
                    {expandedStep === i && s.output && (
                      <div style={{ marginLeft: "2rem", marginTop: "0.5rem", padding: "0.75rem", background: "var(--background)", borderRadius: 8, border: "1px solid var(--card-border)", fontSize: "0.8125rem", color: "var(--muted)", whiteSpace: "pre-wrap", maxHeight: 300, overflow: "auto", lineHeight: 1.5 }}>
                        {s.output}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions: Publish / Schedule / Save */}
          {post.status !== "published" && (
            <div className="card" style={{ marginBottom: "1rem" }}>
              <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", flexWrap: "wrap" }}>
                <button className="btn btn-success" onClick={publishPost} style={{ padding: "0.75rem 1.5rem" }}>
                  📤 Publier maintenant
                </button>
                <button className="btn btn-primary" onClick={() => setShowScheduler(!showScheduler)} style={{ padding: "0.75rem 1.5rem" }}>
                  📅 Programmer
                </button>
                <button className="btn btn-outline" onClick={savePost} style={{ padding: "0.75rem 1.5rem" }}>
                  💾 Sauvegarder
                </button>
              </div>

              {/* Scheduling panel */}
              {showScheduler && (
                <div style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid var(--card-border)" }}>
                  <h4 style={{ fontWeight: 600, marginBottom: "0.75rem", fontSize: "0.9375rem" }}>📅 Programmer la publication</h4>
                  <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-end", flexWrap: "wrap" }}>
                    <div>
                      <label style={{ fontSize: "0.75rem", color: "var(--muted)", display: "block", marginBottom: 4 }}>Date</label>
                      <input type="date" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)}
                        min={new Date().toISOString().split("T")[0]}
                        style={{ width: 170 }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: "0.75rem", color: "var(--muted)", display: "block", marginBottom: 4 }}>Heure</label>
                      <input type="time" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)} style={{ width: 120 }} />
                    </div>
                    <button className="btn btn-success" onClick={handleSchedule} disabled={scheduling || !scheduleDate}
                      style={{ whiteSpace: "nowrap" }}
                    >
                      {scheduling ? "⏳..." : "✅ Confirmer la programmation"}
                    </button>
                  </div>
                  <p style={{ fontSize: "0.6875rem", color: "var(--muted)", marginTop: 8 }}>
                    Le post sera publié automatiquement via le cron Vercel à l&apos;heure prévue (fuseau : Europe/Paris).
                  </p>
                </div>
              )}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "center" }}>
            <button className="btn btn-outline" onClick={reset} style={{ padding: "0.75rem 1.5rem" }}>🔄 Nouveau workflow</button>
          </div>
        </>
      )}

      {/* ═════════ HISTORY ═════════ */}
      {showHistory && (
        <div style={{ marginTop: "2rem" }}>
          <h2 style={{ fontWeight: 600, marginBottom: "1rem" }}>📜 Historique</h2>
          {history.length === 0 ? <p style={{ color: "var(--muted)" }}>Aucun workflow exécuté</p> : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {history.map(run => (
                <div key={run.id} className="card" style={{ padding: "1rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                      <span className={`badge ${run.status === "completed" ? "badge-success" : run.status === "failed" ? "badge-danger" : "badge-warning"}`}>{run.status}</span>
                      <span style={{ fontSize: "0.8125rem", color: "var(--muted)" }}>{run.mode === "auto" ? "🤖 Auto" : run.mode === "custom_topic" ? "🧠 Orchestrateur" : "🔍 Interactif"}</span>
                      {run.orchestratorDecision && <span className="badge badge-info" style={{ fontSize: "0.625rem" }}>🔧 Prompts adaptés</span>}
                    </div>
                    <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>{new Date(run.startedAt).toLocaleString("fr-FR")}</span>
                  </div>
                  {run.steps.length > 0 && (
                    <div style={{ display: "flex", gap: "0.5rem", marginTop: 8 }}>
                      {run.steps.map((s, i) => <div key={i} className={`step-dot ${s.status}`} title={s.agentName} />)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
