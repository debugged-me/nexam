/** Only availability failures advance to another configured provider. */
export function isRetryableAiError(error) {
  const status = Number(error?.status || error?.response?.status);
  if ([408, 429, 500, 502, 503, 504, 529].includes(status)) return true;
  const detail = `${error?.message || ''} ${error?.code || ''} ${error?.cause?.code || ''}`;
  return /quota|rate.?limit|overloaded|resource.?exhausted|fetch failed|network|timed?\s*out|ETIMEDOUT|ECONNRESET|ECONNREFUSED|ENETUNREACH|EAI_AGAIN/i.test(detail);
}

/** Providers supply lazy calls so an unused fallback never spends quota. */
export async function runGenerationFallback(providers) {
  let lastError;
  for (const provider of providers) {
    if (!provider.configured) continue;
    try {
      return await provider.generate();
    } catch (error) {
      if (!isRetryableAiError(error)) throw error;
      lastError = error;
      // Never log raw SDK errors: they can contain credentials or prompts.
      console.warn(`[aiProvider] ${provider.name} unavailable (status ${error?.status || error?.response?.status || 'network'}).`);
    }
  }
  // Retain the real quota/retry information if later providers are unset.
  if (lastError) throw lastError;
  throw new Error('No AI generation provider is configured. Ask an administrator to check the AI settings.');
}
