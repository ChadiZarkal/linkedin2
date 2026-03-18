// ============================================================
// Types simplifiés pour LinkedIn AutoPilot v2
// ============================================================

// --- Prompts ---
export interface Prompts {
  research: string;
  writer: string;
  globalPrompt: string;
}

// --- Posts ---
export type PostStatus = 'draft' | 'pending' | 'scheduled' | 'published' | 'rejected';

export interface Post {
  id: string;
  topic: string;
  research: string;
  content: string;
  sources: string[];
  status: PostStatus;
  createdAt: string;
  scheduledAt?: string;
  publishedAt?: string;
}

// --- Schedule ---
export interface Schedule {
  enabled: boolean;
  days: number[];         // 0=Sun, 1=Mon, ..., 6=Sat
  time: string;           // HH:MM UTC
  autoGenerate: boolean;  // Auto-generate when buffer low
  minBuffer: number;      // Minimum pending posts to maintain
  defaultTopic: string;   // Default topic for auto-generation
}

// --- Research Result ---
export interface ResearchResult {
  topic: string;
  content: string;
  sources: string[];
}

// --- GitHub File ---
export interface GitHubFile {
  path: string;
  sha: string;
  content: string;
}

// --- API Response ---
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
