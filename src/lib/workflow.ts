// src/lib/workflow.ts
// Multi-agent workflow orchestrator with interactive + auto + revision modes
import { generateContent, generateWithSearch, findImageSuggestions } from "./gemini";
import { publishToLinkedIn } from "./linkedin";
import { readCollection, addToCollection, updateInCollection } from "./db";
import { formatForLinkedIn } from "./unicode";
import type {
  Agent, Post, Topic, Settings, WorkflowRun, WorkflowStep, AgentLog,
  TopicSuggestion, ResearchConfig, OrchestratorDecision,
} from "./types";
import { seedDefaults } from "./seed";

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function getSettings(): Settings {
  seedDefaults();
  const settings = readCollection<Settings>("settings");
  return settings[0];
}

function getAgent(role: string): Agent | null {
  seedDefaults();
  const agents = readCollection<Agent>("agents");
  const agent = agents.find((a) => a.role === role && a.enabled);
  if (!agent) return null;
  if (agent.promptModes && agent.promptModes.length > 0 && agent.activePromptModeId) {
    const activeMode = agent.promptModes.find((m) => m.id === agent.activePromptModeId);
    if (activeMode) agent.prompt = activeMode.prompt;
  }
  return agent;
}

// Inject the global prompt context into an agent's prompt
function injectGlobalPrompt(agentPrompt: string, settings: Settings): string {
  if (!settings.globalPrompt?.trim()) return agentPrompt;
  return `${agentPrompt}\n\n[CONTEXTE GLOBAL DE L'UTILISATEUR]\nTu fais partie d'un système agentique multi-agents. Voici les instructions générales de l'utilisateur. Respecte-les tout en restant dans ton propre cadre et rôle :\n${settings.globalPrompt}`;
}

function getRecentTopics(limit = 20): Topic[] {
  return readCollection<Topic>("topics")
    .filter((t) => t.status === "used" || t.status === "approved")
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);
}

function recencyToLabel(recency: string): string {
  switch (recency) {
    case "today": return "des dernières 24 heures";
    case "3days": return "des 3 derniers jours";
    case "week": return "de la dernière semaine";
    case "month": return "du dernier mois";
    default: return "récents ou intemporels";
  }
}

function makeEmptyRun(mode: string): WorkflowRun {
  return {
    id: generateId(),
    mode: mode as WorkflowRun["mode"],
    status: "running",
    currentStep: "",
    steps: [],
    topicSuggestions: [],
    orchestratorDecision: null,
    postId: null,
    topicId: null,
    startedAt: new Date().toISOString(),
    completedAt: null,
    error: null,
  };
}

// ─────────────────────────────────────────────
// STEP 1: Research topics
// ─────────────────────────────────────────────
export async function stepResearch(config: ResearchConfig): Promise<{
  workflowId: string;
  topics: TopicSuggestion[];
}> {
  const agent = getAgent("researcher");
  if (!agent) throw new Error("Agent Chercheur non trouvé ou désactivé");
  const settings = getSettings();

  const workflowRun = makeEmptyRun(config.customTopic ? "custom_topic" : "interactive");
  workflowRun.status = "waiting_topic_selection";
  workflowRun.currentStep = "researcher";
  workflowRun.steps = [{
    agentId: agent.id,
    agentName: agent.name,
    status: "running",
    input: "",
    output: "",
    startedAt: new Date().toISOString(),
    completedAt: null,
  }];
  addToCollection("workflow_runs", workflowRun);

  try {
    let input = "";
    if (config.customTopic) {
      input = `L'utilisateur souhaite parler de : "${config.customTopic}"
Recherche les informations les plus pertinentes et récentes sur ce sujet.
Propose ${config.maxSuggestions || 4} angles différents pour en parler sur LinkedIn.
Filtre temporel : cherche des infos ${recencyToLabel(config.recency)}.
Catégories : ${config.categories.length > 0 ? config.categories.join(", ") : "toutes"}.`;
    } else {
      input = `Recherche des sujets ${recencyToLabel(config.recency)}.
Catégories privilégiées : ${config.categories.length > 0 ? config.categories.join(", ") : settings.topicPreferences.categories.join(", ")}.
Instructions supplémentaires : ${settings.topicPreferences.customInstructions}
Propose ${config.maxSuggestions || 4} sujets.`;
    }

    const recentTopics = getRecentTopics(10);
    if (recentTopics.length > 0) {
      input += `\n\nSujets déjà traités récemment (ÉVITER) :\n${recentTopics.map(t => `- ${t.title}`).join("\n")}`;
    }

    const model = config.model || agent.model;
    const agentPrompt = injectGlobalPrompt(agent.prompt, settings);
    const result = await generateWithSearch(`${agentPrompt}\n\n${input}`, model);

    let topics: TopicSuggestion[] = [];
    try {
      const cleaned = result.text.replace(/```json\n?|\n?```/g, "").trim();
      const parsed = JSON.parse(cleaned);
      topics = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      topics = [{
        title: config.customTopic || "Sujet suggéré",
        description: result.text.slice(0, 500),
        angle: "Analyse approfondie",
        category: config.categories[0] || "tech",
        recency: config.recency === "today" ? "recent" : "trending",
      }];
    }

    workflowRun.steps[0].status = "completed";
    workflowRun.steps[0].input = input.slice(0, 2000);
    workflowRun.steps[0].output = result.text.slice(0, 5000);
    workflowRun.steps[0].completedAt = new Date().toISOString();
    workflowRun.topicSuggestions = topics;
    updateInCollection("workflow_runs", workflowRun.id, workflowRun);

    return { workflowId: workflowRun.id, topics };
  } catch (error) {
    workflowRun.status = "failed";
    workflowRun.error = error instanceof Error ? error.message : String(error);
    workflowRun.steps[0].status = "failed";
    updateInCollection("workflow_runs", workflowRun.id, workflowRun);
    throw error;
  }
}

// ─────────────────────────────────────────────
// STEP 2: Generate post from selected topic
// ─────────────────────────────────────────────
export async function stepGenerate(options: {
  workflowId: string;
  selectedTopic: TopicSuggestion;
  model?: string;
  promptModeId?: string;
  includeImages?: boolean;
}): Promise<WorkflowRun> {
  const settings = getSettings();
  const model = options.model || settings.globalModel || "gemini-2.0-flash";
  const runs = readCollection<WorkflowRun>("workflow_runs");
  const workflowRun = runs.find((r) => r.id === options.workflowId);
  if (!workflowRun) throw new Error("Workflow non trouvé");

  workflowRun.status = "running";
  workflowRun.currentStep = "deep_researcher";

  const topic: Topic = {
    id: generateId(),
    title: options.selectedTopic.title,
    description: options.selectedTopic.description,
    sources: [],
    category: options.selectedTopic.category || "other",
    recency: (options.selectedTopic.recency as Topic["recency"]) || "recent",
    status: "used",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  addToCollection("topics", topic);
  workflowRun.topicId = topic.id;

  const agentLogs: AgentLog[] = [];
  const topicText = `${options.selectedTopic.title}\n${options.selectedTopic.description}\nAngle: ${options.selectedTopic.angle}`;

  // ─── Deep Research ───
  const deepResearcher = getAgent("deep_researcher");
  let deepResearch = "";
  if (deepResearcher) {
    const step: WorkflowStep = {
      agentId: deepResearcher.id, agentName: deepResearcher.name,
      status: "running", input: topicText.slice(0, 2000), output: "",
      startedAt: new Date().toISOString(), completedAt: null,
    };
    workflowRun.steps.push(step);
    updateInCollection("workflow_runs", workflowRun.id, workflowRun);

    const result = await generateWithSearch(`${injectGlobalPrompt(deepResearcher.prompt, settings)}\n\nSujet à approfondir :\n${topicText}`, model);
    deepResearch = result.text;
    step.output = deepResearch.slice(0, 5000);
    step.status = "completed";
    step.completedAt = new Date().toISOString();
    agentLogs.push({ agentId: deepResearcher.id, agentName: deepResearcher.name, input: topicText.slice(0, 2000), output: deepResearch.slice(0, 5000), timestamp: new Date().toISOString() });
    updateInCollection("workflow_runs", workflowRun.id, workflowRun);
  }

  // ─── Synthesize ───
  workflowRun.currentStep = "synthesizer";
  const synthesizer = getAgent("synthesizer");
  let synthesis = "";
  if (synthesizer) {
    const input = `Sujet choisi :\n${topicText}\n\nRecherches approfondies :\n${deepResearch}\n\nTon souhaité : ${settings.defaultTone}`;
    const step: WorkflowStep = {
      agentId: synthesizer.id, agentName: synthesizer.name,
      status: "running", input: input.slice(0, 2000), output: "",
      startedAt: new Date().toISOString(), completedAt: null,
    };
    workflowRun.steps.push(step);
    updateInCollection("workflow_runs", workflowRun.id, workflowRun);

    synthesis = await generateContent(`${injectGlobalPrompt(synthesizer.prompt, settings)}\n\n${input}`, model);
    step.output = synthesis.slice(0, 5000);
    step.status = "completed";
    step.completedAt = new Date().toISOString();
    agentLogs.push({ agentId: synthesizer.id, agentName: synthesizer.name, input: input.slice(0, 2000), output: synthesis.slice(0, 5000), timestamp: new Date().toISOString() });
    updateInCollection("workflow_runs", workflowRun.id, workflowRun);
  }

  // ─── Write ───
  workflowRun.currentStep = "writer";
  const writer = getAgent("writer");
  let finalPost = "";
  if (writer) {
    let writerPrompt = writer.prompt;
    if (options.promptModeId && writer.promptModes?.length > 0) {
      const mode = writer.promptModes.find((m) => m.id === options.promptModeId);
      if (mode) writerPrompt = mode.prompt;
    }
    writerPrompt = writerPrompt.replace("{tone}", settings.defaultTone);
    writerPrompt = injectGlobalPrompt(writerPrompt, settings);

    const input = `Brief de rédaction :\n${synthesis}\n\nRecherches :\n${deepResearch}\n\nSujet :\n${topicText}`;
    const step: WorkflowStep = {
      agentId: writer.id, agentName: writer.name,
      status: "running", input: input.slice(0, 2000), output: "",
      startedAt: new Date().toISOString(), completedAt: null,
    };
    workflowRun.steps.push(step);
    updateInCollection("workflow_runs", workflowRun.id, workflowRun);

    finalPost = await generateContent(`${writerPrompt}\n\n${input}`, model);
    step.output = finalPost.slice(0, 5000);
    step.status = "completed";
    step.completedAt = new Date().toISOString();
    agentLogs.push({ agentId: writer.id, agentName: writer.name, input: input.slice(0, 2000), output: finalPost.slice(0, 5000), timestamp: new Date().toISOString() });
    updateInCollection("workflow_runs", workflowRun.id, workflowRun);
  }

  // ─── Image suggestions ───
  let imageSuggestions: string[] = [];
  if (options.includeImages) {
    try { imageSuggestions = await findImageSuggestions(topicText, model); } catch { /* ignore */ }
  }

  // ─── Save post ───
  const post: Post = {
    id: generateId(),
    topicId: workflowRun.topicId,
    content: finalPost,
    status: settings.autoPublish ? "approved" : "pending_approval",
    tone: settings.defaultTone,
    linkedinPostId: null,
    imageUrl: null,
    imageSuggestions,
    agentLogs,
    scheduledAt: null,
    publishedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  addToCollection("posts", post);

  if (settings.autoPublish) {
    const formattedPost = formatForLinkedIn(finalPost);
    const result = await publishToLinkedIn(formattedPost);
    if (result.success) {
      updateInCollection<Post>("posts", post.id, { status: "published", linkedinPostId: result.id, publishedAt: new Date().toISOString() });
    }
  }

  workflowRun.postId = post.id;
  workflowRun.status = "completed";
  workflowRun.completedAt = new Date().toISOString();
  updateInCollection("workflow_runs", workflowRun.id, workflowRun);
  return workflowRun;
}

// ─────────────────────────────────────────────
// ORCHESTRATOR: AI decides pipeline + tweaks prompts
// ─────────────────────────────────────────────
export async function stepOrchestrate(options: {
  instruction: string;
  model?: string;
  promptModeId?: string;
  includeImages?: boolean;
}): Promise<WorkflowRun> {
  const settings = getSettings();
  const model = options.model || settings.globalModel || "gemini-2.0-flash";

  // ─── Step 1: Orchestrator decides pipeline AND tweaks prompts ───
  const orchestratorPrompt = `Tu es un orchestrateur de workflow LinkedIn intelligent.
L'utilisateur te donne une instruction. Tu dois :
1. Décider quelles étapes du pipeline sont nécessaires
2. Adapter temporairement les instructions des agents pour cette tâche spécifique

Instruction de l'utilisateur : "${options.instruction}"

Réponds UNIQUEMENT en JSON valide (pas de texte autour) :
{
  "needsResearch": true/false,
  "needsDeepResearch": true/false,
  "needsSynthesis": true/false,  
  "directToWriter": true/false,
  "topicTitle": "Le titre du sujet déduit",
  "topicDescription": "Description détaillée",
  "reasoning": "Explication courte de ta stratégie",
  "promptTweaks": {
    "researcher": "Instructions supplémentaires spécifiques pour le chercheur (ou chaîne vide si pas de modification)",
    "deep_researcher": "Instructions supplémentaires pour le chercheur approfondi (ou chaîne vide)",
    "synthesizer": "Instructions supplémentaires pour le synthétiseur (ou chaîne vide)",
    "writer": "Instructions supplémentaires pour le rédacteur (ou chaîne vide)"
  }
}

Exemples de promptTweaks :
- Si l'utilisateur veut parler d'un événement : researcher → "Concentre-toi sur les événements récents liés à..."
- Si l'utilisateur veut un ton humoristique : writer → "Adopte un ton léger et humoristique, avec des touches d'ironie"
- Si le sujet est très technique : deep_researcher → "Va dans le détail technique, cite des papers et benchmarks"`;

  const decisionText = await generateContent(orchestratorPrompt, model);
  let decision: OrchestratorDecision;
  try {
    decision = JSON.parse(decisionText.replace(/```json\n?|\n?```/g, "").trim());
  } catch {
    decision = {
      needsResearch: true, needsDeepResearch: true, needsSynthesis: true,
      directToWriter: false, topicTitle: options.instruction,
      topicDescription: options.instruction, reasoning: "Fallback: pipeline complet",
      promptTweaks: {},
    };
  }

  const selectedTopic: TopicSuggestion = {
    title: decision.topicTitle || options.instruction,
    description: decision.topicDescription || options.instruction,
    angle: "Défini par l'orchestrateur",
    category: "custom",
    recency: "recent",
  };

  // Create workflow run with orchestrator decision visible
  const workflowRun = makeEmptyRun("custom_topic");
  workflowRun.orchestratorDecision = decision;
  workflowRun.topicSuggestions = [selectedTopic];
  workflowRun.currentStep = "orchestrator";
  workflowRun.steps = [{
    agentId: "orchestrator",
    agentName: "🧠 Orchestrateur",
    status: "completed",
    input: options.instruction,
    output: `🎯 Stratégie : ${decision.reasoning}\n\n📋 Pipeline : ${decision.needsResearch ? "✅ Recherche" : "⏭️ Recherche"} → ${decision.needsDeepResearch ? "✅ Approfondissement" : "⏭️ Approfondissement"} → ${decision.needsSynthesis ? "✅ Synthèse" : "⏭️ Synthèse"} → ✅ Rédaction\n\n${decision.promptTweaks && Object.values(decision.promptTweaks).some(v => v) ? "🔧 Prompts adaptés pour cette tâche" : "📝 Prompts standards"}`,
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
  }];
  addToCollection("workflow_runs", workflowRun);

  const agentLogs: AgentLog[] = [];
  let deepResearch = "";
  let synthesis = "";
  const tweaks = decision.promptTweaks || {};

  // Save topic
  const topic: Topic = {
    id: generateId(), title: selectedTopic.title, description: selectedTopic.description,
    sources: [], category: "custom", recency: "recent", status: "used",
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
  addToCollection("topics", topic);
  workflowRun.topicId = topic.id;
  const topicText = `${selectedTopic.title}\n${selectedTopic.description}`;

  // ─── Conditional: Research (with orchestrator tweak) ───
  if (decision.needsResearch) {
    workflowRun.currentStep = "researcher";
    const researcher = getAgent("researcher");
    if (researcher) {
      let prompt = injectGlobalPrompt(researcher.prompt, settings);
      if (tweaks.researcher) prompt += `\n\n[INSTRUCTIONS SPÉCIALES DE L'ORCHESTRATEUR]\n${tweaks.researcher}`;

      const step: WorkflowStep = {
        agentId: researcher.id, agentName: researcher.name + (tweaks.researcher ? " 🔧" : ""),
        status: "running", input: topicText, output: "",
        startedAt: new Date().toISOString(), completedAt: null,
      };
      workflowRun.steps.push(step);
      updateInCollection("workflow_runs", workflowRun.id, workflowRun);

      const result = await generateWithSearch(`${prompt}\n\nRecherche spécifiquement sur : ${topicText}`, model);
      step.output = result.text.slice(0, 5000);
      step.status = "completed";
      step.completedAt = new Date().toISOString();
      agentLogs.push({ agentId: researcher.id, agentName: researcher.name, input: topicText, output: result.text.slice(0, 5000), timestamp: new Date().toISOString() });
      updateInCollection("workflow_runs", workflowRun.id, workflowRun);
    }
  }

  // ─── Conditional: Deep Research (with orchestrator tweak) ───
  if (decision.needsDeepResearch) {
    workflowRun.currentStep = "deep_researcher";
    const deepResearcher = getAgent("deep_researcher");
    if (deepResearcher) {
      let prompt = injectGlobalPrompt(deepResearcher.prompt, settings);
      if (tweaks.deep_researcher) prompt += `\n\n[INSTRUCTIONS SPÉCIALES DE L'ORCHESTRATEUR]\n${tweaks.deep_researcher}`;

      const step: WorkflowStep = {
        agentId: deepResearcher.id, agentName: deepResearcher.name + (tweaks.deep_researcher ? " 🔧" : ""),
        status: "running", input: topicText, output: "",
        startedAt: new Date().toISOString(), completedAt: null,
      };
      workflowRun.steps.push(step);
      updateInCollection("workflow_runs", workflowRun.id, workflowRun);

      const result = await generateWithSearch(`${prompt}\n\nSujet à approfondir :\n${topicText}`, model);
      deepResearch = result.text;
      step.output = deepResearch.slice(0, 5000);
      step.status = "completed";
      step.completedAt = new Date().toISOString();
      agentLogs.push({ agentId: deepResearcher.id, agentName: deepResearcher.name, input: topicText, output: deepResearch.slice(0, 5000), timestamp: new Date().toISOString() });
      updateInCollection("workflow_runs", workflowRun.id, workflowRun);
    }
  }

  // ─── Conditional: Synthesis (with orchestrator tweak) ───
  if (decision.needsSynthesis) {
    workflowRun.currentStep = "synthesizer";
    const synthesizer = getAgent("synthesizer");
    if (synthesizer) {
      let prompt = injectGlobalPrompt(synthesizer.prompt, settings);
      if (tweaks.synthesizer) prompt += `\n\n[INSTRUCTIONS SPÉCIALES DE L'ORCHESTRATEUR]\n${tweaks.synthesizer}`;

      const input = `Sujet :\n${topicText}\n\nRecherches :\n${deepResearch}\n\nTon : ${settings.defaultTone}`;
      const step: WorkflowStep = {
        agentId: synthesizer.id, agentName: synthesizer.name + (tweaks.synthesizer ? " 🔧" : ""),
        status: "running", input: input.slice(0, 2000), output: "",
        startedAt: new Date().toISOString(), completedAt: null,
      };
      workflowRun.steps.push(step);
      updateInCollection("workflow_runs", workflowRun.id, workflowRun);

      synthesis = await generateContent(`${prompt}\n\n${input}`, model);
      step.output = synthesis.slice(0, 5000);
      step.status = "completed";
      step.completedAt = new Date().toISOString();
      agentLogs.push({ agentId: synthesizer.id, agentName: synthesizer.name, input: input.slice(0, 2000), output: synthesis.slice(0, 5000), timestamp: new Date().toISOString() });
      updateInCollection("workflow_runs", workflowRun.id, workflowRun);
    }
  }

  // ─── Always: Writer (with orchestrator tweak) ───
  workflowRun.currentStep = "writer";
  const writer = getAgent("writer");
  let finalPost = "";
  if (writer) {
    let writerPrompt = writer.prompt;
    if (options.promptModeId && writer.promptModes?.length > 0) {
      const mode = writer.promptModes.find((m) => m.id === options.promptModeId);
      if (mode) writerPrompt = mode.prompt;
    }
    writerPrompt = writerPrompt.replace("{tone}", settings.defaultTone);
    writerPrompt = injectGlobalPrompt(writerPrompt, settings);
    if (tweaks.writer) writerPrompt += `\n\n[INSTRUCTIONS SPÉCIALES DE L'ORCHESTRATEUR]\n${tweaks.writer}`;

    const input = decision.directToWriter
      ? `Rédige un post LinkedIn sur le sujet suivant. L'utilisateur veut parler de : "${options.instruction}"\n\nTon : ${settings.defaultTone}`
      : `Brief :\n${synthesis}\n\nRecherches :\n${deepResearch}\n\nSujet :\n${topicText}`;

    const step: WorkflowStep = {
      agentId: writer.id, agentName: writer.name + (tweaks.writer ? " 🔧" : ""),
      status: "running", input: input.slice(0, 2000), output: "",
      startedAt: new Date().toISOString(), completedAt: null,
    };
    workflowRun.steps.push(step);
    updateInCollection("workflow_runs", workflowRun.id, workflowRun);

    finalPost = await generateContent(`${writerPrompt}\n\n${input}`, model);
    step.output = finalPost.slice(0, 5000);
    step.status = "completed";
    step.completedAt = new Date().toISOString();
    agentLogs.push({ agentId: writer.id, agentName: writer.name, input: input.slice(0, 2000), output: finalPost.slice(0, 5000), timestamp: new Date().toISOString() });
    updateInCollection("workflow_runs", workflowRun.id, workflowRun);
  }

  // ─── Image suggestions ───
  let imageSuggestions: string[] = [];
  if (options.includeImages) {
    try { imageSuggestions = await findImageSuggestions(topicText, model); } catch { /* ignore */ }
  }

  // Save post
  const post: Post = {
    id: generateId(), topicId: workflowRun.topicId, content: finalPost,
    status: settings.autoPublish ? "approved" : "pending_approval",
    tone: settings.defaultTone, linkedinPostId: null, imageUrl: null, imageSuggestions,
    agentLogs, scheduledAt: null, publishedAt: null,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
  addToCollection("posts", post);

  if (settings.autoPublish) {
    const formattedPost = formatForLinkedIn(finalPost);
    const result = await publishToLinkedIn(formattedPost);
    if (result.success) {
      updateInCollection<Post>("posts", post.id, { status: "published", linkedinPostId: result.id, publishedAt: new Date().toISOString() });
    }
  }

  workflowRun.postId = post.id;
  workflowRun.status = "completed";
  workflowRun.completedAt = new Date().toISOString();
  updateInCollection("workflow_runs", workflowRun.id, workflowRun);
  return workflowRun;
}

// ─────────────────────────────────────────────
// REVISE: Re-generate a post with user feedback
// ─────────────────────────────────────────────
export async function revisePost(options: {
  postId: string;
  feedback: string;
  model?: string;
  promptModeId?: string;
}): Promise<{ postId: string; content: string }> {
  const settings = getSettings();
  const model = options.model || settings.globalModel || "gemini-2.0-flash";

  const posts = readCollection<Post>("posts");
  const originalPost = posts.find((p) => p.id === options.postId);
  if (!originalPost) throw new Error("Post non trouvé");

  const writer = getAgent("writer");
  if (!writer) throw new Error("Agent Rédacteur non trouvé");

  let writerPrompt = writer.prompt;
  if (options.promptModeId && writer.promptModes?.length > 0) {
    const mode = writer.promptModes.find((m) => m.id === options.promptModeId);
    if (mode) writerPrompt = mode.prompt;
  }
  writerPrompt = writerPrompt.replace("{tone}", settings.defaultTone);
  writerPrompt = injectGlobalPrompt(writerPrompt, settings);

  const revisionPrompt = `${writerPrompt}

Voici un post LinkedIn existant que l'utilisateur veut MODIFIER.

POST ORIGINAL :
---
${originalPost.content}
---

DEMANDE DE MODIFICATION DE L'UTILISATEUR :
"${options.feedback}"

Réécris le post en intégrant les modifications demandées. Garde le même sujet et les mêmes informations sauf indication contraire.

IMPORTANT : Fournis UNIQUEMENT le nouveau texte du post, prêt à publier.`;

  const newContent = await generateContent(revisionPrompt, model);

  updateInCollection<Post>("posts", originalPost.id, {
    content: newContent,
    status: "pending_approval",
    updatedAt: new Date().toISOString(),
  });

  return { postId: originalPost.id, content: newContent };
}

// ─────────────────────────────────────────────
// FULL AUTO: Complete autonomous workflow
// ─────────────────────────────────────────────
export async function runFullWorkflow(options?: {
  topicId?: string;
  customTopic?: string;
  model?: string;
}): Promise<WorkflowRun> {
  const settings = getSettings();
  const model = options?.model || settings.globalModel || "gemini-2.0-flash";

  if (options?.customTopic) {
    return stepOrchestrate({ instruction: options.customTopic, model });
  }

  const config: ResearchConfig = {
    recency: settings.topicPreferences.recency === "recent" ? "week" : "anytime",
    categories: settings.topicPreferences.categories,
    customTopic: "",
    maxSuggestions: 4,
    model,
  };

  const { workflowId, topics } = await stepResearch(config);
  const selectedTopic = topics[0] || {
    title: "Tendances tech", description: "Les dernières tendances technologiques",
    angle: "Analyse", category: "tech", recency: "recent",
  };

  return stepGenerate({ workflowId, selectedTopic, model, includeImages: false });
}

// ─────────────────────────────────────────────
// SCHEDULE POST
// ─────────────────────────────────────────────
export async function schedulePost(postId: string, scheduledAt: string): Promise<{ success: boolean; scheduledAt: string }> {
  const post = readCollection<Post>("posts").find((p) => p.id === postId);
  if (!post) throw new Error("Post not found");

  updateInCollection<Post>("posts", postId, {
    scheduledAt,
    status: "approved",
    updatedAt: new Date().toISOString(),
  });

  return { success: true, scheduledAt };
}

// ─────────────────────────────────────────────
// PUBLISH SCHEDULED POSTS (called by cron)
// ─────────────────────────────────────────────
export async function publishScheduledPosts(): Promise<{ published: number; errors: string[] }> {
  const now = new Date();
  const posts = readCollection<Post>("posts").filter(
    (p) => p.scheduledAt && (p.status === "approved" || p.status === "pending_approval") && new Date(p.scheduledAt) <= now
  );

  let published = 0;
  const errors: string[] = [];

  for (const post of posts) {
    const result = await publishPost(post.id);
    if (result.success) {
      published++;
    } else {
      errors.push(`${post.id}: ${result.error}`);
    }
  }

  return { published, errors };
}

// ─────────────────────────────────────────────
// PUBLISH POST
// ─────────────────────────────────────────────
export async function publishPost(postId: string): Promise<{ success: boolean; error?: string }> {
  const post = readCollection<Post>("posts").find((p) => p.id === postId);
  if (!post) return { success: false, error: "Post not found" };

  const formattedContent = formatForLinkedIn(post.content);
  const result = await publishToLinkedIn(formattedContent);
  if (result.success) {
    updateInCollection<Post>("posts", postId, {
      status: "published", linkedinPostId: result.id,
      publishedAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    });
    return { success: true };
  }

  updateInCollection<Post>("posts", postId, { status: "failed", updatedAt: new Date().toISOString() });
  return { success: false, error: result.error };
}

// ─────────────────────────────────────────────
// CRON HELPER
// ─────────────────────────────────────────────
export function shouldPublishToday(): boolean {
  const settings = getSettings();
  const now = new Date();
  const dayOfWeek = now.getDay();

  if (!settings.publishSchedule.days.includes(dayOfWeek)) return false;

  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const postsToday = readCollection<Post>("posts").filter(
    (p) => p.status === "published" && p.publishedAt && new Date(p.publishedAt) >= todayStart
  );

  // Max 1 post per day
  return postsToday.length === 0;
}

// ─────────────────────────────────────────────
// TECH WOW WORKFLOW
// Finds ultra-advanced AI techniques, picks the most
// wow-able one, and writes a short punchy post (≤600 words)
// ─────────────────────────────────────────────

const TECH_WOW_RESEARCH_PROMPT = `Tu es un veilleur expert en intelligence artificielle générative et en techniques de pointe.

Ton rôle : trouver 5 à 8 techniques ULTRA AVANCÉES dans le domaine de l'IA générative.

Ce qu'on cherche :
- Des techniques pointues, à la frontière de la recherche (ex: Mixture of Experts, Flash Attention, RLHF, DPO, LoRA, RAG avancé, Chain-of-Thought, Constitutional AI, Speculative Decoding, Ring Attention, KV-Cache optimization, Sparse Transformers, State Space Models, etc.)
- Pas forcément récentes mais ultra spécialisées et peu connues du grand public
- Toujours dans le domaine de l'IA GÉNÉRATIVE (LLMs, diffusion models, multimodal, etc.)
- Des techniques qui ont un vrai impact concret et mesurable

Pour chaque technique, fournis :
1. **title** : Le nom de la technique
2. **description** : 2-3 phrases expliquant la technique simplement
3. **angle** : Pourquoi c'est impressionnant / quel problème ça résout
4. **wowFactor** : Note de 1 à 10 sur l'effet "wow" pour un non-développeur
5. **vulgarizability** : Note de 1 à 10 sur la facilité à vulgariser
6. **selfContained** : Note de 1 à 10 — peut-on comprendre sans pré-requis techniques complexes ?

Formate en JSON :
[
  {
    "title": "...",
    "description": "...",
    "angle": "...",
    "category": "ai",
    "recency": "evergreen",
    "wowFactor": 8,
    "vulgarizability": 9,
    "selfContained": 7
  }
]`;

const TECH_WOW_SELECTOR_PROMPT = `Tu es un curateur de contenu LinkedIn spécialisé en IA.

Tu reçois une liste de techniques IA avancées avec des scores de "wow factor", "vulgarisabilité" et "autonomie de compréhension".

Ton rôle : sélectionner LE MEILLEUR sujet en maximisant :
1. L'effet "wow" — le lecteur doit se dire "ah ouais, c'est dingue !"
2. La vulgarisabilité — on doit pouvoir l'expliquer simplement en 600 mots max
3. L'autonomie — pas besoin de comprendre 10 concepts techniques avant
4. La nouveauté — éviter les sujets trop connus (exit GPT, ChatGPT, etc.)

Réponds en JSON :
{
  "selectedTopic": {
    "title": "...",
    "description": "...",
    "angle": "...",
    "reason": "Pourquoi ce sujet est le plus 'wow'"
  }
}`;

const TECH_WOW_WRITER_PROMPT = `Tu es un rédacteur LinkedIn qui vulgarise des techniques d'IA ultra avancées.

OBJECTIF : Créer l'effet "wow". Le lecteur (non-dev ou dev curieux) doit finir le post en se disant "ah ouais, c'est impressionnant ce qu'on peut faire".

RÈGLES STRICTES :
1. **MAX 600 MOTS** — pas un de plus. Sois concis.
2. **ZERO bullshit** — pas de phrases creuses, pas de "dans un monde en constante évolution", pas de buzzwords vides
3. **Accroche percutante** — la première phrase doit créer la curiosité
4. **Structure simple** :
   - Hook (1-2 lignes) : pose le décor, intrigue
   - Le concept (2-3 paragraphes courts) : qu'est-ce que cette technique ? Que permet-elle ?
   - Le "wow moment" : le truc qui impressionne, le résultat concret
   - Conclusion courte : pourquoi c'est important
5. **Langage accessible** — un non-développeur doit comprendre. Pas de maths, pas de code, pas de jargon non expliqué
6. **Exemples concrets** — montre ce que ça permet dans la vraie vie
7. **Format LinkedIn** : phrases courtes, sauts de ligne, aéré, lisible en 1-2 minutes
8. **Emojis** : 2-4 max, utilisés à bon escient
9. **Hashtags** : 3-4 à la fin (#IA #Tech #Innovation etc.)
10. **PAS de lien**
11. En FRANÇAIS

Le ton : passionné, pédagogue, direct. Comme si tu expliquais un truc dingue à un pote intelligent mais non-technique.

IMPORTANT : Fournis UNIQUEMENT le texte du post LinkedIn, prêt à publier. Rien d'autre.`;

export async function runTechWowWorkflow(options?: {
  model?: string;
}): Promise<WorkflowRun> {
  const settings = getSettings();
  const model = options?.model || settings.globalModel || "gemini-2.0-flash";

  const workflowRun = makeEmptyRun("tech_wow");
  workflowRun.currentStep = "researcher";
  addToCollection("workflow_runs", workflowRun);

  const agentLogs: AgentLog[] = [];

  // Get recent topics for deduplication
  const recentTopics = getRecentTopics(50);
  const dedupeContext = recentTopics.length > 0
    ? `\n\nSujets DÉJÀ TRAITÉS (NE PAS les reproposer, cherche des sujets DIFFÉRENTS) :\n${recentTopics.map(t => `- ${t.title}`).join("\n")}`
    : "";

  // ─── Step 1: Research advanced AI techniques ───
  const researchStep: WorkflowStep = {
    agentId: "tech-wow-researcher", agentName: "🔬 Chercheur Tech Wow",
    status: "running", input: "Recherche de techniques IA avancées", output: "",
    startedAt: new Date().toISOString(), completedAt: null,
  };
  workflowRun.steps.push(researchStep);
  updateInCollection("workflow_runs", workflowRun.id, workflowRun);

  let topics: TopicSuggestion[] = [];
  try {
    const researchResult = await generateWithSearch(
      `${TECH_WOW_RESEARCH_PROMPT}${dedupeContext}`,
      model
    );
    researchStep.output = researchResult.text.slice(0, 5000);
    researchStep.status = "completed";
    researchStep.completedAt = new Date().toISOString();
    agentLogs.push({ agentId: "tech-wow-researcher", agentName: "🔬 Chercheur Tech Wow", input: "Recherche techniques IA", output: researchResult.text.slice(0, 5000), timestamp: new Date().toISOString() });

    try {
      const cleaned = researchResult.text.replace(/```json\n?|\n?```/g, "").trim();
      topics = JSON.parse(cleaned);
    } catch {
      topics = [{ title: "Technique IA avancée", description: researchResult.text.slice(0, 500), angle: "Vulgarisation", category: "ai", recency: "evergreen" }];
    }
    workflowRun.topicSuggestions = topics;
    updateInCollection("workflow_runs", workflowRun.id, workflowRun);
  } catch (error) {
    researchStep.status = "failed";
    researchStep.output = error instanceof Error ? error.message : String(error);
    workflowRun.status = "failed";
    workflowRun.error = researchStep.output;
    updateInCollection("workflow_runs", workflowRun.id, workflowRun);
    throw error;
  }

  // ─── Step 2: Select the best topic ───
  workflowRun.currentStep = "topic_selector";
  const selectorStep: WorkflowStep = {
    agentId: "tech-wow-selector", agentName: "🎯 Sélecteur Wow",
    status: "running", input: JSON.stringify(topics).slice(0, 2000), output: "",
    startedAt: new Date().toISOString(), completedAt: null,
  };
  workflowRun.steps.push(selectorStep);
  updateInCollection("workflow_runs", workflowRun.id, workflowRun);

  let selectedTopic: TopicSuggestion;
  try {
    const selectorInput = `${TECH_WOW_SELECTOR_PROMPT}\n\nVoici les sujets proposés :\n${JSON.stringify(topics, null, 2)}${dedupeContext}`;
    const selectorResult = await generateContent(selectorInput, model);
    selectorStep.output = selectorResult.slice(0, 5000);
    selectorStep.status = "completed";
    selectorStep.completedAt = new Date().toISOString();
    agentLogs.push({ agentId: "tech-wow-selector", agentName: "🎯 Sélecteur Wow", input: JSON.stringify(topics).slice(0, 2000), output: selectorResult.slice(0, 5000), timestamp: new Date().toISOString() });

    try {
      const parsed = JSON.parse(selectorResult.replace(/```json\n?|\n?```/g, "").trim());
      const sel = parsed.selectedTopic || parsed;
      selectedTopic = { title: sel.title, description: sel.description, angle: sel.angle || sel.reason || "", category: "ai", recency: "evergreen" };
    } catch {
      // Fallback: pick the topic with highest composite score
      const scored = topics.map((t: TopicSuggestion & { wowFactor?: number; vulgarizability?: number; selfContained?: number }) => ({
        ...t,
        score: ((t.wowFactor || 5) + (t.vulgarizability || 5) + (t.selfContained || 5)) / 3
      }));
      scored.sort((a, b) => b.score - a.score);
      selectedTopic = scored[0] || topics[0];
    }
    updateInCollection("workflow_runs", workflowRun.id, workflowRun);
  } catch (error) {
    selectorStep.status = "failed";
    workflowRun.status = "failed";
    workflowRun.error = error instanceof Error ? error.message : String(error);
    updateInCollection("workflow_runs", workflowRun.id, workflowRun);
    throw error;
  }

  // Save topic for deduplication
  const topic: Topic = {
    id: generateId(), title: selectedTopic.title, description: selectedTopic.description,
    sources: [], category: "ai", recency: "evergreen", status: "used",
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
  addToCollection("topics", topic);
  workflowRun.topicId = topic.id;

  // ─── Step 3: Write the post ───
  workflowRun.currentStep = "writer";
  const topicText = `${selectedTopic.title}\n${selectedTopic.description}\nAngle: ${selectedTopic.angle}`;
  const writerStep: WorkflowStep = {
    agentId: "tech-wow-writer", agentName: "✍️ Rédacteur Tech Wow",
    status: "running", input: topicText.slice(0, 2000), output: "",
    startedAt: new Date().toISOString(), completedAt: null,
  };
  workflowRun.steps.push(writerStep);
  updateInCollection("workflow_runs", workflowRun.id, workflowRun);

  let finalPost = "";
  try {
    const writerInput = `${TECH_WOW_WRITER_PROMPT}\n\nSujet à vulgariser :\nTitre : ${selectedTopic.title}\nDescription : ${selectedTopic.description}\nAngle : ${selectedTopic.angle}\n\nÉcris le post LinkedIn (max 600 mots, effet wow, zéro bullshit).`;
    finalPost = await generateContent(writerInput, model);
    writerStep.output = finalPost.slice(0, 5000);
    writerStep.status = "completed";
    writerStep.completedAt = new Date().toISOString();
    agentLogs.push({ agentId: "tech-wow-writer", agentName: "✍️ Rédacteur Tech Wow", input: topicText.slice(0, 2000), output: finalPost.slice(0, 5000), timestamp: new Date().toISOString() });
    updateInCollection("workflow_runs", workflowRun.id, workflowRun);
  } catch (error) {
    writerStep.status = "failed";
    workflowRun.status = "failed";
    workflowRun.error = error instanceof Error ? error.message : String(error);
    updateInCollection("workflow_runs", workflowRun.id, workflowRun);
    throw error;
  }

  // ─── Save post ───
  const post: Post = {
    id: generateId(), topicId: workflowRun.topicId, content: finalPost,
    status: settings.autoPublish ? "approved" : "pending_approval",
    tone: "tech_wow", linkedinPostId: null, imageUrl: null, imageSuggestions: [],
    agentLogs, scheduledAt: null, publishedAt: null,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
  addToCollection("posts", post);

  // Auto-publish if enabled
  if (settings.autoPublish) {
    const formattedPost = formatForLinkedIn(finalPost);
    const result = await publishToLinkedIn(formattedPost);
    if (result.success) {
      updateInCollection<Post>("posts", post.id, { status: "published", linkedinPostId: result.id, publishedAt: new Date().toISOString() });
    }
  }

  workflowRun.postId = post.id;
  workflowRun.status = "completed";
  workflowRun.completedAt = new Date().toISOString();
  updateInCollection("workflow_runs", workflowRun.id, workflowRun);
  return workflowRun;
}

// ─────────────────────────────────────────────
// ENSURE POST BUFFER
// Makes sure there are at least N pending posts
// ─────────────────────────────────────────────
export async function ensurePostBuffer(minBuffer?: number): Promise<{ generated: number; total: number }> {
  const settings = getSettings();
  const buffer = minBuffer || settings.minPendingBuffer || 5;
  const posts = readCollection<Post>("posts");
  const pendingPosts = posts.filter(p => p.status === "pending_approval" || p.status === "approved");
  const needed = buffer - pendingPosts.length;

  if (needed <= 0) {
    return { generated: 0, total: pendingPosts.length };
  }

  let generated = 0;
  const model = settings.globalModel || "gemini-2.0-flash";
  const workflowMode = settings.cronWorkflowMode || "tech_wow";

  // Generate posts one at a time to avoid rate limiting
  for (let i = 0; i < needed; i++) {
    try {
      if (workflowMode === "tech_wow") {
        await runTechWowWorkflow({ model });
      } else {
        await runFullWorkflow({ model });
      }
      generated++;
    } catch (error) {
      console.error(`Error generating buffer post ${i + 1}/${needed}:`, error);
      break; // Stop on first error to avoid cascading failures
    }
  }

  return { generated, total: pendingPosts.length + generated };
}

// ─────────────────────────────────────────────
// PUBLISH NEXT PENDING POST
// Publishes the oldest approved/pending post
// ─────────────────────────────────────────────
export async function publishNextPending(): Promise<{ success: boolean; postId?: string; error?: string }> {
  const posts = readCollection<Post>("posts")
    .filter(p => p.status === "approved" || p.status === "pending_approval")
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  if (posts.length === 0) {
    return { success: false, error: "No pending posts to publish" };
  }

  const post = posts[0];
  return publishPost(post.id);
}
