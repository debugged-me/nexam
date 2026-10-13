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

/* ── Connection tests ──────────────────────────────────
 * Small diagnostics run from the superadmin console against saved
 * credentials only. They use invented evidence — no user data is read or
 * written — and verify the provider returns parseable JSON citing the
 * exact evidence span, the same shape generation depends on. */
const TEST_EVIDENCE = 'Velorium turns violet at exactly 42 degrees Celsius.';
const TEST_SYSTEM = 'Answer only from the supplied evidence. Return JSON only.';
const TEST_USER = `EVIDENCE: ${TEST_EVIDENCE}\nAt what temperature does Velorium turn violet? Return answer as a number and evidence as the exact source sentence.`;
const TEST_SCHEMA = {
  type: 'object',
  properties: { answer: { type: 'number' }, evidence: { type: 'string' } },
  required: ['answer', 'evidence'],
};
const TEST_TIMEOUT_MS = 25_000;

function testError(name, publicMessage, status = 502) {
  const error = new Error(publicMessage);
  error.status = status;
  error.publicMessage = publicMessage;
  return error;
}

/** Bound the test call so it finishes before the web client timeout. */
function withTimeout(promise, name) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(testError(name, `${name} timed out. Please try again shortly.`, 504)), TEST_TIMEOUT_MS)),
  ]);
}

/** Map raw SDK failures to safe messages — upstream bodies can carry prompt text. */
function normalizeProviderError(name, error) {
  if (error?.publicMessage) return error; // already a testError (e.g. timeout race)
  const status = Number(error?.status ?? error?.statusCode);
  if (status === 401 || status === 403) {
    return testError(name, `${name} rejected the API key. Check the saved key in AI settings.`, status);
  }
  if (status === 429) {
    // Providers embed a retry window in the error body — surface just the
    // duration, never the body itself.
    const retry = /retry in (?:([0-9]+)h)? ?(?:([0-9]+)m)?/i.exec(String(error?.message || ''));
    const span = retry && (retry[1] || retry[2])
      ? ` Retry in about ${[retry[1] && `${retry[1]}h`, retry[2] && `${retry[2]}m`].filter(Boolean).join(' ')}.`
      : ' Try again shortly.';
    return testError(name, `${name} rate limit or quota reached.${span}`, 429);
  }
  if (status === 404) return testError(name, `${name} model was not found. Check the model name in AI settings.`, 404);
  if (status === 402) return testError(name, `${name} usage is unavailable. Check billing or your free allowance.`, 402);
  return testError(name, `${name} could not complete the request. Check the key and model, then try again.`, 502);
}

/** The answer must cite the exact invented sentence — proves JSON + grounding. */
function assertEvidenceAnswer(text, name) {
  const clean = String(text || '').trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
  let parsed;
  try { parsed = JSON.parse(clean); } catch { /* handled below */ }
  if (parsed?.answer !== 42 || parsed?.evidence !== TEST_EVIDENCE) {
    throw testError(name, `${name} responded but failed the JSON/evidence check. Try again or choose another model.`, 502);
  }
}

/** Extract plain text from a LangChain message content union. */
function contentText(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map((c) => (typeof c === 'string' ? c : c.text || '')).join('');
  return '';
}

/** Test the saved Gemini key + chat model with the evidence probe. */
export async function testGeminiConnection() {
  const cfg = await getAiConfig();
  if (!cfg.gemini.apiKey) throw testError('Gemini', 'Save a Gemini API key first.', 400);
  const model = new ChatGoogleGenerativeAI({
    apiKey: cfg.gemini.apiKey,
    model: cfg.gemini.model,
    temperature: 0,
    maxOutputTokens: 512,
    maxRetries: 0,
  });
  const schemaHint = `\n\nThe following is a JSON Schema definition, not the response itself. Return one JSON INSTANCE that satisfies it; never repeat or describe the schema: ${JSON.stringify(TEST_SCHEMA)}. Do not include markdown code fences or any text outside that JSON instance.`;
  let response;
  try {
    response = await withTimeout(
      model.invoke(
        [new SystemMessage(TEST_SYSTEM + schemaHint), new HumanMessage(TEST_USER)],
        { timeout: TEST_TIMEOUT_MS }
      ),
      'Gemini'
    );
  } catch (error) {
    throw normalizeProviderError('Gemini', error);
  }
  assertEvidenceAnswer(contentText(response?.content), 'Gemini');
  return { provider: 'gemini', model: cfg.gemini.model };
}

/** Test the saved Groq key + model with the evidence probe. */
export async function testGroqConnection() {
  const cfg = await getAiConfig();
  const client = getGroq(cfg);
  if (!client) throw testError('Groq', 'Save a Groq API key first.', 400);
  let completion;
  try {
    completion = await withTimeout(client.chat.completions.create({
      model: cfg.groq.model,
      messages: [
        { role: 'system', content: TEST_SYSTEM },
        { role: 'user', content: TEST_USER },
      ],
      temperature: 0,
      max_tokens: 512,
      response_format: { type: 'json_object' },
    }, { timeout: TEST_TIMEOUT_MS }), 'Groq');
  } catch (error) {
    throw normalizeProviderError('Groq', error);
  }
  assertEvidenceAnswer(completion?.choices?.[0]?.message?.content, 'Groq');
  return { provider: 'groq', model: cfg.groq.model };
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
