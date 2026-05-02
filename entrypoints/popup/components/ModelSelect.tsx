import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { browser } from 'wxt/browser';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ChevronsUpDown, Check, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

type Item = {
  id: string;
  name: string;
  isFree?: boolean;
  contextLength?: number;
};
type RuntimeMessage = {
  type?: 'MODELS_RESULT' | 'ERROR' | string;
  payload?: {
    models?: Item[];
    message?: string;
    freeOnly?: boolean;
  };
};

const MODELS_CACHE_TTL_MS = 10 * 60 * 1000;

interface ModelSelectProps {
  value: string;
  onChange: (value: string) => void;
  apiBase: string;
  freeOnly?: boolean;
}

export function ModelSelect({ value, onChange, apiBase, freeOnly = false }: ModelSelectProps) {
  const [models, setModels] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  // Tests run in an environment where `browser` may be undefined or missing runtime APIs.
  // Guard all runtime/storage interactions so unit tests do not throw.
  const hasBrowserRuntime =
    typeof browser !== 'undefined' &&
    Boolean(browser?.runtime?.onMessage && browser?.runtime?.sendMessage);

  const fetchModels = useCallback(async (forceRefresh = false) => {
    if (!hasBrowserRuntime) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      await browser.runtime.sendMessage({
        type: 'FETCH_MODELS',
        payload: { provider: 'openrouter', apiBase, freeOnly, forceRefresh },
      });
    } catch {
      setLoading(false);
    }
  }, [apiBase, freeOnly, hasBrowserRuntime]);

  useEffect(() => {
    const handler = (message: RuntimeMessage) => {
      if (message?.type === 'MODELS_RESULT') {
        if (typeof message.payload?.freeOnly === 'boolean' && message.payload.freeOnly !== freeOnly) {
          return;
        }

        const items = (message.payload?.models || []) as Item[];
        setModels(items);
        setLoading(false);
      }
      if (message?.type === 'ERROR') {
        setLoading(false);
        console.warn('[ModelSelect] Error:', message?.payload?.message);
      }
    };
    if (!hasBrowserRuntime) {
      // No browser runtime in this environment (tests); avoid registering listeners or fetching.
      return;
    }

    browser.runtime.onMessage.addListener(handler);
    const cacheKey = freeOnly ? 'openrouter_models_free' : 'openrouter_models_all';

    (async () => {
      try {
        const metaKey = `${cacheKey}_meta`;
        const sess = await browser.storage.session.get([cacheKey, metaKey]);
        const cachedValue = sess?.[cacheKey];
        const rawMeta = sess?.[metaKey] as { timestamp?: unknown } | undefined;

        const cached = Array.isArray(cachedValue)
          ? cachedValue.filter(
              (item): item is Item =>
                Boolean(item) &&
                typeof item === 'object' &&
                typeof (item as Item).id === 'string' &&
                typeof (item as Item).name === 'string'
            )
          : [];

        const timestamp = typeof rawMeta?.timestamp === 'number' ? rawMeta.timestamp : 0;
        const isFresh = Date.now() - timestamp < MODELS_CACHE_TTL_MS;

        if (cached.length > 0 && isFresh) {
          setModels(cached);
          setLoading(false);
        } else {
          await browser.runtime.sendMessage({
            type: 'FETCH_MODELS',
            payload: { provider: 'openrouter', apiBase, freeOnly },
          });
        }
      } catch {
        await browser.runtime.sendMessage({
          type: 'FETCH_MODELS',
          payload: { provider: 'openrouter', apiBase, freeOnly },
        });
      }
    })();

    return () => browser.runtime.onMessage.removeListener(handler);
  }, [apiBase, freeOnly, hasBrowserRuntime]);

  const options = useMemo(() => models, [models]);
  const selectedItem = useMemo(() => options.find(o => o.id === value), [options, value]);
  const selectedLabel = selectedItem ? (selectedItem.name || selectedItem.id) : (value || '');
  const showPlaceholder = !value;
  const placeholder = loading
    ? 'Loading…'
    : (options.length
      ? 'Select OpenRouter model'
      : 'No models available');
  const canUseManual = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return false;
    return !options.some(o =>
      o.id.toLowerCase() === q || (o.name || '').toLowerCase() === q
    );
  }, [options, query]);
  const handleSelect = (currentValue: string) => {
    onChange(currentValue);
    setOpen(false);
  };

  return (
    <div className="w-full min-w-0 space-y-2">
      <div className="flex w-full min-w-0 items-center gap-2">
        <div className="min-w-0 flex-1">
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={open}
                className="w-full min-w-0 justify-between gap-2 px-3"
              >
                <span className="min-w-0 flex-1 truncate text-left">
                  {showPlaceholder ? placeholder : selectedLabel}
                </span>
                <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-2rem)] p-0">
            <Command>
              <CommandInput
                placeholder="Search models..."
                value={query}
                onValueChange={setQuery}
                className="h-9"
              />
              <CommandList>
                <CommandEmpty>No model found.</CommandEmpty>
                <CommandGroup heading="OpenRouter Models">
                  {options.map((m) => {
                    const isSelected = m.id === value;
                    return (
                      <CommandItem
                        key={m.id}
                        value={`${m.name ?? m.id} ${m.id}`}
                        onSelect={() => handleSelect(m.id)}
                      >
                        <span className="min-w-0 flex-1 truncate">
                          {m.isFree ? `${m.name || m.id} · free` : (m.name || m.id)}
                        </span>
                        <Check className={cn('ml-auto h-4 w-4 shrink-0', isSelected ? 'opacity-100' : 'opacity-0')} />
                      </CommandItem>
                    );
                  })}
                  {canUseManual && (
                    <CommandItem
                      key="__manual__"
                      value={query}
                      onSelect={() => handleSelect(query.trim())}
                    >
                      <span className="min-w-0 flex-1 truncate">{`Use "${query.trim()}"`}</span>
                      <Check className={cn('ml-auto h-4 w-4 shrink-0', value === query.trim() ? 'opacity-100' : 'opacity-0')} />
                    </CommandItem>
                  )}
                </CommandGroup>
              </CommandList>
            </Command>
            </PopoverContent>
          </Popover>
        </div>
        <button
          type="button"
          aria-label="Refresh OpenRouter models"
          title="Refresh OpenRouter models"
          onClick={() => fetchModels(true)}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-60"
          disabled={loading}
        >
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
        </button>
      </div>
      {loading && <span className="block text-xs text-muted-foreground">Fetching models…</span>}
      {options.length === 0 && !loading && (
        <div>
          <span className="text-xs text-destructive">
            No models available. Try Refresh.
          </span>
        </div>
      )}
    </div>
  );
}
