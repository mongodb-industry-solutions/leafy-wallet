export const OLLAMA_URL = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434'
export const CHAT_MODEL = process.env.OLLAMA_CHAT_MODEL ?? 'qwen2.5:7b'

/**
 * Preflight for the AI evals: fail loudly with instructions if Ollama isn't running or the chat
 * model isn't pulled, so the reason a commit is blocked is obvious rather than a timeout.
 */
export async function assertOllamaReady() {
  let tags
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(3000) })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    tags = await res.json()
  } catch {
    throw new Error(
      `\n\n  Ollama is not reachable at ${OLLAMA_URL}.\n` +
        `  Start it, then pull the model:\n` +
        `      ollama serve\n` +
        `      ollama pull ${CHAT_MODEL}\n`,
    )
  }
  const names = (tags.models ?? []).map((m) => m.name)
  const hasModel = names.some((n) => n === CHAT_MODEL || n.startsWith(`${CHAT_MODEL}`))
  if (!hasModel) {
    throw new Error(
      `\n\n  Ollama is running but "${CHAT_MODEL}" is not pulled.\n` +
        `      ollama pull ${CHAT_MODEL}\n` +
        `  Models present: ${names.join(', ') || '(none)'}\n`,
    )
  }
}
