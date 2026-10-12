/** Direct cloud inference only. No desktop service, model download, or custom host. */
const CHAT_URL = 'https://ollama.com/api/chat';
const REQUEST_TIMEOUT_MS = 120_000;
let queue = Promise.resolve();
let pendingRequests = 0;

function cloudError(message, status) {
  const error = new Error(message);
  error.status = status;
  error.publicMessage = message;
  return error;
}

function retrySeconds(header) {
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds);
  const date = Date.parse(header);
  return Number.isFinite(date) ? Math.max(0, Math.ceil((date - Date.now()) / 1000)) : null;
}

async function request(config, systemPrompt, userPrompt, opts) {
  if (!config?.apiKey) throw cloudError('Save an Ollama Cloud API key first.', 400);
  if (!config.model?.trim()) throw cloudError('Choose an Ollama Cloud model first.', 400);
  const { jsonSchema, temperature = 0.4, maxTokens = 4096, timeoutMs = REQUEST_TIMEOUT_MS } = opts;
  const schemaHint = jsonSchema
    ? `\n\nReturn one JSON instance matching this schema, with no markdown or surrounding text: ${JSON.stringify(jsonSchema)}`
    : '';

  let response;
  let body;
  try {
    response = await fetch(CHAT_URL, {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(timeoutMs),
      headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.model.trim(),
        messages: [
          { role: 'system', content: systemPrompt + schemaHint },
          { role: 'user', content: userPrompt },
        ],
        stream: false,
        options: { temperature, num_predict: maxTokens },
        // Cloud does not support format/JSON-schema enforcement. Callers still
        // validate structure, answers, and evidence before accepting drafts.
      }),
    });
    if (response.ok) body = await response.json();
    else await response.body?.cancel();
  } catch (error) {
    if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
      throw cloudError('Ollama Cloud timed out. Please try again shortly.', 504);
    }
    if (response?.ok) throw cloudError('Ollama Cloud returned an invalid response. Please try again.', 502);
    throw cloudError('Ollama Cloud could not be reached. Please try again shortly.', 503);
  }

  // Do not echo provider error bodies: they can include prompt text or secrets.
  if (!response.ok) {
    if (response.status === 429) {
      const retry = retrySeconds(response.headers.get('retry-after'));
      const message = `Ollama Cloud rate limit reached.${retry === null ? '' : ` Try again in ${retry}s.`}`;
      // Keep the normalized shape understood by friendlyJobError/countdowns.
      const error = cloudError(`429 ${JSON.stringify({ error: { message } })}`, 429);
      error.publicMessage = message;
      throw error;
    }
    if (response.status === 401) throw cloudError('Ollama Cloud rejected the API key. Check the saved key in AI settings.', 401);
    if (response.status === 402) throw cloudError('Ollama Cloud usage is unavailable. Check your free allowance and selected model.', 402);
    if (response.status === 403) throw cloudError('Ollama Cloud denied access. Check the key and choose a model included in your free allowance.', 403);
    if (response.status === 404) throw cloudError('Ollama Cloud model was not found. Check the model name in AI settings.', 404);
    throw cloudError(`Ollama Cloud request failed (HTTP ${response.status}). Check the model settings or try again later.`, response.status);
  }

  if (body?.error) throw cloudError('Ollama Cloud could not complete the request. Please try again.', 502);
  if (body?.done === false || body?.done_reason === 'length') {
    throw cloudError('Ollama Cloud returned an incomplete answer. Try a smaller generation batch.', 502);
  }
  const text = typeof body?.message?.content === 'string'
    ? body.message.content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    : '';
  if (!text) throw cloudError('Ollama Cloud returned an empty answer. Please try again.', 502);

  const promptTokens = Number(body.prompt_eval_count);
  const completionTokens = Number(body.eval_count);
  return {
    text,
    provider: 'ollama',
    model: body.model || config.model.trim(),
    usage: Number.isFinite(promptTokens) && Number.isFinite(completionTokens)
      ? { promptTokens, completionTokens, totalTokens: promptTokens + completionTokens }
      : null,
  };
}

/** Serialize cloud calls in this API process to respect the free plan concurrency. */
export function generateOllamaCloud(config, systemPrompt, userPrompt, opts = {}) {
  pendingRequests++;
  const pending = queue.then(() => request(config, systemPrompt, userPrompt, opts))
    .finally(() => { pendingRequests--; });
  queue = pending.catch(() => {});
  return pending;
}

/** Small diagnostic using invented material. It does not read or save user data. */
export async function testOllamaCloudConnection(config) {
  if (pendingRequests) throw cloudError('Ollama Cloud is busy generating. Test the connection after the current jobs finish.', 429);
  const evidence = 'Velorium turns violet at exactly 42 degrees Celsius.';
  const result = await generateOllamaCloud(config,
    'Answer only from the supplied evidence. Return JSON only.',
    `EVIDENCE: ${evidence}\nAt what temperature does Velorium turn violet? Return answer as a number and evidence as the exact source sentence.`,
    {
      jsonSchema: {
        type: 'object',
        properties: { answer: { type: 'number' }, evidence: { type: 'string' } },
        required: ['answer', 'evidence'],
      },
      temperature: 0,
      maxTokens: 512,
      // Finish before the web client timeout; never wait behind generation.
      timeoutMs: 25_000,
    });
  let parsed;
  try { parsed = JSON.parse(result.text); } catch { /* handled below */ }
  if (parsed?.answer !== 42 || parsed?.evidence !== evidence) {
    throw cloudError('Ollama Cloud responded but failed the JSON/evidence check. Try again or choose another available model.', 502);
  }
  return { provider: result.provider, model: result.model };
}
