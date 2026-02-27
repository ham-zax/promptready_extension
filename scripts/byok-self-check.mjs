#!/usr/bin/env node
/* eslint-env node */
/* global fetch, AbortController */

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';
const DEFAULT_MODEL = 'openai/gpt-oss-20b:free';
const DEFAULT_TIMEOUT_MS = 20_000;

function maskKey(key) {
  if (!key) return '(missing)';
  if (key.length <= 10) return `${key.slice(0, 2)}***`;
  return `${key.slice(0, 6)}...${key.slice(-4)}`;
}

function parseTimeoutMs(rawValue) {
  const parsed = Number.parseInt(String(rawValue ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
}

async function fetchWithTimeout(url, init, timeoutMs) {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

function isNoCreditResponse(status, text) {
  if (status !== 402) return false;
  const normalized = text.toLowerCase();
  return normalized.includes('insufficient') || normalized.includes('credit');
}

async function checkModels(apiKey, timeoutMs) {
  const res = await fetchWithTimeout(`${OPENROUTER_BASE}/models`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  }, timeoutMs);

  const text = await res.text();
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      reason: `models endpoint returned ${res.status}: ${text.slice(0, 200)}`,
    };
  }

  let modelsCount = 0;
  try {
    const parsed = JSON.parse(text);
    modelsCount = Array.isArray(parsed?.data) ? parsed.data.length : 0;
  } catch {
    modelsCount = 0;
  }

  return {
    ok: true,
    status: res.status,
    reason: `models endpoint reachable (${modelsCount} models listed)`,
  };
}

async function checkChat(apiKey, model, timeoutMs) {
  const res = await fetchWithTimeout(`${OPENROUTER_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://promptready.app',
      'X-Title': 'PromptReady BYOK Self Check',
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: 16,
      messages: [{ role: 'user', content: 'Reply with: BYOK_OK' }],
    }),
  }, timeoutMs);

  const text = await res.text();

  if (res.ok) {
    let content = '';
    try {
      const parsed = JSON.parse(text);
      content = parsed?.choices?.[0]?.message?.content ?? '';
    } catch {
      content = '';
    }

    return {
      ok: true,
      status: res.status,
      reason: `chat completion succeeded (${content.slice(0, 60) || 'empty response'})`,
    };
  }

  if (isNoCreditResponse(res.status, text)) {
    return {
      ok: true,
      status: res.status,
      reason: 'auth is valid but account has no usable credits (expected for test key)',
      noCredits: true,
    };
  }

  return {
    ok: false,
    status: res.status,
    reason: `chat endpoint returned ${res.status}: ${text.slice(0, 200)}`,
  };
}

async function main() {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  const model = process.env.BYOK_CHECK_MODEL?.trim() || DEFAULT_MODEL;
  const timeoutMs = parseTimeoutMs(process.env.BYOK_CHECK_TIMEOUT_MS);

  if (!apiKey) {
    console.error('[BYOK CHECK] Missing OPENROUTER_API_KEY environment variable.');
    console.error('[BYOK CHECK] Example: OPENROUTER_API_KEY=sk-or-v1-*** npm run byok:check');
    process.exit(1);
  }

  console.log(`[BYOK CHECK] Starting OpenRouter BYOK check with key ${maskKey(apiKey)}`);
  console.log(`[BYOK CHECK] Model: ${model}`);

  const modelsCheck = await checkModels(apiKey, timeoutMs);
  if (!modelsCheck.ok) {
    console.error(`[BYOK CHECK] ❌ ${modelsCheck.reason}`);
    process.exit(1);
  }
  console.log(`[BYOK CHECK] ✅ ${modelsCheck.reason}`);

  const chatCheck = await checkChat(apiKey, model, timeoutMs);
  if (!chatCheck.ok) {
    console.error(`[BYOK CHECK] ❌ ${chatCheck.reason}`);
    process.exit(1);
  }

  if (chatCheck.noCredits) {
    console.log(`[BYOK CHECK] ⚠️ ${chatCheck.reason}`);
    console.log('[BYOK CHECK] Result: AUTH_OK_NO_CREDITS');
    process.exit(0);
  }

  console.log(`[BYOK CHECK] ✅ ${chatCheck.reason}`);
  console.log('[BYOK CHECK] Result: AUTH_AND_CHAT_OK');
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[BYOK CHECK] ❌ unexpected failure: ${message}`);
  process.exit(1);
});
