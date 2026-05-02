import { describe, expect, it } from 'vitest';

import { buildByokPrompt } from '@/core/prompts/byok-prompt';
import { OfflineModeManager } from '@/core/offline-mode-manager';
import { canonicalizeDeliveredMarkdown } from '@/lib/markdown-canonicalizer';
import type { ExportMetadata } from '@/lib/types';

const metadata: ExportMetadata = {
  title: 'Satori - Make AI Coding Agents Understand Your Repo',
  url: 'https://satori.hamza.my.id/',
  capturedAt: '2026-05-02T15:29:15.467Z',
  selectionHash: 'satori-hash',
};

describe('technical markdown fidelity', () => {
  it('repairs AI markdown where fenced commands are glued to prose', () => {
    const warnings: string[] = [];
    const markdown = [
      '# Satori',
      '',
      'CLI Installer',
      '',
      '```bash',
      'npx -y @zokizuan/satori-cli@0.3.1 install --client codex',
      'npx -y @zokizuan/satori-cli@0.3.1 install --client claude',
      'npx -y @zokizuan/satori-cli@0.3.1 install --client all --dry-run',
      'npx -y @zokizuan/satori-cli@0.3.1 doctor```The installer writes managed client config.',
      '',
      '*Codex TOML*```toml',
      '[mcp_servers.satori]',
      'command = "npx"',
      'args = ["-y", "@zokizuan/satori-mcp@4.9.1"]',
      '```*Claude / JSON Clients*```json',
      '{',
      '  "satori": {',
      '    "command": "npx",',
      '    "args": ["-y", "@zokizuan/satori-mcp@4.9.1"]',
      '  }',
      '}```',
    ].join('\n');

    const canonical = canonicalizeDeliveredMarkdown(markdown, metadata, warnings);

    expect(canonical).toContain('npx -y @zokizuan/satori-cli@0.3.1 doctor\n```');
    expect(canonical).toContain('```\n\nThe installer writes managed client config.');
    expect(canonical).toContain('*Codex TOML*\n\n```toml\n[mcp_servers.satori]');
    expect(canonical).toContain('```\n\n*Claude / JSON Clients*\n\n```json\n{');
    expect(canonical).not.toContain('doctor```The installer');
    expect(canonical).not.toContain('*Codex TOML*```toml');
    expect(canonical).not.toContain('```*Claude / JSON Clients*```json');
  });

  it('repairs offline collapsed MCP config into TOML and JSON fences', () => {
    const warnings: string[] = [];
    const markdown = [
      'MCP Config[mcp_servers.satori]',
      'command = "npx"',
      'args = ["-y", "@zokizuan/satori-mcp@4.9.1"]',
      'startup_timeout_ms = 180000',
      'env = { EMBEDDING_PROVIDER = "VoyageAI", MILVUS_ADDRESS = "your-milvus-endpoint" }"satori": {',
      ' "command": "npx",',
      ' "args": ["-y", "@zokizuan/satori-mcp@4.9.1"],',
      ' "timeout": 180000,',
      ' "env": {',
      '  "EMBEDDING_PROVIDER": "VoyageAI"',
      ' }',
      '}',
      '`MILVUS_TOKEN` is only needed for authenticated Milvus or Zilliz endpoints.',
    ].join('\n');

    const canonical = OfflineModeManager.canonicalizeDeliveredMarkdown(markdown, metadata, warnings);

    expect(canonical).toContain('MCP Config\n\n```toml\n[mcp_servers.satori]');
    expect(canonical).toContain('env = { EMBEDDING_PROVIDER = "VoyageAI", MILVUS_ADDRESS = "your-milvus-endpoint" }\n```');
    expect(canonical).toContain('```json\n{\n  "satori": {');
    expect(canonical).toContain('}\n```\n\n`MILVUS_TOKEN` is only needed');
    expect(canonical).not.toContain('MCP Config[mcp_servers.satori]');
    expect(canonical).not.toContain('}"satori": {');
  });

  it('repairs nested config fences and split npx commands from offline output', () => {
    const warnings: string[] = [];
    const markdown = [
      'CLI Installer',
      '',
      '```npx',
      '-y @zokizuan/satori-cli@0.3.1 install --client codex',
      'npx -y @zokizuan/satori-cli@0.3.1 doctor',
      '```',
      '',
      'MCP Config',
      '',
      '```json',
      '{',
      '  "satori": {',
      '  "command": "npx",',
      '  "args": ["-y", "@zokizuan/satori-mcp@4.9.1"],',
      '  "timeout": 180000,',
      '  "env": {',
      '',
      '```',
      '  "EMBEDDING_PROVIDER": "VoyageAI",',
      '```',
      '',
      '```',
      '  "MILVUS_TOKEN": "your-milvus-token"',
      '```',
      '',
      '}',
      '  }`MILVUS_TOKEN` is only needed for authenticated Milvus or Zilliz endpoints.',
      '',
      '}',
      '```',
    ].join('\n');

    const canonical = OfflineModeManager.canonicalizeDeliveredMarkdown(markdown, metadata, warnings);

    expect(canonical).toContain('```bash\nnpx -y @zokizuan/satori-cli@0.3.1 install --client codex');
    expect(canonical).toMatch(/"env": \{\n\s+"EMBEDDING_PROVIDER": "VoyageAI",\n\s+"MILVUS_TOKEN": "your-milvus-token"\n\s*\}/);
    expect(canonical).toContain('}\n```\n\n`MILVUS_TOKEN` is only needed');
    expect(canonical).not.toContain('```npx');
    expect(canonical).not.toContain('```\n  "EMBEDDING_PROVIDER"');
    expect(canonical).not.toContain('}`MILVUS_TOKEN`');
  });

  it('closes unterminated offline bash fences before installer prose and split config fences', () => {
    const warnings: string[] = [];
    const markdown = [
      'CLI Installer',
      '',
      '```bash',
      'npx -y @zokizuan/satori-cli@0.3.1 install --client codex',
      'npx -y @zokizuan/satori-cli@0.3.1 install --client claude',
      'npx -y @zokizuan/satori-cli@0.3.1 install --client all --dry-run',
      'npx -y @zokizuan/satori-cli@0.3.1 doctor',
      'The installer writes managed client config and copies the first-party skills.',
      '',
      'MCP Config',
      '',
      '```',
      '',
      'toml',
      '[mcp_servers.satori]',
      'command = "npx"',
      'args = ["-y", "@zokizuan/satori-mcp@4.9.1"]',
      '```',
      '',
      '```',
      '',
      'json',
      '{',
      '  "satori": {',
      '    "command": "npx"',
      '  }',
      '}',
      '```',
    ].join('\n');

    const canonical = OfflineModeManager.canonicalizeDeliveredMarkdown(markdown, metadata, warnings);

    expect(canonical).toContain('npx -y @zokizuan/satori-cli@0.3.1 doctor\n```');
    expect(canonical).toContain('```\n\nThe installer writes managed client config');
    expect(canonical).toContain('MCP Config\n\n```toml\n[mcp_servers.satori]');
    expect(canonical).toContain('```\n\n```json\n{');
    expect(canonical).not.toContain('doctor\nThe installer writes');
    expect(canonical).not.toContain('```\n\ntoml\n');
    expect(canonical).not.toContain('```\n\njson\n');
  });

  it('repairs nested code fences and bad text fence languages from AI output', () => {
    const warnings: string[] = [];
    const markdown = [
      '```ts',
      'async function run() {',
      '  for await (const page of result) {',
      '',
      '```',
      'console.log(page);',
      '```',
      '',
      '  }',
      '}',
      '```',
      '',
      '```Deterministic',
      'tie-break chain:',
      'score desc -> file asc -> start_line asc',
      '```',
    ].join('\n');

    const canonical = canonicalizeDeliveredMarkdown(markdown, metadata, warnings);

    expect(canonical).toContain('  for await (const page of result) {\nconsole.log(page);\n  }\n}');
    expect(canonical).toContain('```text\nDeterministic\ntie-break chain:');
    expect(canonical).not.toContain('```Deterministic');
    expect(canonical).not.toContain('```\nconsole.log(page);\n```');
  });

  it('instructs BYOK AI to preserve technical blocks verbatim', () => {
    const prompt = buildByokPrompt({
      html: '<pre><code>npx -y @zokizuan/satori-cli@0.3.1 doctor</code></pre>',
      url: metadata.url,
      title: metadata.title,
      capturedAt: metadata.capturedAt,
      selectionHash: metadata.selectionHash,
    });

    expect(prompt).toContain('Preserve commands, config blocks, JSON, TOML, code fences, inline code, package names, versions, URLs, and environment variable names verbatim.');
    expect(prompt).toContain('Do not split one code/config block into multiple fenced blocks.');
    expect(prompt).toContain('Do not summarize, condense, paraphrase, rename sections, or create an overview.');
    expect(prompt).toContain('Do not wrap the whole answer in a `markdown` fenced code block.');
  });

  it('unwraps whole-document markdown fences from AI output', () => {
    const warnings: string[] = [];
    const markdown = [
      '```markdown',
      '# Satori',
      '',
      '## Install',
      '',
      '```bash',
      'npx -y @zokizuan/satori-cli@0.3.1 doctor',
      '```',
      '```',
    ].join('\n');

    const canonical = canonicalizeDeliveredMarkdown(markdown, metadata, warnings);

    expect(canonical).toContain('# Satori');
    expect(canonical).toContain('```bash\nnpx -y @zokizuan/satori-cli@0.3.1 doctor\n```');
    expect(canonical).not.toContain('```markdown');
  });

  it('unwraps whole-document markdown fences through offline canonicalization', () => {
    const warnings: string[] = [];
    const markdown = [
      '```markdown',
      '# Satori',
      '',
      '```bash',
      'npx -y @zokizuan/satori-cli@0.3.1 doctor',
      '```',
      '```',
    ].join('\n');

    const canonical = OfflineModeManager.canonicalizeDeliveredMarkdown(markdown, metadata, warnings);

    expect(canonical).toContain('# Satori');
    expect(canonical).toContain('```bash\nnpx -y @zokizuan/satori-cli@0.3.1 doctor\n```');
    expect(canonical).not.toContain('```markdown');
  });

  it('preserves valid fenced code blocks followed by lowercase prose', () => {
    const warnings: string[] = [];
    const markdown = [
      '```bash',
      'npx -y @zokizuan/satori-cli@0.3.1 doctor',
      '```',
      '',
      'then configure your MCP client.',
      '',
      '```ts',
      'const ok = true;',
      '```',
      '',
      'then use the value below.',
      '',
      '```toml',
      '[mcp_servers.satori]',
      'command = "npx"',
      '```',
      '',
      'this config is managed by the installer.',
    ].join('\n');

    const canonical = canonicalizeDeliveredMarkdown(markdown, metadata, warnings);

    expect(canonical).toContain('npx -y @zokizuan/satori-cli@0.3.1 doctor\n```\n\nthen configure your MCP client.');
    expect(canonical).toContain('const ok = true;\n```\n\nthen use the value below.');
    expect(canonical).toContain('command = "npx"\n```\n\nthis config is managed by the installer.');
  });

  it('preserves shell fences followed by prose starting with command names', () => {
    const warnings: string[] = [];
    const markdown = [
      '```bash',
      'npm install',
      '```',
      '',
      'npm supports workspaces.',
      '',
      '```bash',
      'git status',
      '```',
      '',
      'git stores repository metadata.',
      '',
      '```bash',
      'python script.py',
      '```',
      '',
      'python includes batteries.',
    ].join('\n');

    const canonical = canonicalizeDeliveredMarkdown(markdown, metadata, warnings);

    expect(canonical).toContain('npm install\n```\n\nnpm supports workspaces.');
    expect(canonical).toContain('git status\n```\n\ngit stores repository metadata.');
    expect(canonical).toContain('python script.py\n```\n\npython includes batteries.');
  });

  it('closes unterminated bash fences before lowercase installer prose', () => {
    const warnings: string[] = [];
    const markdown = [
      '```bash',
      'npx -y @zokizuan/satori-cli doctor',
      'then configure your MCP client.',
    ].join('\n');

    const canonical = canonicalizeDeliveredMarkdown(markdown, metadata, warnings);

    expect(canonical).toContain('npx -y @zokizuan/satori-cli doctor\n```\n\nthen configure your MCP client.');
  });

  it('preserves plausible unknown fence language markers', () => {
    const warnings: string[] = [];
    const markdown = [
      '```rust',
      'fn main() {}',
      '```',
      '',
      '```dockerfile',
      'FROM node:22',
      '```',
    ].join('\n');

    const canonical = canonicalizeDeliveredMarkdown(markdown, metadata, warnings);

    expect(canonical).toContain('```rust\nfn main() {}\n```');
    expect(canonical).toContain('```dockerfile\nFROM node:22\n```');
    expect(canonical).not.toContain('```text\nrust');
    expect(canonical).not.toContain('```text\ndockerfile');
  });

  it('preserves already valid JSON config blocks without adding braces', () => {
    const warnings: string[] = [];
    const markdown = [
      '```json',
      '{',
      '    "satori": {',
      '        "command": "npx"',
      '    }',
      '}',
      '```',
    ].join('\n');

    const canonical = canonicalizeDeliveredMarkdown(markdown, metadata, warnings);

    expect(canonical).toContain([
      '```json',
      '{',
      '    "satori": {',
      '        "command": "npx"',
      '    }',
      '}',
      '```',
    ].join('\n'));
    expect(warnings).not.toContain('Auto-closed malformed JSON config block');
  });

  it('normalizes unquoted collapsed satori JSON object keys', () => {
    const warnings: string[] = [];
    const markdown = [
      'MCP Config[mcp_servers.satori]',
      'command = "npx"',
      'satori: {',
      ' "command": "npx"',
      '}',
    ].join('\n');

    const canonical = OfflineModeManager.canonicalizeDeliveredMarkdown(markdown, metadata, warnings);

    expect(canonical).toContain('```json\n{\n  "satori": {');
    expect(canonical).not.toContain('"satori: {');
  });
});
