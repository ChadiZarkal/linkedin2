// lib/github-storage.ts
// GitHub-backed persistent storage for Vercel deployments
// Reads/writes JSON files directly in the GitHub repo via API

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO || "ChadiZarkal/linkedin2";
const DATA_BRANCH = "main";

// In-memory cache to avoid calling GitHub on every request
const cache: Record<string, { data: unknown; ts: number }> = {};
const CACHE_TTL_MS = 60_000; // 1 minute cache

interface GitHubFileResponse {
  content: string;
  sha: string;
  name: string;
}

function getCachePath(collection: string) {
  return `data/${collection}.json`;
}

function isCacheValid(collection: string): boolean {
  const hit = cache[collection];
  return !!hit && Date.now() - hit.ts < CACHE_TTL_MS;
}

async function fetchFromGitHub<T>(collection: string): Promise<T[] | null> {
  if (!GITHUB_TOKEN) return null;

  const path = getCachePath(collection);
  const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${path}`;

  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      cache: "no-store",
    });

    if (res.status === 404) return [];
    if (!res.ok) {
      console.error(`GitHub read error ${res.status} for ${collection}`);
      return null;
    }

    const file: GitHubFileResponse = await res.json();
    const decoded = Buffer.from(file.content, "base64").toString("utf-8");
    const parsed = JSON.parse(decoded) as T[];

    // Store SHA in cache metadata for writes
    cache[collection] = { data: { items: parsed, sha: file.sha }, ts: Date.now() };
    return parsed;
  } catch (e) {
    console.error(`GitHub storage read error for ${collection}:`, e);
    return null;
  }
}

async function getFileSha(collection: string): Promise<string | null> {
  const hit = cache[collection];
  if (hit) {
    const meta = hit.data as { items: unknown[]; sha: string };
    if (meta?.sha) return meta.sha;
  }
  // Fetch to get SHA
  await fetchFromGitHub(collection);
  const after = cache[collection];
  if (after) {
    const meta = after.data as { items: unknown[]; sha: string };
    return meta?.sha || null;
  }
  return null;
}

async function writeToGitHub<T>(collection: string, data: T[]): Promise<boolean> {
  if (!GITHUB_TOKEN) return false;

  const path = getCachePath(collection);
  const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${path}`;
  const content = Buffer.from(JSON.stringify(data, null, 2), "utf-8").toString(
    "base64"
  );

  const sha = await getFileSha(collection);

  const body: Record<string, string> = {
    message: `update: ${collection} via app settings`,
    content,
    branch: DATA_BRANCH,
  };
  if (sha) body.sha = sha;

  try {
    const res = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`GitHub write error ${res.status} for ${collection}:`, err);
      return false;
    }

    const result = await res.json();
    const newSha = result?.content?.sha;

    // Update cache with new data and SHA
    cache[collection] = {
      data: { items: data, sha: newSha },
      ts: Date.now(),
    };

    return true;
  } catch (e) {
    console.error(`GitHub storage write error for ${collection}:`, e);
    return false;
  }
}

// Public API — mirrors db.ts interface
export async function readCollectionFromGitHub<T>(
  collection: string
): Promise<T[]> {
  // Return from in-memory cache if fresh
  if (isCacheValid(collection)) {
    const hit = cache[collection];
    const meta = hit.data as { items: T[] };
    if (meta?.items) return meta.items;
  }

  const data = await fetchFromGitHub<T>(collection);
  return data ?? [];
}

export async function writeCollectionToGitHub<T>(
  collection: string,
  data: T[]
): Promise<void> {
  // Update cache immediately (optimistic)
  const currentSha = await getFileSha(collection);
  cache[collection] = {
    data: { items: data, sha: currentSha },
    ts: Date.now(),
  };

  // Write to GitHub in background (don't await in hot paths if needed)
  const ok = await writeToGitHub(collection, data);
  if (!ok) {
    console.error(`Failed to write ${collection} to GitHub`);
  }
}

export function isGitHubStorageAvailable(): boolean {
  return !!GITHUB_TOKEN;
}
