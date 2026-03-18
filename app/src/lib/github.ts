// ============================================================
// GitHub Storage - Single source of truth
// All data is stored on GitHub via the API
// ============================================================

import { Prompts, Post, Schedule } from './types';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const GITHUB_REPO = process.env.GITHUB_REPO || '';
const API_BASE = 'https://api.github.com';

// --- Default data ---

export const DEFAULT_PROMPTS: Prompts = {
  research: `Tu es un agent de recherche spécialisé. Ton rôle est de chercher les dernières actualités et informations sur un sujet donné.

Instructions :
- Cherche les informations les plus récentes et pertinentes
- Résume les points clés de manière structurée
- Cite tes sources
- Concentre-toi sur ce qui est nouveau et intéressant
- Donne du contexte et des chiffres quand c'est possible`,
  
  writer: `Tu es un rédacteur LinkedIn expert. Ton rôle est de rédiger des posts LinkedIn engageants à partir d'informations de recherche.

Instructions :
- Écris un post LinkedIn percutant de 800 à 1500 caractères
- Utilise un ton professionnel mais accessible
- Commence par un hook accrocheur (première ligne = la plus importante)
- Structure avec des sauts de ligne pour la lisibilité
- Termine par une question ou un appel à l'action
- Utilise des emojis avec parcimonie (2-3 max)
- N'utilise PAS de hashtags dans le texte, ajoute-les à la fin
- Utilise **gras** pour les mots clés importants`,
  
  globalPrompt: '',
};

export const DEFAULT_SCHEDULE: Schedule = {
  enabled: false,
  days: [1, 2, 3, 4], // Lun-Jeu
  time: '09:00',
  autoGenerate: false,
  minBuffer: 3,
  defaultTopic: 'intelligence artificielle et innovation tech',
};

// --- In-memory cache (60s TTL) ---
const cache: Record<string, { data: unknown; ts: number }> = {};
const CACHE_TTL = 60_000;

function getCached<T>(key: string): T | null {
  const entry = cache[key];
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data as T;
  return null;
}

function setCache(key: string, data: unknown) {
  cache[key] = { data, ts: Date.now() };
}

function clearCache(key?: string) {
  if (key) {
    delete cache[key];
  } else {
    Object.keys(cache).forEach(k => delete cache[k]);
  }
}

// --- GitHub API helpers ---

async function githubFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const url = `${API_BASE}/repos/${GITHUB_REPO}/contents/${path}`;
  return fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
}

// Read a JSON file from GitHub
async function readFile<T>(path: string): Promise<{ data: T; sha: string } | null> {
  try {
    const res = await githubFetch(path);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`GitHub GET ${path}: ${res.status}`);
    
    const json = await res.json();
    const content = Buffer.from(json.content, 'base64').toString('utf-8');
    return { data: JSON.parse(content) as T, sha: json.sha };
  } catch (err) {
    console.error(`Error reading ${path} from GitHub:`, err);
    return null;
  }
}

// Write a JSON file to GitHub (create or update) with retry on 409 conflict
async function writeFile<T>(path: string, data: T, message: string, retries = 3): Promise<string> {
  for (let attempt = 0; attempt < retries; attempt++) {
    // Get existing SHA if file exists
    let sha: string | undefined;
    const existing = await githubFetch(path);
    if (existing.ok) {
      const json = await existing.json();
      sha = json.sha;
    }

    const content = Buffer.from(JSON.stringify(data, null, 2)).toString('base64');
    
    const body: Record<string, unknown> = {
      message,
      content,
    };
    if (sha) body.sha = sha;

    const res = await githubFetch(path, {
      method: 'PUT',
      body: JSON.stringify(body),
    });

    if (res.status === 409 && attempt < retries - 1) {
      // SHA conflict - retry with fresh SHA
      console.warn(`GitHub 409 conflict on ${path}, retry ${attempt + 1}/${retries}`);
      await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
      continue;
    }

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`GitHub PUT ${path}: ${res.status} - ${errText}`);
    }

    const result = await res.json();
    return result.content.sha;
  }
  throw new Error(`GitHub PUT ${path}: failed after ${retries} retries`);
}

// Delete a file from GitHub
async function deleteFile(path: string, message: string): Promise<void> {
  const existing = await githubFetch(path);
  if (!existing.ok) return; // Already gone
  
  const json = await existing.json();
  const res = await githubFetch(path, {
    method: 'DELETE',
    body: JSON.stringify({ message, sha: json.sha }),
  });

  if (!res.ok && res.status !== 404) {
    throw new Error(`GitHub DELETE ${path}: ${res.status}`);
  }
}

// List files in a directory
async function listFiles(path: string): Promise<Array<{ name: string; path: string; sha: string }>> {
  try {
    const res = await githubFetch(path);
    if (res.status === 404) return [];
    if (!res.ok) throw new Error(`GitHub LIST ${path}: ${res.status}`);
    
    const json = await res.json();
    if (!Array.isArray(json)) return [];
    return json.map((f: { name: string; path: string; sha: string }) => ({
      name: f.name,
      path: f.path,
      sha: f.sha,
    }));
  } catch {
    return [];
  }
}

// ============================================================
// PUBLIC API - Prompts
// ============================================================

export async function getPrompts(): Promise<Prompts> {
  const cached = getCached<Prompts>('prompts');
  if (cached) return cached;

  const result = await readFile<Prompts>('config/prompts.json');
  const prompts = result?.data || DEFAULT_PROMPTS;
  setCache('prompts', prompts);
  return prompts;
}

export async function savePrompts(prompts: Prompts): Promise<void> {
  await writeFile('config/prompts.json', prompts, '📝 Update prompts');
  setCache('prompts', prompts);
}

// ============================================================
// PUBLIC API - Schedule
// ============================================================

export async function getSchedule(): Promise<Schedule> {
  const cached = getCached<Schedule>('schedule');
  if (cached) return cached;

  const result = await readFile<Schedule>('config/schedule.json');
  const schedule = result?.data || DEFAULT_SCHEDULE;
  setCache('schedule', schedule);
  return schedule;
}

export async function saveSchedule(schedule: Schedule): Promise<void> {
  await writeFile('config/schedule.json', schedule, '📅 Update schedule');
  setCache('schedule', schedule);
}

// ============================================================
// PUBLIC API - Posts (stored as individual files in articles/)
// ============================================================

export async function getPosts(): Promise<Post[]> {
  const cached = getCached<Post[]>('posts');
  if (cached) return cached;

  const files = await listFiles('articles');
  if (files.length === 0) {
    setCache('posts', []);
    return [];
  }

  const jsonFiles = files.filter(f => f.name.endsWith('.json'));
  const results = await Promise.all(
    jsonFiles.map(file => readFile<Post>(`articles/${file.name}`))
  );
  const posts: Post[] = results
    .filter((r): r is { data: Post; sha: string } => r !== null && r.data !== null)
    .map(r => r.data);

  // Sort by creation date (newest first)
  posts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  setCache('posts', posts);
  return posts;
}

export async function getPost(id: string): Promise<Post | null> {
  const result = await readFile<Post>(`articles/${id}.json`);
  return result?.data || null;
}

export async function savePost(post: Post): Promise<void> {
  const statusEmoji: Record<string, string> = {
    draft: '📝',
    pending: '⏳',
    scheduled: '📅',
    published: '✅',
    rejected: '❌',
  };
  const emoji = statusEmoji[post.status] || '📄';
  await writeFile(
    `articles/${post.id}.json`, 
    post, 
    `${emoji} ${post.status}: ${post.topic.substring(0, 50)}`
  );
  clearCache('posts');
}

export async function deletePost(id: string): Promise<void> {
  await deleteFile(`articles/${id}.json`, `🗑️ Delete post ${id}`);
  clearCache('posts');
}

// ============================================================
// PUBLIC API - Utilities
// ============================================================

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

export { clearCache };
