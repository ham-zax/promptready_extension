function countJsonBraceDelta(line: string): number {
  let delta = 0;
  let inString = false;
  let escaped = false;

  for (const char of line) {
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) {
      continue;
    }
    if (char === '{') delta++;
    if (char === '}') delta--;
  }

  return delta;
}

function normalizeJsonConfigLine(line: string): string {
  const trimmed = line.trim();
  if (!trimmed) {
    return '';
  }
  if (trimmed === '{' || trimmed === '}') {
    return trimmed;
  }
  return `  ${trimmed}`;
}

function pushWarningOnce(warnings: string[], warning: string): void {
  if (!warnings.includes(warning)) {
    warnings.push(warning);
  }
}

const KNOWN_FENCE_LANGUAGES = new Set([
  'bash',
  'c',
  'cpp',
  'csharp',
  'css',
  'diff',
  'dockerfile',
  'env',
  'go',
  'html',
  'ini',
  'java',
  'js',
  'json',
  'jsx',
  'kotlin',
  'markdown',
  'md',
  'php',
  'plaintext',
  'py',
  'python',
  'rb',
  'ruby',
  'rust',
  'scala',
  'sh',
  'shell',
  'sql',
  'swift',
  'text',
  'toml',
  'ts',
  'tsx',
  'txt',
  'xml',
  'yaml',
  'yml',
  'zsh',
]);

function isFenceLanguageChar(char: string): boolean {
  const code = char.charCodeAt(0);
  return (
    (code >= 48 && code <= 57) ||
    (code >= 65 && code <= 90) ||
    (code >= 97 && code <= 122) ||
    char === '_' ||
    char === '.' ||
    char === '#' ||
    char === '+' ||
    char === '-'
  );
}

function nextNonEmptyLine(lines: string[], startIndex: number): string | null {
  const index = nextNonEmptyLineIndex(lines, startIndex);
  return index === -1 ? null : (lines[index]?.trim() || null);
}

function nextNonEmptyLineIndex(lines: string[], startIndex: number): number {
  for (let index = startIndex; index < lines.length; index++) {
    const line = lines[index]?.trim();
    if (line) {
      return index;
    }
  }
  return -1;
}

function looksLikeConfigLanguageLine(language: string, nextLine: string | null): boolean {
  if (!KNOWN_FENCE_LANGUAGES.has(language)) {
    return false;
  }
  if (!nextLine) {
    return false;
  }
  if (language === 'toml') {
    return /^\[.+\]$/.test(nextLine) || /^[A-Z0-9_]+\s*=/.test(nextLine) || /^[a-z0-9_.-]+\s*=/.test(nextLine);
  }
  if (language === 'json') {
    return nextLine === '{' || nextLine === '[' || /^"[^"]+"\s*:/.test(nextLine);
  }
  if (language === 'bash' || language === 'sh' || language === 'shell' || language === 'zsh') {
    return looksLikeShellCommandLine(nextLine);
  }
  return false;
}

function looksLikeShellCommandLine(line: string): boolean {
  let trimmed = line.trim();
  if (!trimmed) {
    return false;
  }
  if (/^\$+\s+/.test(trimmed)) {
    trimmed = trimmed.replace(/^\$+\s+/, '');
  }

  const words = trimmed.split(/\s+/);
  let command = words[0]?.toLowerCase() || '';
  let arg = words[1] || '';

  if (/^[A-Z_][A-Z0-9_]*=/.test(command)) {
    const commandIndex = words.findIndex((word) => !/^[A-Z_][A-Z0-9_]*=/.test(word));
    if (commandIndex === -1) {
      return true;
    }
    command = words[commandIndex]?.toLowerCase() || '';
    arg = words[commandIndex + 1] || '';
  }

  if (command === 'sudo') {
    return looksLikeShellCommandLine(words.slice(1).join(' '));
  }

  const packageRunnerCommands = new Set(['npx', 'npm', 'pnpm', 'yarn', 'bun']);
  const packageRunnerSubcommands = new Set([
    'add',
    'build',
    'create',
    'dev',
    'dlx',
    'exec',
    'i',
    'init',
    'install',
    'link',
    'publish',
    'remove',
    'run',
    'start',
    'test',
    'uninstall',
    'upgrade',
  ]);
  if (packageRunnerCommands.has(command)) {
    return !!arg && (
      arg.startsWith('-') ||
      arg.startsWith('@') ||
      arg.includes('/') ||
      packageRunnerSubcommands.has(arg.toLowerCase()) ||
      /^[A-Za-z0-9@._/-]+(?:@[A-Za-z0-9._-]+)?$/.test(arg)
    ) && !/^[a-z]+s$/i.test(arg);
  }

  if (command === 'git') {
    return new Set(['add', 'branch', 'checkout', 'clone', 'commit', 'diff', 'fetch', 'log', 'merge', 'pull', 'push', 'rebase', 'remote', 'reset', 'restore', 'show', 'status', 'switch']).has(arg.toLowerCase());
  }
  if (command === 'docker') {
    return new Set(['build', 'compose', 'exec', 'login', 'logs', 'ps', 'pull', 'push', 'run', 'start', 'stop']).has(arg.toLowerCase());
  }
  if (command === 'python' || command === 'python3' || command === 'node' || command === 'deno' || command === 'uv') {
    return !!arg && (arg.startsWith('-') || arg.includes('/') || /\.[A-Za-z0-9]+$/.test(arg) || ['run', 'test', 'pip'].includes(arg.toLowerCase()));
  }
  if (command === 'go') {
    return new Set(['build', 'fmt', 'get', 'install', 'mod', 'run', 'test', 'tool', 'version']).has(arg.toLowerCase());
  }
  if (command === 'cargo') {
    return new Set(['build', 'check', 'clippy', 'fmt', 'install', 'run', 'test']).has(arg.toLowerCase());
  }
  if (command === 'wrangler') {
    return new Set(['deploy', 'dev', 'login', 'secret', 'tail', 'types', 'versions']).has(arg.toLowerCase());
  }
  if (command === 'curl' || command === 'wget') {
    return !!arg && (arg.startsWith('-') || /^https?:\/\//i.test(arg));
  }
  if (command === 'export') {
    return /^[A-Z_][A-Z0-9_]*=/.test(arg);
  }
  if (command === 'source' || command === 'cd' || command === 'mkdir' || command === 'cp' || command === 'mv' || command === 'rm' || command === 'bash' || command === 'sh') {
    return !!arg && !/^[a-z]+s$/i.test(arg);
  }

  return false;
}

function looksLikeTechnicalContinuation(language: string, line: string | null): boolean {
  if (!line) {
    return false;
  }

  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('```')) {
    return false;
  }
  if (isShellFence(language)) {
    return looksLikeShellCommandLine(trimmed);
  }
  if (language === 'toml') {
    return /^\[.+\]$/.test(trimmed) || /^[A-Za-z0-9_.-]+\s*=/.test(trimmed);
  }
  if (language === 'json') {
    return /^[\]},{]/.test(trimmed) || /^"[^"]+"\s*:/.test(trimmed);
  }

  return (
    /^(?:import|export|const|let|var|function|class|interface|type|return|if|for|while|switch|case|async|await)\b/.test(trimmed) ||
    /^(?:console\.|this\.|super\.|\/\/|\/\*|\*\/|\}|else\b|try\b|catch\b|finally\b)/.test(trimmed) ||
    /^[A-Za-z_$][\w$]*\s*(?:[({.=]|=>)/.test(trimmed) ||
    /[;{]$/.test(trimmed)
  );
}

function looksLikeShellFenceProse(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) {
    return false;
  }
  if (looksLikeShellCommandLine(trimmed)) {
    return false;
  }
  if (/^(?:#|\/\/|\$|-|\||&&)/.test(trimmed)) {
    return false;
  }
  if (/^[A-Z0-9_]+\s*=/.test(trimmed)) {
    return false;
  }
  return (
    /^The\s+[A-Za-z0-9 ,.'’:/()!-]{8,}$/.test(trimmed) ||
    /^(?:then|after|once|when|before)\s+[A-Za-z0-9 ,.'’:/()!-]{8,}[.]?$/.test(trimmed) ||
    /^[A-Z][A-Za-z0-9 ,.'’:/()!-]{12,}[.:]?$/.test(trimmed)
  );
}

function isShellFence(language: string): boolean {
  return language === 'bash' || language === 'sh' || language === 'shell' || language === 'zsh';
}

// Targeted repair for Satori/MCP install snippets that extraction can collapse
// into one TOML/JSON run. Keep this scoped rather than treating all config text
// as a generic machine-repair surface.
function repairCollapsedSatoriMcpConfig(markdown: string, warnings: string[]): string {
  const lines = markdown.split('\n');
  const output: string[] = [];
  let changed = false;
  let inToml = false;
  let inJson = false;
  let jsonBraceBalance = 0;

  const closeToml = () => {
    if (!inToml) return;
    output.push('```');
    output.push('');
    inToml = false;
  };

  const closeJson = () => {
    if (!inJson) return;
    while (jsonBraceBalance > 0) {
      output.push('}');
      jsonBraceBalance--;
      changed = true;
      pushWarningOnce(warnings, 'Auto-closed malformed JSON config block');
    }
    output.push('```');
    output.push('');
    inJson = false;
  };

  const openJsonWithObjectLine = (objectLine: string) => {
    closeToml();
    output.push('```json');
    output.push('{');
    const normalizedLine = normalizeJsonConfigLine(objectLine);
    if (normalizedLine) {
      output.push(normalizedLine);
    }
    jsonBraceBalance = 1 + countJsonBraceDelta(objectLine);
    inJson = true;
  };

  for (const rawLine of lines) {
    let line = rawLine;

    if (!inToml && !inJson) {
      const collapsedMcpConfig = line.match(/^(.*?\bMCP Config)\s*(\[mcp_servers\.satori\].*)$/);
      if (collapsedMcpConfig) {
        const heading = collapsedMcpConfig[1].trim();
        const tomlStart = collapsedMcpConfig[2].trim();
        output.push(heading);
        output.push('');
        output.push('```toml');
        output.push(tomlStart);
        inToml = true;
        changed = true;
        continue;
      }

      output.push(line);
      continue;
    }

    if (inToml) {
      const jsonStartIndex = line.search(/"?satori"?\s*:/i);
      if (jsonStartIndex !== -1) {
        const beforeJson = line.slice(0, jsonStartIndex).trimEnd();
        const jsonObjectLine = line.slice(jsonStartIndex).trim();
        if (beforeJson) {
          output.push(beforeJson);
        }
        const normalizedJsonObjectLine = jsonObjectLine.startsWith('"')
          ? jsonObjectLine
          : jsonObjectLine.replace(/^satori\s*:/i, '"satori":');
        openJsonWithObjectLine(normalizedJsonObjectLine);
        changed = true;
        continue;
      }

      output.push(line);
      continue;
    }

    if (inJson) {
      const trimmed = line.trim();
      const looksLikeMarkdownProse =
        trimmed.startsWith('`') ||
        /^#{1,6}\s/.test(trimmed) ||
        /^[A-Z][A-Za-z0-9 ,.'’:-]{8,}$/.test(trimmed);

      if (looksLikeMarkdownProse && jsonBraceBalance <= 1) {
        closeJson();
        output.push(line);
        changed = true;
        continue;
      }

      const normalizedLine = normalizeJsonConfigLine(line);
      output.push(normalizedLine);
      jsonBraceBalance += countJsonBraceDelta(line);

      if (jsonBraceBalance <= 0) {
        output.push('```');
        output.push('');
        inJson = false;
        jsonBraceBalance = 0;
        changed = true;
      }
    }
  }

  closeToml();
  closeJson();

  if (changed) {
    warnings.push('Repaired collapsed technical config block');
  }

  return output.join('\n');
}

function repairFenceBoundaries(markdown: string, warnings: string[]): string {
  const queue = markdown.split('\n');
  const output: string[] = [];
  let inFence = false;
  let fenceLanguage = '';
  let jsonBraceBalance = 0;
  let skipStandaloneJsonClosers = 0;
  let skipStrayJsonFenceCloser = false;
  let skipBlankAfterNestedFence = false;
  let changed = false;

  for (let index = 0; index < queue.length; index++) {
    const line = queue[index] ?? '';
    const trimmed = line.trim();

    if (inFence) {
      if (skipBlankAfterNestedFence) {
        if (!trimmed) {
          changed = true;
          continue;
        }
        skipBlankAfterNestedFence = false;
      }

      if (isShellFence(fenceLanguage) && looksLikeShellFenceProse(line)) {
        output.push('```');
        output.push('');
        inFence = false;
        fenceLanguage = '';
        queue.splice(index + 1, 0, line);
        changed = true;
        continue;
      }

      if (fenceLanguage === 'bash' && trimmed === 'npx' && queue[index + 1]?.trimStart().startsWith('-')) {
        output.push(`npx ${queue[index + 1]?.trim()}`);
        index++;
        changed = true;
        continue;
      }

      if (fenceLanguage === 'json') {
        const proseIndex = line.indexOf('`');
        if (proseIndex > 0 && /^[\s}\],]+$/.test(line.slice(0, proseIndex))) {
          const beforeProse = line.slice(0, proseIndex).trimEnd();
          const afterProse = line.slice(proseIndex).trimStart();
          if (beforeProse) {
            output.push(beforeProse);
            jsonBraceBalance += countJsonBraceDelta(beforeProse);
          }
          while (jsonBraceBalance > 0) {
            output.push('}');
            jsonBraceBalance--;
            skipStandaloneJsonClosers++;
            pushWarningOnce(warnings, 'Auto-closed malformed JSON config block');
          }
          output.push('```');
          output.push('');
          inFence = false;
          fenceLanguage = '';
          skipStrayJsonFenceCloser = true;
          queue.splice(index + 1, 0, afterProse);
          changed = true;
          continue;
        }
      }

      const closeIndex = line.indexOf('```');
      if (closeIndex === -1) {
        output.push(line);
        if (fenceLanguage === 'json') {
          jsonBraceBalance += countJsonBraceDelta(line);
        }
        continue;
      }

      const before = line.slice(0, closeIndex);
      const after = line.slice(closeIndex + 3);
      const nextLine = nextNonEmptyLine(queue, index + 1);
      if (trimmed === '```' && fenceLanguage === 'json' && jsonBraceBalance > 0) {
        if (output[output.length - 1] === '') {
          output.pop();
        }
        skipBlankAfterNestedFence = true;
        changed = true;
        continue;
      }
      if (trimmed === '```' && fenceLanguage !== 'json' && looksLikeTechnicalContinuation(fenceLanguage, nextLine)) {
        if (output[output.length - 1] === '') {
          output.pop();
        }
        skipBlankAfterNestedFence = true;
        changed = true;
        continue;
      }

      if (before) {
        output.push(before);
        if (fenceLanguage === 'json') {
          jsonBraceBalance += countJsonBraceDelta(before);
        }
      }
      output.push('```');
      inFence = false;
      fenceLanguage = '';
      jsonBraceBalance = 0;
      changed = true;

      if (after.trim()) {
        output.push('');
        queue.splice(index + 1, 0, after.trimStart());
      }
      continue;
    }

    if (skipStandaloneJsonClosers > 0 && trimmed === '}') {
      skipStandaloneJsonClosers--;
      changed = true;
      continue;
    }
    if (skipStrayJsonFenceCloser && trimmed === '```') {
      skipStrayJsonFenceCloser = false;
      changed = true;
      continue;
    }

    const openIndex = line.indexOf('```');
    if (openIndex === -1) {
      output.push(line);
      continue;
    }

    if (trimmed === '```') {
      const languageIndex = nextNonEmptyLineIndex(queue, index + 1);
      const language = languageIndex === -1 ? '' : (queue[languageIndex]?.trim().toLowerCase() || '');
      const contentIndex = languageIndex === -1 ? -1 : nextNonEmptyLineIndex(queue, languageIndex + 1);
      const nextContent = contentIndex === -1 ? null : (queue[contentIndex]?.trim() || null);
      if (looksLikeConfigLanguageLine(language, nextContent)) {
        output.push(`\`\`\`${language}`);
        inFence = true;
        fenceLanguage = language;
        jsonBraceBalance = 0;
        index = languageIndex;
        changed = true;
        continue;
      }
    }

    const before = line.slice(0, openIndex).trimEnd();
    const afterMarker = line.slice(openIndex + 3).trimStart();
    let markerEnd = 0;
    while (markerEnd < afterMarker.length && markerEnd < 24 && isFenceLanguageChar(afterMarker[markerEnd] ?? '')) {
      markerEnd++;
    }
    const candidateLanguage = afterMarker.slice(0, markerEnd);
    let language = candidateLanguage;
    let remainder = afterMarker.slice(markerEnd);
    const normalizedLanguage = candidateLanguage.toLowerCase();
    if (candidateLanguage && !KNOWN_FENCE_LANGUAGES.has(normalizedLanguage)) {
      if (normalizedLanguage === 'npx') {
        language = 'bash';
        remainder = afterMarker;
      } else if (/^[a-z][a-z0-9_.#+-]{0,23}$/.test(candidateLanguage) && !remainder.trim()) {
        language = candidateLanguage;
      } else {
        language = 'text';
        remainder = afterMarker;
      }
    }
    const marker = language ? `\`\`\`${language}` : '```';

    if (before) {
      output.push(before);
      output.push('');
      changed = true;
    }
    output.push(marker);
    inFence = true;
    fenceLanguage = language.toLowerCase();
    jsonBraceBalance = 0;

    if (remainder.trim()) {
      queue.splice(index + 1, 0, remainder.trimStart());
      changed = true;
    }

    if (trimmed !== marker) {
      changed = true;
    }
  }

  if (inFence) {
    output.push('```');
    changed = true;
    warnings.push('Auto-closed unbalanced fenced code block');
  }

  if (changed) {
    warnings.push('Repaired technical code-fence boundaries');
  }

  return output.join('\n');
}

export function normalizeTechnicalMarkdownBlocks(markdown: string, warnings: string[]): string {
  if (!markdown) {
    return markdown;
  }

  let result = markdown;
  result = repairCollapsedSatoriMcpConfig(result, warnings);
  result = repairFenceBoundaries(result, warnings);
  return result;
}
