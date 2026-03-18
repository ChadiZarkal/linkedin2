// ============================================================
// Gemini AI - Dual auth support:
// Mode 1: GEMINI_API_KEY → Google AI (simple, recommended)
// Mode 2: GOOGLE_SERVICE_ACCOUNT_KEY → Vertex AI (enterprise)
// ============================================================

import { GoogleGenAI } from '@google/genai';

// --- Client management ---
let cachedClient: GoogleGenAI | null = null;
let tokenExpiresAt = 0;
let authMode: 'apikey' | 'vertex' | null = null;

function getAuthMode(): 'apikey' | 'vertex' {
  if (process.env.GEMINI_API_KEY) return 'apikey';
  if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) return 'vertex';
  throw new Error('No Gemini credentials configured. Set GEMINI_API_KEY or GOOGLE_SERVICE_ACCOUNT_KEY');
}

// --- Mode 1: Simple API Key (Google AI Studio) ---
function getApiKeyClient(): GoogleGenAI {
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
}

// --- Mode 2: Vertex AI with Service Account ---
async function getAccessToken(): Promise<string> {
  let raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY!;
  
  // Strip surrounding quotes if Vercel env pull adds them
  if (raw.startsWith('"') && raw.endsWith('"')) {
    raw = raw.slice(1, -1);
  }

  let sa;
  try {
    // dotenv may convert \n to real newlines in quoted values
    // JSON doesn't allow literal newlines in strings, so escape them back
    const sanitized = raw.replace(/\n/g, '\\n');
    sa = JSON.parse(sanitized);
  } catch {
    // If env var is a file path, read the file
    try {
      const fs = await import('fs');
      sa = JSON.parse(fs.readFileSync(raw.trim(), 'utf-8'));
    } catch {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is not valid JSON and not a readable file path');
    }
  }
  // Ensure private_key has real newlines for PEM format
  if (sa.private_key && typeof sa.private_key === 'string') {
    sa.private_key = sa.private_key.replace(/\\n/g, '\n');
  }

  // Try google-auth-library first (more robust)
  try {
    const { GoogleAuth } = await import('google-auth-library');
    const auth = new GoogleAuth({
      credentials: { client_email: sa.client_email, private_key: sa.private_key },
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });
    const client = await auth.getClient();
    const tokenRes = await client.getAccessToken();
    if (tokenRes?.token) {
      tokenExpiresAt = Date.now() + 50 * 60 * 1000;
      return tokenRes.token;
    }
  } catch {
    // Fall through to manual JWT
  }

  // Manual JWT fallback
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

  const tokenFetch = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });

  if (!tokenFetch.ok) {
    const errBody = await tokenFetch.text();
    throw new Error(`Token exchange failed (${tokenFetch.status}): ${errBody}`);
  }
  const tokenData = await tokenFetch.json();
  tokenExpiresAt = Date.now() + 50 * 60 * 1000;
  return tokenData.access_token;
}

async function getVertexClient(): Promise<GoogleGenAI> {
  const project = process.env.GOOGLE_CLOUD_PROJECT || 'ai-agent-cha-2y53';
  const location = process.env.GOOGLE_CLOUD_LOCATION || 'global';
  const token = await getAccessToken();

  return new GoogleGenAI({
    vertexai: true,
    project,
    location,
    googleAuthOptions: { credentials: { access_token: token } as unknown as undefined },
    httpOptions: { headers: { Authorization: `Bearer ${token}` } },
  });
}

// --- Unified client getter ---
async function getClient(): Promise<GoogleGenAI> {
  const mode = getAuthMode();
  
  if (mode === 'apikey') {
    if (!cachedClient || authMode !== 'apikey') {
      cachedClient = getApiKeyClient();
      authMode = 'apikey';
    }
    return cachedClient;
  }

  // Vertex: re-create if token expired
  if (cachedClient && authMode === 'vertex' && Date.now() < tokenExpiresAt) {
    return cachedClient;
  }
  cachedClient = await getVertexClient();
  authMode = 'vertex';
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
