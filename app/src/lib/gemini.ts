// ============================================================
// Gemini AI - Simplified with two modes:
// 1. generateContent() - Standard text generation
// 2. generateWithSearch() - Grounded with Google Search
// ============================================================

import { GoogleGenAI } from '@google/genai';

// --- Auth via Vertex AI Service Account ---
let cachedClient: GoogleGenAI | null = null;
let tokenExpiresAt = 0;

async function getAccessToken(): Promise<string> {
  const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!serviceAccountKey) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is not set');

  const sa = JSON.parse(serviceAccountKey);
  
  // Create JWT
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const claim = Buffer.from(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  })).toString('base64url');

  const crypto = await import('crypto');
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(`${header}.${claim}`);
  const signature = sign.sign(sa.private_key, 'base64url');

  const jwt = `${header}.${claim}.${signature}`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });

  if (!tokenRes.ok) throw new Error(`Token exchange failed: ${tokenRes.status}`);
  const tokenData = await tokenRes.json();
  tokenExpiresAt = Date.now() + 50 * 60 * 1000; // Expire in 50min (token lasts 60min)
  return tokenData.access_token;
}

async function getClient(): Promise<GoogleGenAI> {
  // Re-create client if token expired or about to expire
  if (cachedClient && Date.now() < tokenExpiresAt) return cachedClient;
  cachedClient = null;

  const project = process.env.GOOGLE_CLOUD_PROJECT || 'ai-agent-cha-2y53';
  const location = process.env.GOOGLE_CLOUD_LOCATION || 'global';
  const token = await getAccessToken();

  cachedClient = new GoogleGenAI({
    vertexai: true,
    project,
    location,
    googleAuthOptions: { credentials: { access_token: token } as unknown as undefined },
    httpOptions: {
      headers: { Authorization: `Bearer ${token}` },
    },
  });

  return cachedClient;
}

// --- Model ---
const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

// ============================================================
// Standard text generation
// ============================================================
export async function generateContent(
  prompt: string,
  systemPrompt?: string,
  model?: string
): Promise<string> {
  const client = await getClient();
  const modelId = model || DEFAULT_MODEL;

  const config: Record<string, unknown> = {};
  if (systemPrompt) {
    config.systemInstruction = systemPrompt;
  }

  const response = await client.models.generateContent({
    model: modelId,
    contents: prompt,
    config,
  });

  return response.text || '';
}

// ============================================================
// Search-grounded generation (Google Search)
// ============================================================
export async function generateWithSearch(
  prompt: string,
  systemPrompt?: string,
  model?: string
): Promise<{ text: string; sources: string[] }> {
  const client = await getClient();
  const modelId = model || DEFAULT_MODEL;

  const config: Record<string, unknown> = {
    tools: [{ googleSearch: {} }],
  };
  if (systemPrompt) {
    config.systemInstruction = systemPrompt;
  }

  const response = await client.models.generateContent({
    model: modelId,
    contents: prompt,
    config,
  });

  const text = response.text || '';
  
  // Extract sources from grounding metadata
  const sources: string[] = [];
  try {
    const candidates = response.candidates;
    if (candidates && candidates[0]) {
      const grounding = candidates[0].groundingMetadata;
      if (grounding?.groundingChunks) {
        for (const chunk of grounding.groundingChunks) {
          if (chunk.web?.uri) {
            sources.push(chunk.web.uri);
          }
        }
      }
    }
  } catch {
    // Sources extraction is best-effort
  }

  return { text, sources: [...new Set(sources)] };
}
