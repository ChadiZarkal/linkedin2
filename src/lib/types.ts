// src/lib/types.ts

// ─── Available LLM Models ───
export const AVAILABLE_MODELS = [
  { id: "gemini-3.1-pro-preview", name: "Gemini 3.1 Pro", description: "Dernière génération, le plus avancé" },
  { id: "gemini-3-pro-preview", name: "Gemini 3 Pro", description: "Très performant, raisonnement avancé" },
  { id: "gemini-3-flash-preview", name: "Gemini 3 Flash", description: "Rapide et puissant" },
  { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", description: "Rapide et efficace" },
];

// ─── Prompt Modes ───
export interface PromptMode {
  id: string;
  name: string;
  prompt: string;
}

// ─── Research Config ───
export interface ResearchConfig {
  recency: "today" | "3days" | "week" | "month" | "anytime";
  categories: string[];
  customTopic: string;
  maxSuggestions: number;
  model?: string;
}

// ─── Topic Suggestion (from researcher) ───
export interface TopicSuggestion {
  title: string;
  description: string;
  angle: string;
  category: string;
  recency: string;
}

// ─── Workflow Mode ───
export type WorkflowMode = "auto" | "interactive" | "custom_topic";

// ─── Agent ───
export interface Agent {
  id: string;
  name: string;
  role: "researcher" | "topic_selector" | "deep_researcher" | "synthesizer" | "writer" | "publisher" | "orchestrator" | "image_finder";
  description: string;
  prompt: string;
  promptModes: PromptMode[];
  activePromptModeId: string;
  model: string;
  enabled: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

// ─── Topic ───
export interface Topic {
  id: string;
  title: string;
  description: string;
  sources: string[];
  category: string;
  recency: "recent" | "evergreen" | "trending";
  status: "suggested" | "approved" | "rejected" | "used";
  createdAt: string;
  updatedAt: string;
}

// ─── Post ───
export interface Post {
  id: string;
  topicId: string | null;
  content: string;
  status: "draft" | "pending_approval" | "approved" | "published" | "rejected" | "failed";
  tone: string;
  linkedinPostId: string | null;
  imageUrl: string | null;
  imageSuggestions: string[];
  agentLogs: AgentLog[];
  scheduledAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AgentLog {
  agentId: string;
  agentName: string;
  input: string;
  output: string;
  timestamp: string;
}

// ─── Settings ───
export interface Settings {
  id: string;
  postsPerWeek: number;
  autoPublish: boolean;
  autoApproveTopics: boolean;
  defaultTone: string;
  globalModel: string;
  globalPrompt: string; // Global prompt injected into all agents
  topicPreferences: {
    recency: "recent" | "mixed" | "evergreen";
    categories: string[];
    customInstructions: string;
  };
  publishSchedule: {
    days: number[]; // 0=Sunday, 1=Monday, etc.
    timeSlots: string[]; // e.g., "09:00", "14:00"
    timezone: string;
  };
  linkedinProfile: {
    name: string;
    urn: string;
    email: string;
  };
}

// ─── Workflow ───
export interface OrchestratorDecision {
  needsResearch: boolean;
  needsDeepResearch: boolean;
  needsSynthesis: boolean;
  directToWriter: boolean;
  topicTitle: string;
  topicDescription: string;
  reasoning: string;
  promptTweaks?: Record<string, string>; // role → temporary prompt addition
}

export interface WorkflowRun {
  id: string;
  mode: WorkflowMode;
  status: "running" | "completed" | "failed" | "waiting_approval" | "waiting_topic_selection";
  currentStep: string;
  steps: WorkflowStep[];
  topicSuggestions: TopicSuggestion[];
  orchestratorDecision: OrchestratorDecision | null;
  postId: string | null;
  topicId: string | null;
  startedAt: string;
  completedAt: string | null;
  error: string | null;
}

export interface WorkflowStep {
  agentId: string;
  agentName: string;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  input: string;
  output: string;
  startedAt: string | null;
  completedAt: string | null;
}
