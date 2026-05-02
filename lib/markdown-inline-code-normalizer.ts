export function normalizeInlineCodeSpacing(markdown: string, warnings: string[]): string {
  if (!markdown) {
    return markdown;
  }

  const lines = markdown.split('\n');
  const output: string[] = [];
  let inFence = false;
  let changed = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^```/.test(trimmed)) {
      inFence = !inFence;
      output.push(line);
      continue;
    }

    if (inFence) {
      output.push(line);
      continue;
    }

    const next = line
      .replace(/(^|[^`A-Za-z0-9_])([A-Z][A-Z0-9_]{2,})`(?=[A-Za-z])/g, '$1`$2` ')
      .replace(/([A-Za-z0-9)\]])`(?=[^`\n]+`)/g, '$1 `')
      .replace(/`([A-Za-z0-9_./:-][^`\n]*?)`(?=[A-Za-z0-9])/g, '`$1` ')
      .replace(/`([^`\n]+)`,`/g, '`$1`, `')
      .replace(/,`(?=[^`\n]+`)/g, ', `')
      .replace(/`\s+([^`\n]*?)`/g, '`$1`')
      .replace(/`([^`\n]*?)\s+`/g, '`$1`')
      .replace(/, `\s+/g, ', `')
      .replace(/\b(and|or) `\s+/g, '$1 `')
      .replace(/`([A-Za-z0-9_./:-][^`\n]*?)`(?=[A-Za-z0-9])/g, '`$1` ');

    if (next !== line) {
      changed = true;
    }
    output.push(next);
  }

  if (changed) {
    warnings.push('Normalized inline code spacing in markdown');
  }

  return output.join('\n');
}
