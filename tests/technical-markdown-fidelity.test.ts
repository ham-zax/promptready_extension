import { describe, expect, it } from 'vitest';

import { buildByokPrompt } from '@/core/prompts/byok-prompt';
import { OfflineModeManager } from '@/core/offline-mode-manager';
import { canonicalizeDeliveredMarkdown } from '@/lib/markdown-canonicalizer';
import { ContentQualityValidator } from '@/core/content-quality-validator';
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

  it('normalizes unquoted collapsed JSON object keys', () => {
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

  it('drops stray prose fences after JSON config while preserving later command snippets', () => {
    const warnings: string[] = [];
    const markdown = [
      '#### MCP Config',
      '',
      '```json',
      '"satori": {',
      '  "command": "npx",',
      '  "args": ["-y", "@zokizuan/satori-mcp@4.9.1"],',
      '  "timeout": 180000,',
      '  "env": {',
      '"MILVUS_TOKEN": "your-milvus-token"',
      '  }',
      '}',
      '```',
      '',
      '```',
      '`MILVUS_TOKEN`is only needed for authenticated Milvus or Zilliz endpoints; local unauthenticated Milvus only needs`MILVUS_ADDRESS`.',
      '',
      '### For People Who Want the Details',
      '',
      '#### Scope filtering`scope=runtime`excludes docs/tests,`docs`targets documentation, and`mixed`includes everything.',
      '',
      '```text',
      'Deterministic tie-break chain:',
      'score desc -> file asc -> start_line asc -> symbol label asc -> symbol id asc',
      '```',
      '',
      '### Failure States Are Explicit',
      '',
      'Any`requires_reindex`response includes`hints.reindex`with the exact path to repair before retrying the original call.',
      '',
      '```text',
      'manage_index({ action: "reindex", path: <hints.reindex.args.path> })',
      '// then retry the original tool call',
      '```',
    ].join('\n');

    const canonical = canonicalizeDeliveredMarkdown(markdown, metadata, warnings);

    expect(canonical).toContain('```json\n{\n  "satori": {');
    expect(canonical).toContain('}\n}\n```\n\n`MILVUS_TOKEN` is only needed');
    expect(canonical).toContain('only needs `MILVUS_ADDRESS`.');
    expect(canonical).toContain('### For People Who Want the Details');
    expect(canonical).toContain('#### Scope filtering `scope=runtime` excludes docs/tests, `docs` targets documentation, and `mixed` includes everything.');
    expect(canonical).toContain('```text\nDeterministic tie-break chain:\nscore desc -> file asc -> start_line asc -> symbol label asc -> symbol id asc\n```');
    expect(canonical).toContain('### Failure States Are Explicit');
    expect(canonical).toContain('```text\nmanage_index({ action: "reindex", path: <hints.reindex.args.path> })\n// then retry the original tool call\n```');
    expect(canonical).not.toContain('```\n`MILVUS_TOKEN`');
    expect(canonical).not.toContain('```text\n### Failure States');
    expect((canonical.match(/```/g) || []).length % 2).toBe(0);
  });

  it('repairs bare JSON config fences with nested env-key fences', () => {
    const warnings: string[] = [];
    const markdown = [
      '#### MCP Config',
      '',
      '```',
      '"satori": {',
      ' "command": "npx",',
      ' "args": ["-y", "@zokizuan/satori-mcp@4.9.1"],',
      ' "timeout": 180000,',
      ' "env": {',
      '',
      '```',
      '"EMBEDDING_PROVIDER": "VoyageAI",',
      '```',
      '',
      '```',
      '"MILVUS_TOKEN": "your-milvus-token"',
      '```',
      '',
      ' }',
      '}',
      '```',
      '',
      '`MILVUS_TOKEN`is only needed for authenticated Milvus or Zilliz endpoints.',
    ].join('\n');

    const canonical = canonicalizeDeliveredMarkdown(markdown, metadata, warnings);

    expect(canonical).toContain('```json\n{\n  "satori": {');
    expect(canonical).toContain('  "EMBEDDING_PROVIDER": "VoyageAI",\n  "MILVUS_TOKEN": "your-milvus-token"');
    expect(canonical).toContain('}\n}\n```\n\n`MILVUS_TOKEN` is only needed');
    expect(canonical).not.toContain('```\n"EMBEDDING_PROVIDER"');
    expect(canonical).not.toContain('```\n"MILVUS_TOKEN"');
    expect((canonical.match(/```/g) || []).length % 2).toBe(0);
  });

  it('repairs generic JSON object fragments without relying on a specific config key', () => {
    const warnings: string[] = [];
    const markdown = [
      '#### Worker Config',
      '',
      '```json',
      '"worker": {',
      '  "command": "node",',
      '  "args": ["worker.js"]',
      '}',
      '```',
      '',
      '```',
      '"server": {',
      ' "command": "npx",',
      ' "env": {',
      '```',
      '"API_TOKEN": "token"',
      '```',
      ' }',
      '}',
      '```',
    ].join('\n');

    const canonical = canonicalizeDeliveredMarkdown(markdown, metadata, warnings);

    expect(canonical).toContain('```json\n{\n  "worker": {');
    expect(canonical).toContain('"args": ["worker.js"]\n}\n}\n```');
    expect(canonical).toContain('```json\n{\n  "server": {');
    expect(canonical).toContain('  "API_TOKEN": "token"');
    expect(canonical).not.toContain('```json\n"worker": {');
    expect(canonical).not.toContain('```\n"server": {');
    expect(warnings.join('\n')).not.toMatch(/Satori/i);
    expect((canonical.match(/```/g) || []).length % 2).toBe(0);
  });

  it('removes Reddit skip-link title prelude after the canonical heading', () => {
    const warnings: string[] = [];
    const redditMetadata: ExportMetadata = {
      title: "I gave Claude Code a $0.02/call coworker and stopped hitting Pro limits — here's the full setup : r/ClaudeAI",
      url: 'https://www.reddit.com/r/ClaudeAI/comments/1t1o43w/i_gave_claude_code_a_002call_coworker_and_stopped/',
      capturedAt: '2026-05-02T21:59:04.210Z',
      publishedAt: '2026-05-02T19:51:13.374Z',
      selectionHash: 'reddit-hash',
    };
    const markdown = [
      '# I gave Claude Code a $0.02/call coworker and stopped hitting Pro limits — here\'s the full setup : r/ClaudeAI',
      '',
      '[Skip to main content](https://www.reddit.com/r/ClaudeAI/comments/1t1o43w/i_gave_claude_code_a_002call_coworker_and_stopped/#main-content) I gave Claude Code a $0.02/call coworker and stopped hitting Pro limits — here\'s the full setup : r/ClaudeAI',
      '',
      '---',
      '',
      '## Post Content',
      '',
      'Was hitting my weekly Pro limit by Wednesday every single week.',
    ].join('\n');

    const canonical = canonicalizeDeliveredMarkdown(markdown, redditMetadata, warnings);
    const offlineCanonical = OfflineModeManager.canonicalizeDeliveredMarkdown(markdown, redditMetadata, []);

    expect(canonical).toContain('## Post Content');
    expect(canonical).toContain('Was hitting my weekly Pro limit');
    expect(canonical).not.toContain('[Skip to main content]');
    expect(canonical).not.toMatch(/main-content\) I gave Claude Code/);
    expect(offlineCanonical).toContain('## Post Content');
    expect(offlineCanonical).not.toContain('[Skip to main content]');
    expect(offlineCanonical).not.toMatch(/main-content\) I gave Claude Code/);
  });

  describe('completeness detection for title-only captures', () => {
    it('should detect markdown with only citation header and H1 as incomplete', () => {
      const warnings: string[] = [];
      const redditMetadata: ExportMetadata = {
        title: 'I gave Claude Code a $0.02/call coworker and stopped hitting Pro limits',
        url: 'https://www.reddit.com/r/ClaudeAI/comments/1t1o43w/test/',
        capturedAt: '2026-05-02T21:59:04.210Z',
        publishedAt: '2026-05-02T19:51:13.374Z',
        selectionHash: 'reddit-hash',
      };

      const titleOnlyMarkdown = [
        '> Source: [I gave Claude Code a $0.02/call coworker...](https://www.reddit.com/r/ClaudeAI/comments/1t1o43w/test/)',
        '> Captured: 2026-05-02T21:59:04.210Z',
        '> Published: 2026-05-02T19:51:13.374Z',
        '> Hash: reddit-hash',
        '',
        '# I gave Claude Code a $0.02/call coworker and stopped hitting Pro limits',
      ].join('\n');

      const canonical = canonicalizeDeliveredMarkdown(titleOnlyMarkdown, redditMetadata, warnings);

      const originalHtml = '<html><body><shreddit-post><p>Full post content here</p></shreddit-post></body></html>';
      const mockStats = {
        totalTime: 150,
        fallbacksUsed: [],
        errors: [],
      };

      const report = ContentQualityValidator.validate(canonical, originalHtml, mockStats);

      expect(report.completenessStatus).toBe('incomplete_title_only');
      expect(report.overallScore).toBeLessThanOrEqual(20);
      expect(report.metrics.completeness).toBeLessThan(50);
      const hasIncompleteWarning = report.issues.some(
        (issue) => issue.category === 'content' && /title.?only|empty.?body|metadata.?only/i.test(issue.message)
      );
      expect(hasIncompleteWarning).toBe(true);
    });

    it('should detect metadata-only markdown (no H1 added by canonicalizer) as incomplete', () => {
      const warnings: string[] = [];
      const pageMetadata: ExportMetadata = {
        title: 'Untitled Page',
        url: 'https://example.com/page',
        capturedAt: '2026-05-02T15:29:15.467Z',
        selectionHash: 'hash-123',
      };

      const metadataOnlyMarkdown = [
        '> Source: [Untitled Page](https://example.com/page)',
        '> Captured: 2026-05-02T15:29:15.467Z',
        '> Hash: hash-123',
      ].join('\n');

      const canonical = canonicalizeDeliveredMarkdown(metadataOnlyMarkdown, pageMetadata, warnings);

      const originalHtml = '<html><body><article><p>Real content in the page</p></article></body></html>';
      const mockStats = {
        totalTime: 80,
        fallbacksUsed: [],
        errors: [],
      };

      const report = ContentQualityValidator.validate(canonical, originalHtml, mockStats);

      expect(report.completenessStatus).toBe('incomplete_empty_body');
      expect(report.overallScore).toBeLessThanOrEqual(25);
      const hasIncompleteWarning = report.issues.some(
        (issue) => issue.category === 'content' && /title.?only|empty.?body|metadata.?only/i.test(issue.message)
      );
      expect(hasIncompleteWarning).toBe(true);
    });

    it('should classify valid article with body paragraphs as complete', () => {
      const warnings: string[] = [];
      const articleMetadata: ExportMetadata = {
        title: 'How to Build a React App',
        url: 'https://example.com/react-guide',
        capturedAt: '2026-05-02T15:29:15.467Z',
        selectionHash: 'hash-456',
      };

      const validArticleMarkdown = [
        '> Source: [How to Build a React App](https://example.com/react-guide)',
        '> Captured: 2026-05-02T15:29:15.467Z',
        '> Hash: hash-456',
        '',
        '# How to Build a React App',
        '',
        'React is a popular JavaScript library for building user interfaces.',
        '',
        '## Getting Started',
        '',
        'First, you need to create a new React project using Create React App or Vite.',
        '',
        '```bash',
        'npx create-react-app my-app',
        '```',
      ].join('\n');

      const canonical = canonicalizeDeliveredMarkdown(validArticleMarkdown, articleMetadata, warnings);

      const originalHtml = '<html><body><article><h1>How to Build a React App</h1><p>React is a popular JavaScript library...</p></article></body></html>';
      const mockStats = {
        totalTime: 500,
        fallbacksUsed: [],
        errors: [],
      };

      const report = ContentQualityValidator.validate(canonical, originalHtml, mockStats);

      expect(report.metrics.completeness).toBeGreaterThanOrEqual(80);
      expect(report.overallScore).toBeGreaterThanOrEqual(70);
    });

    it('should treat code-heavy markdown as substantive body content', () => {
      const warnings: string[] = [];
      const docsMetadata: ExportMetadata = {
        title: 'MCP Config',
        url: 'https://example.com/docs/config',
        capturedAt: '2026-05-02T15:29:15.467Z',
        selectionHash: 'hash-code',
      };

      const codeHeavyMarkdown = [
        '> Source: [MCP Config](https://example.com/docs/config)',
        '> Captured: 2026-05-02T15:29:15.467Z',
        '> Hash: hash-code',
        '',
        '# MCP Config',
        '',
        '```json',
        '{',
        '  "mcpServers": {',
        '    "promptready": {',
        '      "command": "node",',
        '      "args": ["server.js"],',
        '      "env": {',
        '        "PROMPTREADY_TOKEN": "example-token",',
        '        "PROMPTREADY_MODE": "offline"',
        '      }',
        '    }',
        '  }',
        '}',
        '```',
      ].join('\n');

      const canonical = canonicalizeDeliveredMarkdown(codeHeavyMarkdown, docsMetadata, warnings);

      const originalHtml = '<html><body><main><h1>MCP Config</h1><pre><code>{ "mcpServers": {} }</code></pre></main></body></html>';
      const mockStats = {
        totalTime: 500,
        fallbacksUsed: [],
        errors: [],
      };

      const report = ContentQualityValidator.validate(canonical, originalHtml, mockStats);

      expect(report.completenessStatus).not.toBe('incomplete_empty_body');
      expect(report.completenessStatus).not.toBe('incomplete_title_only');
      expect(report.overallScore).toBeGreaterThan(45);
    });
  });
});
