// src/lib/db.ts
// Simple JSON file-based database for Vercel (using /tmp for serverless)
// Persistent collections (settings, agents, topics) are backed by GitHub API
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import path from "path";
import {
  readCollectionFromGitHub,
  writeCollectionToGitHub,
  isGitHubStorageAvailable,
} from "./github-storage";

// Collections that must persist across deployments/cold starts
const PERSISTENT_COLLECTIONS = ["settings", "agents", "topics"];

const DATA_DIR =
  process.env.NODE_ENV === "production" ? "/tmp/data" : path.join(process.cwd(), "data");

function ensureDir() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

function getFilePath(collection: string): string {
  ensureDir();
  return path.join(DATA_DIR, `${collection}.json`);
}

export function readCollection<T>(collection: string): T[] {
  const filePath = getFilePath(collection);
  if (!existsSync(filePath)) return [];
  try {
    const raw = readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as T[];
  } catch {
    return [];
  }
}

export function writeCollection<T>(collection: string, data: T[]): void {
  const filePath = getFilePath(collection);
  writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}

export function addToCollection<T extends { id: string }>(collection: string, item: T): T {
  const data = readCollection<T>(collection);
  data.push(item);
  writeCollection(collection, data);
  return item;
}

export function updateInCollection<T extends { id: string }>(
  collection: string,
  id: string,
  updates: Partial<T>
): T | null {
  const data = readCollection<T>(collection);
  const index = data.findIndex((item) => item.id === id);
  if (index === -1) return null;
  data[index] = { ...data[index], ...updates };
  writeCollection(collection, data);
  return data[index];
}

export function deleteFromCollection<T extends { id: string }>(
  collection: string,
  id: string
): boolean {
  const data = readCollection<T>(collection);
  const filtered = data.filter((item) => item.id !== id);
  if (filtered.length === data.length) return false;
  writeCollection(collection, filtered);
  return true;
}

export function findInCollection<T extends { id: string }>(
  collection: string,
  id: string
): T | null {
  const data = readCollection<T>(collection);
  return data.find((item) => item.id === id) || null;
}

// ─── Async versions backed by GitHub for persistent collections ──────────────

export async function readCollectionAsync<T>(collection: string): Promise<T[]> {
  if (isGitHubStorageAvailable() && PERSISTENT_COLLECTIONS.includes(collection)) {
    const data = await readCollectionFromGitHub<T>(collection);
    if (data.length > 0) {
      // Warm the local /tmp cache as fallback
      writeCollection(collection, data);
      return data;
    }
  }
  // Fallback to /tmp file
  return readCollection<T>(collection);
}

export async function writeCollectionAsync<T>(
  collection: string,
  data: T[]
): Promise<void> {
  // Always write to /tmp immediately (fast, for current request)
  writeCollection(collection, data);
  // Also persist to GitHub if available
  if (isGitHubStorageAvailable() && PERSISTENT_COLLECTIONS.includes(collection)) {
    await writeCollectionToGitHub(collection, data);
  }
}

export async function updateInCollectionAsync<T extends { id: string }>(
  collection: string,
  id: string,
  updates: Partial<T>
): Promise<T | null> {
  const data = await readCollectionAsync<T>(collection);
  const index = data.findIndex((item) => item.id === id);
  if (index === -1) return null;
  data[index] = { ...data[index], ...updates };
  await writeCollectionAsync(collection, data);
  return data[index];
}

export async function addToCollectionAsync<T extends { id: string }>(
  collection: string,
  item: T
): Promise<T> {
  const data = await readCollectionAsync<T>(collection);
  data.push(item);
  await writeCollectionAsync(collection, data);
  return item;
}

export async function deleteFromCollectionAsync<T extends { id: string }>(
  collection: string,
  id: string
): Promise<boolean> {
  const data = await readCollectionAsync<T>(collection);
  const filtered = data.filter((item) => item.id !== id);
  if (filtered.length === data.length) return false;
  await writeCollectionAsync(collection, filtered);
  return true;
}
