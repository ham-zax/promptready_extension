import path from 'node:path';

const LINTABLE_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
]);

const IGNORED_DIR_PATTERNS = [
  /^node_modules\//,
  /^dist\//,
  /^coverage\//,
  /^output\//,
  /^\.wxt\//,
  /^\.git\//,
];

export function toPosixPath(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}

export function isLintablePath(filePath: string): boolean {
  const normalized = toPosixPath(filePath.trim());
  if (!normalized) {
    return false;
  }
  if (IGNORED_DIR_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return false;
  }
  return LINTABLE_EXTENSIONS.has(path.extname(normalized));
}

export function filterLintablePaths(paths: string[]): string[] {
  const unique = new Set<string>();
  for (const filePath of paths) {
    const normalized = toPosixPath(filePath.trim());
    if (!isLintablePath(normalized)) {
      continue;
    }
    unique.add(normalized);
  }
  return Array.from(unique).sort((a, b) => a.localeCompare(b));
}

export function chunkPaths(paths: string[], chunkSize = 40): string[][] {
  const safeChunkSize = Math.max(1, Math.floor(chunkSize));
  const chunks: string[][] = [];
  for (let index = 0; index < paths.length; index += safeChunkSize) {
    chunks.push(paths.slice(index, index + safeChunkSize));
  }
  return chunks;
}
