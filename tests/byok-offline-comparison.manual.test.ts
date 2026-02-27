import { describe, expect, it } from 'vitest';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { OfflineModeManager } from '@/core/offline-mode-manager';
import { buildByokPrompt } from '@/core/prompts/byok-prompt';

const runManual = process.env.RUN_BYOK_COMPARISON === '1';
const apiKey = process.env.OPENROUTER_API_KEY?.trim() || '';
const model = process.env.BYOK_CHECK_MODEL?.trim() || 'arcee-ai/trinity-large-preview:free';

const fixturePath = process.env.OFFLINE_FIXTURE_FILE
  ? path.resolve(process.env.OFFLINE_FIXTURE_FILE)
  : path.join(process.cwd(), 'tests', 'fixtures', 'offline-corpus', 'promptready-homepage.html');
const sourceUrl = process.env.OFFLINE_SOURCE_URL || 'https://promptready.app/';
const sourceTitle = process.env.OFFLINE_SOURCE_TITLE || 'PromptReady - One-click clean Markdown from any page';
const outputDir = path.resolve(process.env.BYOK_COMPARE_OUTPUT_DIR || 'output/byok-compare');

const maybeDescribe = runManual ? describe : describe.skip;

function countMatches(input: string, regex: RegExp): number {
  const matches = input.match(regex);
  return matches ? matches.length : 0;
}

function tokenize(input: string): Set<string> {
  const tokens = input.toLowerCase().match(/[a-z0-9]{3,}/g) || [];
  return new Set(tokens);
}

function toOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

function computeLexicalOverlap(reference: string, candidate: string): {
  referenceUnique: number;
  candidateUnique: number;
  sharedUnique: number;
  coverageFromReferencePct: number;
  jaccardPct: number;
} {
  const referenceTokens = tokenize(reference);
  const candidateTokens = tokenize(candidate);

  let shared = 0;
  for (const token of referenceTokens) {
    if (candidateTokens.has(token)) {
      shared += 1;
    }
  }

  const unionSize = new Set([...referenceTokens, ...candidateTokens]).size;
  const coverageFromReferencePct = referenceTokens.size === 0 ? 0 : toOneDecimal((shared / referenceTokens.size) * 100);
  const jaccardPct = unionSize === 0 ? 0 : toOneDecimal((shared / unionSize) * 100);

  return {
    referenceUnique: referenceTokens.size,
    candidateUnique: candidateTokens.size,
    sharedUnique: shared,
    coverageFromReferencePct,
    jaccardPct,
  };
}

async function requestOpenRouterMarkdown(prompt: string): Promise<string> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://promptready.app',
      'X-Title': 'PromptReady BYOK Offline Compare',
      'X-OpenRouter-Title': 'PromptReady BYOK Offline Compare',
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`OpenRouter request failed (${response.status}): ${text.slice(0, 300)}`);
  }

  const payload = JSON.parse(text) as { choices?: Array<{ message?: { content?: string } }> };
  const content = payload?.choices?.[0]?.message?.content;
  if (!content || !content.trim()) {
    throw new Error('OpenRouter returned empty content in comparison pipeline');
  }

  return content;
}

maybeDescribe('manual BYOK vs offline comparison pipeline', () => {
  it(
    'runs offline extraction + AI BYOK extraction and writes comparison artifacts',
    async () => {
      if (!apiKey) {
        throw new Error('OPENROUTER_API_KEY is required when RUN_BYOK_COMPARISON=1');
      }

      const html = readFileSync(fixturePath, 'utf8');

      const offline = await OfflineModeManager.processContent(html, sourceUrl, sourceTitle, {
        performance: {
          maxContentLength: 1_000_000,
          enableCaching: false,
          chunkSize: 100_000,
        },
      });

      expect(offline.success).toBe(true);
      expect(offline.markdown.length).toBeGreaterThan(0);

      const prompt = buildByokPrompt({
        html,
        url: sourceUrl,
        title: sourceTitle,
        selectionHash: offline.metadata?.selectionHash,
        capturedAt: offline.metadata?.capturedAt,
      });

      const aiMarkdown = await requestOpenRouterMarkdown(prompt);

      expect(aiMarkdown.trim().length).toBeGreaterThan(0);

      const lexicalOverlap = computeLexicalOverlap(offline.markdown, aiMarkdown);

      const summary = {
        fixturePath,
        sourceUrl,
        sourceTitle,
        model,
        offline: {
          chars: offline.markdown.length,
          headings: countMatches(offline.markdown, /^#{1,6}\s/mg),
          bullets: countMatches(offline.markdown, /^\s*[-*]\s/mg),
          warnings: offline.warnings || [],
          qualityScore: offline.processingStats?.qualityScore ?? null,
        },
        ai: {
          chars: aiMarkdown.length,
          headings: countMatches(aiMarkdown, /^#{1,6}\s/mg),
          bullets: countMatches(aiMarkdown, /^\s*[-*]\s/mg),
        },
        lexicalOverlap,
      };

      mkdirSync(outputDir, { recursive: true });
      writeFileSync(path.join(outputDir, 'prompt.md'), prompt, 'utf8');
      writeFileSync(path.join(outputDir, 'offline.md'), offline.markdown, 'utf8');
      writeFileSync(path.join(outputDir, 'ai.md'), aiMarkdown, 'utf8');
      writeFileSync(path.join(outputDir, 'summary.json'), JSON.stringify(summary, null, 2), 'utf8');

      const comparisonReport = [
        '# BYOK vs Offline Comparison Report',
        '',
        `- Fixture: \`${fixturePath}\``,
        `- Source URL: ${sourceUrl}`,
        `- Model: ${model}`,
        '',
        '## Metrics',
        '',
        `- Offline chars: ${summary.offline.chars}`,
        `- AI chars: ${summary.ai.chars}`,
        `- Offline headings: ${summary.offline.headings}`,
        `- AI headings: ${summary.ai.headings}`,
        `- Offline bullets: ${summary.offline.bullets}`,
        `- AI bullets: ${summary.ai.bullets}`,
        `- Offline quality score: ${summary.offline.qualityScore ?? 'n/a'}`,
        `- Lexical coverage (AI over offline unique tokens): ${summary.lexicalOverlap.coverageFromReferencePct}%`,
        `- Lexical Jaccard overlap: ${summary.lexicalOverlap.jaccardPct}%`,
        '',
        '## Artifacts',
        '',
        '- `prompt.md` (exact prompt sent to AI)',
        '- `offline.md` (offline extractor output)',
        '- `ai.md` (BYOK model output)',
        '- `summary.json` (structured comparison metrics)',
      ].join('\n');

      writeFileSync(path.join(outputDir, 'comparison.md'), comparisonReport, 'utf8');
    },
    120000,
  );
});
