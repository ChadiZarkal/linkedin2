// src/lib/types.ts
// Simplified types for LinkedIn AutoPilot

// ─── Post ───
export interface Post {
  id: string;
  topic: string;
  content: string;
  status: "pending" | "approved" | "published" | "rejected";
  linkedinPostId: string | null;
  publishedAt: string | null;
  createdAt: string;
}

// ─── Settings ───
export interface Settings {
  id: string;
  autoPublish: boolean;
  pendingBuffer: number;
  globalModel: string;
  linkedinProfile: {
    name: string;
    urn: string;
  };
}

// ─── Used Topic (for deduplication) ───
export interface UsedTopic {
  id: string;
  title: string;
  usedAt: string;
}
