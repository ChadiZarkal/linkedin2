// src/lib/gemini.ts
// Google Gemini AI client using Vertex AI with service account
import { GoogleGenAI } from "@google/genai";

let clientInstance: GoogleGenAI | null = null;

function getCredentials() {
  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!keyJson) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY not set");
  return JSON.parse(keyJson);
}

function getClient(): GoogleGenAI {
  if (clientInstance) return clientInstance;

  const credentials = getCredentials();
  const project = process.env.GOOGLE_CLOUD_PROJECT || "ai-agent-cha-2y53";
  const location = process.env.GOOGLE_CLOUD_LOCATION || "global";

  clientInstance = new GoogleGenAI({
    vertexai: true,
    project,
    location,
    googleAuthOptions: {
      credentials,
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    },
  });

  return clientInstance;
}

export async function generateContent(
  prompt: string,
  model?: string,
  systemInstruction?: string
): Promise<string> {
  const client = getClient();
  const modelName = model || process.env.GEMINI_MODEL || "gemini-2.0-flash";

  const config: Record<string, unknown> = {};
  if (systemInstruction) {
    config.systemInstruction = systemInstruction;
  }

  const response = await client.models.generateContent({
    model: modelName,
    contents: prompt,
    config,
  });

  return response.text || "";
}

export async function generateWithSearch(
  prompt: string,
  model?: string,
  systemInstruction?: string
): Promise<{ text: string; sources: string[] }> {
  const client = getClient();
  const modelName = model || process.env.GEMINI_MODEL || "gemini-2.0-flash";

  const config: Record<string, unknown> = {
    tools: [{ googleSearch: {} }],
  };
  if (systemInstruction) {
    config.systemInstruction = systemInstruction;
  }

  const response = await client.models.generateContent({
    model: modelName,
    contents: prompt,
    config,
  });

  const sources: string[] = [];
  const candidates = response.candidates;
  if (candidates && candidates.length > 0) {
    const groundingMetadata = candidates[0].groundingMetadata;
    if (groundingMetadata?.groundingChunks) {
      for (const chunk of groundingMetadata.groundingChunks) {
        if (chunk.web?.uri) {
          sources.push(chunk.web.uri);
        }
      }
    }
  }

  return {
    text: response.text || "",
    sources,
  };
}

// Search for image suggestions using Gemini
export async function findImageSuggestions(
  topic: string,
  model?: string
): Promise<string[]> {
  const prompt = `Pour un post LinkedIn sur le sujet suivant : "${topic}"

Propose 4 images pertinentes en donnant pour chacune des mots-clés en anglais.

Formate en JSON (UNIQUEMENT le JSON, pas de texte autour) :
[
  { "description": "Description courte en français", "keywords": "mot clé 1, mot clé 2" }
]`;

  try {
    const result = await generateContent(prompt, model);
    const parsed = JSON.parse(result.replace(/```json\n?|\n?```/g, "").trim());
    // Use Pexels search URLs (these actually render thumbnails)
    return parsed.map((img: { keywords: string; description: string }) =>
      `https://images.pexels.com/photos/${Math.floor(Math.random() * 9000000) + 1000000}/pexels-photo.jpeg?auto=compress&cs=tinysrgb&w=600&h=400&dpr=1`
    );
  } catch {
    return [];
  }
}
