/**
 * AI provider abstraction with automatic fallback.
 *
 * Primary:   Google Gemini 2.0 Flash (generation + embeddings)
 * Fallback:  Groq Llama 3.3 70B (generation only)
 *
 * If Gemini fails (quota, rate limit, network), generation automatically
 * retries on Groq. Embeddings are Gemini-only (Groq has no embedding API).
 *
 * Every call returns a normalized result with the provider that served it,
 * so callers can record provenance in generation_meta.
 */
import { GoogleGenAI, Type } from '@google/genai';
import Groq from 'groq-sdk';
import env from '../config/env.js';

let geminiClient = null;
let groqClient = null;

/** Lazily initialize Gemini — only if a key is configured. */
function getGemini() {
  if (geminiClient) return geminiClient;
  if (!env.ai.gemini.apiKey) return null;
  geminiClient = new GoogleGenAI({ apiKey: env.ai.gemini.apiKey });
  return geminiClient;
}

/** Lazily initialize Groq — only if a key is configured. */
function getGroq() {
  if (groqClient) return groqClient;
  if (!env.ai.groq.apiKey) return null;
  groqClient = new Groq({ apiKey: env.ai.groq.apiKey });
  return groqClient;
}

/** True if a retryable error (quota, rate limit, 5xx). */
function isRetryable(err) {
  const status = err?.status || err?.response?.status;
  if (status === 429 || status === 500 || status === 502 || status === 503 || status === 529) return true;
  const msg = (err?.message || '').toLowerCase();
  return msg.includes('quota') || msg.includes('rate limit') || msg.includes('overloaded') || msg.includes('resource');
}

/**
 * Generate text from a prompt, with structured JSON output.
 * Tries Gemini first, falls back to Groq on failure.
 *
 * @param {string} systemPrompt
 * @param {string} userPrompt
 * @param {object} opts — { jsonSchema?, temperature?, maxTokens? }
 * @returns {Promise<{text:string, provider:string, model:string, usage:object|null}>}
 */
export async function generate(systemPrompt, userPrompt, opts = {}) {
  const {
    jsonSchema = null,
    temperature = env.ai.generation.temperature,
    maxTokens = env.ai.generation.maxTokens,
  } = opts;

  // ── Try Gemini first ──────────────────────────────
  const gemini = getGemini();
  if (gemini) {
    try {
      const params = {
        model: env.ai.gemini.model,
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        config: {
          systemInstruction: systemPrompt,
          temperature,
          maxOutputTokens: maxTokens,
        },
      };
      if (jsonSchema) {
        params.config.responseMimeType = 'application/json';
        params.config.responseSchema = {
          type: Type.OBJECT,
          properties: jsonSchema.properties,
          required: jsonSchema.required,
        };
      }
      const res = await gemini.models.generateContent(params);
      const text = typeof res.text === 'function' ? res.text() : res.text;
      return { text, provider: 'gemini', model: env.ai.gemini.model, usage: res.usageMetadata || res.response?.usageMetadata || null };
    } catch (err) {
      console.warn(`[aiProvider] Gemini failed: ${err.message}. Falling back to Groq...`);
      if (!isRetryable(err)) throw err;
    }
  }

  // ── Fallback: Groq ────────────────────────────────
  const groq = getGroq();
  if (!groq) throw new Error('All AI providers failed and no fallback is configured.');

  const completion = await groq.chat.completions.create({
    model: env.ai.groq.model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature,
    max_tokens: maxTokens,
    response_format: jsonSchema ? { type: 'json_object' } : undefined,
  });

  const text = completion.choices[0]?.message?.content || '';
  return {
    text,
    provider: 'groq',
    model: env.ai.groq.model,
    usage: completion.usage ? {
      promptTokens: completion.usage.prompt_tokens,
      completionTokens: completion.usage.completion_tokens,
      totalTokens: completion.usage.total_tokens,
    } : null,
  };
}

/**
 * Generate an embedding vector for a piece of text.
 * Gemini-only — Groq does not offer embeddings.
 *
 * @param {string} text
 * @returns {Promise<{embedding:number[], provider:string, model:string}>}
 */
export async function embed(text) {
  const gemini = getGemini();
  if (!gemini) throw new Error('Embedding requires GEMINI_API_KEY (no fallback available).');

  const res = await gemini.models.embedContent({
    model: env.ai.gemini.embeddingModel,
    contents: text,
  });
  const embedding = res.embeddings?.[0]?.values;
  if (!embedding || !embedding.length) throw new Error('Embedding returned empty vector.');
  return { embedding, provider: 'gemini', model: env.ai.gemini.embeddingModel };
}

/**
 * Generate embeddings for multiple texts in one batch.
 * More efficient than calling embed() in a loop.
 *
 * @param {string[]} texts
 * @returns {Promise<{embeddings:number[][], provider:string, model:string}>}
 */
export async function embedBatch(texts) {
  const gemini = getGemini();
  if (!gemini) throw new Error('Embedding requires GEMINI_API_KEY (no fallback available).');

  // Gemini embedContent accepts a single content; batch by parallel calls.
  const results = await Promise.all(texts.map((t) => embed(t)));
  return {
    embeddings: results.map((r) => r.embedding),
    provider: 'gemini',
    model: env.ai.gemini.embeddingModel,
  };
}

/** Quick health check — which providers are configured? */
export function status() {
  return {
    gemini: Boolean(env.ai.gemini.apiKey),
    groq: Boolean(env.ai.groq.apiKey),
    geminiModel: env.ai.gemini.model,
    groqModel: env.ai.groq.model,
    embeddingModel: env.ai.gemini.embeddingModel,
  };
}

export default { generate, embed, embedBatch, status };
