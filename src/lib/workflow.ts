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
  const model = options.model || settings.globalModel || "gemini-2.5-flash";
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
  const model = options.model || settings.globalModel || "gemini-2.5-flash";

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
  const model = options.model || settings.globalModel || "gemini-2.5-flash";

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
  const model = options?.model || settings.globalModel || "gemini-2.5-flash";

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

  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);

  const postsThisWeek = readCollection<Post>("posts").filter(
    (p) => p.status === "published" && p.publishedAt && new Date(p.publishedAt) >= weekStart
  );

  return postsThisWeek.length < settings.postsPerWeek;
}
