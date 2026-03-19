// ============================================================
// Gemini AI via Vertex AI
// Auth: GOOGLE_SERVICE_ACCOUNT_KEY (service account JSON)
// Uses @google/genai with googleAuthOptions — no manual JWT
// ============================================================

import { GoogleGenAI } from '@google/genai';
import type { GoogleAuthOptions } from 'google-auth-library';

const PROJECT  = process.env.GOOGLE_CLOUD_PROJECT  || 'ai-agent-cha-2y53';
const LOCATION = process.env.GOOGLE_CLOUD_LOCATION || 'europe-west1';
const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

// ── Service account parsing ─────────────────────────────────────────────────

function parseServiceAccount(): { client_email: string; private_key: string } {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) {
    throw new Error(
      'GOOGLE_SERVICE_ACCOUNT_KEY is not set. ' +
      'Add the service account JSON to .env.local or Vercel env vars.'
    );
  }

  // 1. Strip outer quotes that Vercel CLI sometimes adds
  let cleaned = raw.trim();
  if (cleaned.startsWith('"') && cleaned.endsWith('"')) cleaned = cleaned.slice(1, -1);

  // 2. dotenv converts \n inside double-quoted values to REAL newlines,
  //    which breaks JSON.parse (JSON forbids literal newlines in strings).
  //    Re-escape them before parsing.
  const sanitized = cleaned.replace(/\n/g, String.raw`\n`);

  let sa: Record<string, string>;
  try {
    sa = JSON.parse(sanitized);
  } catch {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is not valid JSON.');
  }

  if (!sa.client_email || !sa.private_key) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is missing client_email or private_key.');
  }

  // 3. After JSON.parse, private_key has real newlines (JSON unescapes \n).
  //    If still double-escaped (\\n as two chars), normalise for PEM format.
  const privateKey = sa.private_key.includes('\\n')
    ? sa.private_key.replace(/\\n/g, '\n')
    : sa.private_key;

  return { client_email: sa.client_email, private_key: privateKey };
}

// ── Vertex AI client ────────────────────────────────────────────────────────

let _client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (_client) return _client;

  const { client_email, private_key } = parseServiceAccount();

  const googleAuthOptions: GoogleAuthOptions = {
    credentials: { client_email, private_key },
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  };

  _client = new GoogleGenAI({
    vertexai: true,
    project: PROJECT,
    location: LOCATION,
    googleAuthOptions,
  });

  return _client;
}

// ── Retry helper ────────────────────────────────────────────────────────────

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isRetryable = /429|500|502|503|ECONNRESET|ETIMEDOUT|fetch failed/i.test(msg);

      if (!isRetryable || attempt === maxRetries - 1) throw err;

      const delay = Math.min(1000 * Math.pow(2, attempt), 8000);
      console.warn(`Gemini retry ${attempt + 1}/${maxRetries} after ${delay}ms: ${msg.substring(0, 100)}`);
      await new Promise(r => setTimeout(r, delay));

      // Reset client on auth errors so credentials are re-fetched
      if (/401|403|token|credential|auth/i.test(msg)) _client = null;
    }
  }
  throw new Error('Unreachable');
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Standard text generation (no grounding)
 */
export async function generateContent(
  prompt: string,
  systemPrompt?: string,
  model?: string
): Promise<string> {
  return withRetry(async () => {
    const client  = getClient();
    const modelId = model || DEFAULT_MODEL;

    const config: Record<string, unknown> = {};
    if (systemPrompt) config.systemInstruction = systemPrompt;

    const response = await client.models.generateContent({
      model: modelId,
      contents: prompt,
      config,
    });

    return response.text || '';
  });
}

/**
 * Search-grounded generation (Google Search tool)
 */
export async function generateWithSearch(
  prompt: string,
  systemPrompt?: string,
  model?: string
): Promise<{ text: string; sources: string[] }> {
  return withRetry(async () => {
    const client  = getClient();
    const modelId = model || DEFAULT_MODEL;

    const config: Record<string, unknown> = {
      tools: [{ googleSearch: {} }],
    };
    if (systemPrompt) config.systemInstruction = systemPrompt;

    const response = await client.models.generateContent({
      model: modelId,
      contents: prompt,
      config,
    });

    const text = response.text || '';

    // Extract grounding sources
    const sources: string[] = [];
    try {
      const candidates = response.candidates;
      if (candidates?.[0]) {
        const grounding = candidates[0].groundingMetadata;
        if (grounding?.groundingChunks) {
          for (const chunk of grounding.groundingChunks) {
            if (chunk.web?.uri) sources.push(chunk.web.uri);
          }
        }
      }
    } catch {
      // sources extraction is best-effort
    }

    return { text, sources: [...new Set(sources)] };
  });
}


