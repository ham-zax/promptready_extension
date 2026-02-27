export interface OpenRouterModelOption {
  id: string;
  name: string;
  isFree: boolean;
  contextLength?: number;
}

interface SelectModelOptions {
  freeOnly?: boolean;
}

const FREE_ROUTER_OPTION: OpenRouterModelOption = {
  id: 'openrouter/free',
  name: 'OpenRouter Free Router (auto)',
  isFree: true,
};

const DEFAULT_FALLBACK_FREE_OPTIONS: ReadonlyArray<OpenRouterModelOption> = [
  FREE_ROUTER_OPTION,
  {
    id: 'arcee-ai/trinity-large-preview:free',
    name: 'Arcee: Trinity Large Preview (Free)',
    isFree: true,
  },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value !== 'string') {
    return null;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isFreePricingTier(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }

  const pricingKeys = ['prompt', 'completion', 'request', 'image', 'input_cache_read'];
  let hasPricingField = false;

  for (const key of pricingKeys) {
    if (!(key in value)) {
      continue;
    }
    hasPricingField = true;
    const numeric = toFiniteNumber(value[key]);
    if (numeric === null || numeric > 0) {
      return false;
    }
  }

  return hasPricingField;
}

function isFreePricing(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some((tier) => isFreePricingTier(tier));
  }
  return isFreePricingTier(value);
}

export function isOpenRouterFreeModel(id: string, pricing?: unknown): boolean {
  const normalizedId = id.trim().toLowerCase();
  if (!normalizedId) {
    return false;
  }

  if (normalizedId === 'openrouter/free' || normalizedId.endsWith(':free')) {
    return true;
  }

  return isFreePricing(pricing);
}

function parseModelOption(value: unknown): OpenRouterModelOption | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = typeof value.id === 'string' ? value.id.trim() : '';
  if (!id) {
    return null;
  }

  const name = typeof value.name === 'string' && value.name.trim() ? value.name.trim() : id;
  const rawContextLength = toFiniteNumber(value.context_length);

  return {
    id,
    name,
    isFree: isOpenRouterFreeModel(id, value.pricing),
    contextLength: rawContextLength === null ? undefined : Math.floor(rawContextLength),
  };
}

function extractModelEntries(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (isRecord(payload) && Array.isArray(payload.data)) {
    return payload.data;
  }
  return [];
}

function sortModelOptions(models: OpenRouterModelOption[]): OpenRouterModelOption[] {
  return models.sort((a, b) => {
    if (a.isFree !== b.isFree) {
      return a.isFree ? -1 : 1;
    }

    const byName = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    if (byName !== 0) {
      return byName;
    }

    return a.id.localeCompare(b.id, undefined, { sensitivity: 'base' });
  });
}

export function fallbackOpenRouterFreeModelOptions(): OpenRouterModelOption[] {
  return DEFAULT_FALLBACK_FREE_OPTIONS.map((model) => ({ ...model }));
}

export function selectOpenRouterModelOptions(
  payload: unknown,
  options: SelectModelOptions = {},
): OpenRouterModelOption[] {
  const entries = extractModelEntries(payload);
  const deduped = new Map<string, OpenRouterModelOption>();

  for (const entry of entries) {
    const parsed = parseModelOption(entry);
    if (!parsed) {
      continue;
    }

    if (!deduped.has(parsed.id)) {
      deduped.set(parsed.id, parsed);
    }
  }

  if (!deduped.has(FREE_ROUTER_OPTION.id)) {
    deduped.set(FREE_ROUTER_OPTION.id, { ...FREE_ROUTER_OPTION });
  }

  let models = Array.from(deduped.values());
  if (options.freeOnly) {
    models = models.filter((model) => model.isFree);
    if (models.length === 0) {
      return fallbackOpenRouterFreeModelOptions();
    }
  }

  return sortModelOptions(models);
}
