/**
 * AI provider abstraction with automatic fallback.
 *
 * Primary:   Google Gemini (generation + embeddings) — via LangChain's
 *            ChatGoogleGenerativeAI and GoogleGenerativeAIEmbeddings
 * Fallback:  Groq Llama 3.3 70B (generation only, direct SDK call)
 *
 * LangChain manages the interaction between the vector retrieval process
 * and the Google Gemini API, as described in §3.1 of the capstone. If
 * Gemini fails (quota, rate limit, network), generation automatically
 * retries on Groq. Embeddings are Gemini-only (Groq has no embedding API).
 *
 * Every call returns a normalized result with the provider that served it,
 * so callers can record provenance in generation_meta.
 */
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import Groq from 'groq-sdk';
import env from '../config/env.js';

let geminiChatModel = null;
let geminiEmbeddings = null;
let groqClient = null;

/** Lazily initialize the LangChain Gemini chat model — only if a key is configured. */
function getGeminiChat() {
  if (geminiChatModel) return geminiChatModel;
  if (!env.ai.gemini.apiKey) return null;
  geminiChatModel = new ChatGoogleGenerativeAI({
    apiKey: env.ai.gemini.apiKey,
    model: env.ai.gemini.model,
    temperature: env.ai.generation.temperature,
    maxOutputTokens: env.ai.generation.maxTokens,
  });
  return geminiChatModel;
}

/** Lazily initialize the LangChain Gemini embeddings model. */
export function getGeminiEmbeddings() {
  if (geminiEmbeddings) return geminiEmbeddings;
  if (!env.ai.gemini.apiKey) return null;
  geminiEmbeddings = new GoogleGenerativeAIEmbeddings({
    apiKey: env.ai.gemini.apiKey,
    model: env.ai.gemini.embeddingModel,
  });
  return geminiEmbeddings;
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
 * Tries Gemini first (via LangChain), falls back to Groq on failure.
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

  // ── Try Gemini first (via LangChain) ───────────────
  const gemini = getGeminiChat();
  if (gemini) {
    try {
      // Build the model with per-call overrides if needed
      let model = gemini;
      if (temperature !== env.ai.generation.temperature || maxTokens !== env.ai.generation.maxTokens) {
        model = new ChatGoogleGenerativeAI({
          apiKey: env.ai.gemini.apiKey,
          model: env.ai.gemini.model,
          temperature,
          maxOutputTokens: maxTokens,
        });
      }

      const messages = [
        new SystemMessage(systemPrompt),
        new HumanMessage(userPrompt),
      ];

      // For JSON output, append an instruction to the system prompt
      // (LangChain's ChatGoogleGenerativeAI doesn't expose responseSchema
      // directly in the same way as the raw SDK; the instruction approach
      // is reliable across Gemini model versions).
      if (jsonSchema) {
        const schemaHint = `\n\nThe following is a JSON Schema definition, not the response itself. Return one JSON INSTANCE that satisfies it; never repeat or describe the schema: ${JSON.stringify(jsonSchema)}. Do not include markdown code fences or any text outside that JSON instance.`;
        messages[0] = new SystemMessage(systemPrompt + schemaHint);
      }

      const response = await model.invoke(messages);
      let text = typeof response.content === 'string'
        ? response.content
        : Array.isArray(response.content)
          ? response.content.map((c) => (typeof c === 'string' ? c : c.text || '')).join('')
          : '';

      // Strip markdown code fences if present
      text = text.trim();
      if (text.startsWith('```')) {
        text = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
      }

      return {
        text,
        provider: 'gemini',
        model: env.ai.gemini.model,
        usage: response.usage_metadata || response.additional_kwargs?.usage || null,
      };
    } catch (err) {
      console.warn(`[aiProvider] Gemini (LangChain) failed: ${err.message}. Falling back to Groq...`);
      if (!isRetryable(err)) throw err;
    }
  }

  // ── Fallback: Groq (direct SDK) ─────────────────────
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
 * Uses LangChain's GoogleGenerativeAIEmbeddings (Gemini-only — Groq has no embeddings).
 *
 * @param {string} text
 * @returns {Promise<{embedding:number[], provider:string, model:string}>}
 */
export async function embed(text) {
  const embeddings = getGeminiEmbeddings();
  if (!embeddings) throw new Error('Embedding requires GEMINI_API_KEY (no fallback available).');

  const embedding = await embeddings.embedQuery(text);
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
  const embeddings = getGeminiEmbeddings();
  if (!embeddings) throw new Error('Embedding requires GEMINI_API_KEY (no fallback available).');

  const results = await embeddings.embedDocuments(texts);
  return {
    embeddings: results,
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
    vectorStore: env.vectorStore.dir,
  };
}

export default { generate, embed, embedBatch, status, getGeminiEmbeddings };
