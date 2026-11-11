const DEFAULT_MODELS = ['gpt-4o-mini'];

export function openAiKey(): string | undefined {
  return [process.env.AG_STUDIO_OPENAI_API_KEY, process.env.OPENAI_API_KEY]
    .map((value) => value?.trim()).find((value) => Boolean(value));
}

export function aiResponsesUrl(): string {
  const base = (process.env.OPENAI_BASE_URL?.trim() ?? 'https://api.openai.com/v1').replace(/\/+$/, '');
  const url = new URL(`${base}/responses`);
  if (url.username || url.password || !['https:', 'http:'].includes(url.protocol)) {
    throw new Error('Invalid OPENAI_BASE_URL');
  }
  return url.href;
}

/** The OpenAI models the assistant may use, from OPENAI_MODELS (comma-separated). The first is the default. */
export function aiModels(): string[] {
  const models = (process.env.OPENAI_MODELS ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  return models.length > 0 ? models : DEFAULT_MODELS;
}

/** The assistant is shown only when a key is configured. */
export function aiEnabled(): boolean {
  return Boolean(openAiKey());
}
