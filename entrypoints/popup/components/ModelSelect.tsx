import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { browser } from 'wxt/browser';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ChevronsUpDown, Check } from 'lucide-react';
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
}

export function ModelSelect({ value, onChange, apiBase }: ModelSelectProps) {
  const [models, setModels] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [freeOnly, setFreeOnly] = useState(true);

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
      ? (freeOnly ? 'Select free OpenRouter model' : 'Select OpenRouter model')
      : 'No models (check API key/network)');
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
    <div className="space-y-2">
      <div className="flex items-center space-x-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-[260px] justify-between"
            >
              {showPlaceholder ? placeholder : selectedLabel}
              <ChevronsUpDown className="opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[320px] p-0">
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
                        {m.isFree ? `${m.name || m.id} · free` : (m.name || m.id)}
                        <Check className={cn('ml-auto', isSelected ? 'opacity-100' : 'opacity-0')} />
                      </CommandItem>
                    );
                  })}
                  {canUseManual && (
                    <CommandItem
                      key="__manual__"
                      value={query}
                      onSelect={() => handleSelect(query.trim())}
                    >
                      {`Use "${query.trim()}"`}
                      <Check className={cn('ml-auto', value === query.trim() ? 'opacity-100' : 'opacity-0')} />
                    </CommandItem>
                  )}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        <button
          onClick={() => fetchModels(true)}
          className="px-2 py-1 text-xs rounded border bg-background text-foreground border-input hover:bg-accent hover:text-accent-foreground"
        >
          Refresh
        </button>
        <button
          onClick={() => setFreeOnly((prev) => !prev)}
          className={cn(
            'px-2 py-1 text-xs rounded border transition-colors',
            freeOnly
              ? 'bg-emerald-600/10 text-emerald-700 border-emerald-600/20 hover:bg-emerald-600/20'
              : 'bg-background text-foreground border-input hover:bg-accent hover:text-accent-foreground',
          )}
        >
          {freeOnly ? 'Free only' : 'All models'}
        </button>
        {loading && <span className="text-xs text-muted-foreground">Fetching…</span>}
      </div>
      {options.length === 0 && !loading && (
        <div>
          <span className="text-xs text-destructive">
            {freeOnly
              ? 'No free models received. Check API key/network or switch to All models.'
              : 'No models received. Save API key and refresh.'}
          </span>
        </div>
      )}
    </div>
  );
}
