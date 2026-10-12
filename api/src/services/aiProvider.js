/**
 * AI provider abstraction with automatic fallback.
 *
 * Primary:   Google Gemini (generation + embeddings) — via LangChain's
 *            ChatGoogleGenerativeAI and GoogleGenerativeAIEmbeddings
 * Fallbacks: Groq, then Ollama Cloud (generation only)
 *
 * LangChain manages the interaction between the vector retrieval process
 * and the Google Gemini API, as described in §3.1 of the capstone. If
 * Gemini fails (quota, rate limit, network), generation automatically
 * tries Groq and Ollama Cloud. Local embedding fallback lives in vectorStore.
 *
 * Every call returns a normalized result with the provider that served it,
 * so callers can record provenance in generation_meta.
 */
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import Groq from 'groq-sdk';
import env from '../config/env.js';
import { getAiConfig } from './aiConfig.js';
import { runGenerationFallback } from './generationFallback.js';
import { generateOllamaCloud } from './ollamaCloud.js';

// Clients are cached by the config signature that built them — when the
// superadmin changes a key/model in settings, the next call builds a fresh
// client automatically.
let geminiChat = null;
let geminiEmb = null;
let groqCli = null;

/** Lazily initialize the LangChain Gemini chat model — only if a key is configured. */
function getGeminiChat(cfg) {
  const sig = `${cfg.gemini.apiKey}|${cfg.gemini.model}`;
  if (geminiChat?.sig === sig) return geminiChat.client;
  if (!cfg.gemini.apiKey) { geminiChat = null; return null; }
  geminiChat = {
    sig,
    client: new ChatGoogleGenerativeAI({
      apiKey: cfg.gemini.apiKey,
      model: cfg.gemini.model,
      temperature: env.ai.generation.temperature,
      maxOutputTokens: env.ai.generation.maxTokens,
      maxRetries: 0,
    }),
  };
  return geminiChat.client;
}

/** Lazily initialize the LangChain Gemini embeddings model. */
export function getGeminiEmbeddings(cfg) {
  const sig = `${cfg.gemini.apiKey}|${cfg.gemini.embeddingModel}`;
  if (geminiEmb?.sig === sig) return geminiEmb.client;
  if (!cfg.gemini.apiKey) { geminiEmb = null; return null; }
  geminiEmb = {
    sig,
    client: new GoogleGenerativeAIEmbeddings({
      apiKey: cfg.gemini.apiKey,
      model: cfg.gemini.embeddingModel,
    }),
  };
  return geminiEmb.client;
}

/** Lazily initialize Groq — only if a key is configured. */
function getGroq(cfg) {
  const sig = cfg.groq.apiKey;
  if (groqCli?.sig === sig) return groqCli.client;
  if (!cfg.groq.apiKey) { groqCli = null; return null; }
  groqCli = { sig, client: new Groq({ apiKey: cfg.groq.apiKey, maxRetries: 0 }) };
  return groqCli.client;
}

/**
 * Generate text from a prompt, with structured JSON output.
 * Tries Gemini, Groq, then Ollama Cloud on quota/service failures. SDK-level
 * retries are disabled so an exhausted provider does not delay the fallback.
 *
 * @param {string} systemPrompt
 * @param {string} userPrompt
 * @param {object} opts — { jsonSchema?, temperature?, maxTokens? }
 * @returns {Promise<{text:string, provider:string, model:string, usage:object|null}>}
 */
export async function generate(systemPrompt, userPrompt, opts = {}) {
  const cfg = await getAiConfig();
  const {
    jsonSchema = null,
    temperature = env.ai.generation.temperature,
    maxTokens = env.ai.generation.maxTokens,
  } = opts;

  return runGenerationFallback([
    {
      name: 'Gemini',
      configured: Boolean(cfg.gemini.apiKey),
      generate: async () => {
        const gemini = getGeminiChat(cfg);
        // Build the model with per-call overrides if needed
        let model = gemini;
        if (temperature !== env.ai.generation.temperature || maxTokens !== env.ai.generation.maxTokens) {
          model = new ChatGoogleGenerativeAI({
            apiKey: cfg.gemini.apiKey,
            model: cfg.gemini.model,
            temperature,
            maxOutputTokens: maxTokens,
            maxRetries: 0,
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
          model: cfg.gemini.model,
          usage: response.usage_metadata || response.additional_kwargs?.usage || null,
        };
      },
    },

    {
      name: 'Groq',
      configured: Boolean(cfg.groq.apiKey),
      generate: async () => {
        const completion = await getGroq(cfg).chat.completions.create({
          model: cfg.groq.model,
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
          model: cfg.groq.model,
          usage: completion.usage ? {
            promptTokens: completion.usage.prompt_tokens,
            completionTokens: completion.usage.completion_tokens,
            totalTokens: completion.usage.total_tokens,
          } : null,
        };
      },
    },
    {
      name: 'Ollama Cloud',
      configured: Boolean(cfg.ollama.apiKey),
      generate: () => generateOllamaCloud(cfg.ollama, systemPrompt, userPrompt, { jsonSchema, temperature, maxTokens }),
    },
  ]);
}

/**
 * Generate an embedding vector for a piece of text.
 * Uses LangChain's GoogleGenerativeAIEmbeddings (Gemini-only — Groq has no embeddings).
 *
 * @param {string} text
 * @returns {Promise<{embedding:number[], provider:string, model:string}>}
 */
export async function embed(text) {
  const cfg = await getAiConfig();
  const embeddings = getGeminiEmbeddings(cfg);
  if (!embeddings) throw new Error('Embedding requires a Gemini API key (no fallback available).');

  const embedding = await embeddings.embedQuery(text);
  if (!embedding || !embedding.length) throw new Error('Embedding returned empty vector.');
  return { embedding, provider: 'gemini', model: cfg.gemini.embeddingModel };
}

/**
 * Generate embeddings for multiple texts in one batch.
 * More efficient than calling embed() in a loop.
 *
 * @param {string[]} texts
 * @returns {Promise<{embeddings:number[][], provider:string, model:string}>}
 */
export async function embedBatch(texts) {
  const cfg = await getAiConfig();
  const embeddings = getGeminiEmbeddings(cfg);
  if (!embeddings) throw new Error('Embedding requires a Gemini API key (no fallback available).');

  const results = await embeddings.embedDocuments(texts);
  return {
    embeddings: results,
    provider: 'gemini',
    model: cfg.gemini.embeddingModel,
  };
}

/** Quick health check — which providers are configured? */
export async function status() {
  const cfg = await getAiConfig();
  return {
    gemini: Boolean(cfg.gemini.apiKey),
    groq: Boolean(cfg.groq.apiKey),
    ollama: Boolean(cfg.ollama.apiKey),
    geminiModel: cfg.gemini.model,
    groqModel: cfg.groq.model,
    ollamaModel: cfg.ollama.model,
    embeddingModel: cfg.gemini.embeddingModel,
    vectorStore: env.vectorStore.dir,
  };
}

export default { generate, embed, embedBatch, status, getGeminiEmbeddings };
