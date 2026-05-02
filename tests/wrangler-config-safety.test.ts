import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('worker wrangler config safety', () => {
  it.each(['wrangler.ai-proxy.toml', 'wrangler.credit-service.toml'])(
    'does not publish local placeholder secrets through %s deploy vars',
    (path) => {
      const config = readFileSync(path, 'utf8');

      expect(config).not.toContain('local-secret-string');
      expect(config).not.toContain('replace-me-for-local-dev');
    },
  );

  it('routes ai-proxy production endpoints to the worker', () => {
    const config = readFileSync('wrangler.ai-proxy.toml', 'utf8');

    expect(config).toContain('promptready.app/api/proxy');
    expect(config).toContain('promptready.app/byok/proxy');
  });

  it('does not require metered-mode bindings to deploy the BYOK proxy route', () => {
    const config = readFileSync('wrangler.ai-proxy.toml', 'utf8');

    expect(config).not.toContain('CREDIT_SERVICE');
    expect(config).not.toContain('credit-service');
    expect(config).not.toContain('BUDGET_KV');
    expect(config).not.toContain('[[kv_namespaces]]');
  });
});
