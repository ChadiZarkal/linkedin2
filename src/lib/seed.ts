// src/lib/seed.ts
// Seed default settings
import { readCollection, writeCollection, readCollectionAsync, writeCollectionAsync } from "./db";
import type { Settings } from "./types";

const DEFAULT_SETTINGS: Settings = {
  id: "settings",
  autoPublish: false,
  pendingBuffer: 5,
  globalModel: "gemini-3.1-pro-preview",
  linkedinProfile: {
    name: "Chadi Zarkal",
    urn: "urn:li:person:_knk8RXHBP",
  },
};

export function seedDefaults() {
  const settings = readCollection<Settings>("settings");
  if (settings.length === 0) {
    writeCollection("settings", [DEFAULT_SETTINGS]);
  }
}

export async function seedDefaultsAsync() {
  const settings = await readCollectionAsync<Settings>("settings");
  if (settings.length === 0) {
    await writeCollectionAsync("settings", [DEFAULT_SETTINGS]);
  }
}
