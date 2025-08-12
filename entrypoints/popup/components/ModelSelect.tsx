import React, { useEffect, useMemo, useState } from 'react';
import { browser } from 'wxt/browser';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ChevronsUpDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

type Item = { id: string; name: string };

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

  useEffect(() => {
    const handler = (message: any) => {
      if (message?.type === 'MODELS_RESULT') {
        const items = (message.payload?.models || []) as Item[];
        setModels(items);
        setLoading(false);
      }
      if (message?.type === 'ERROR') {
        setLoading(false);
        console.warn('[ModelSelect] Error:', message?.payload?.message);
      }
    };
    browser.runtime.onMessage.addListener(handler);
    (async () => {
      try {
        const sess = await browser.storage.session.get(['openrouter_models']);
        const cached = (sess?.openrouter_models || []) as Item[];
        if (Array.isArray(cached) && cached.length) {
          setModels(cached);
          setLoading(false);
        } else {
          await fetchModels();
        }
      } catch {
        await fetchModels();
      }
    })();
    return () => browser.runtime.onMessage.removeListener(handler);
  }, []);

  const fetchModels = async () => {
    try {
      setLoading(true);
      await browser.runtime.sendMessage({ type: 'FETCH_MODELS', payload: { provider: 'openrouter', apiBase } });
    } catch {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchModels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBase]);

  const options = useMemo(() => models, [models]);
  const selectedItem = useMemo(() => options.find(o => o.id === value), [options, value]);
  const selectedLabel = selectedItem ? (selectedItem.name || selectedItem.id) : (value || '');
  const showPlaceholder = !value;
  const placeholder = loading ? 'Loading…' : (options.length ? 'Select OpenRouter model' : 'No models (check API key)');
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
                        {m.name || m.id}
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
          onClick={fetchModels}
          className="px-2 py-1 text-xs rounded border bg-background text-foreground border-input hover:bg-accent hover:text-accent-foreground"
        >
          Refresh
        </button>
        {loading && <span className="text-xs text-muted-foreground">Fetching…</span>}
      </div>
      {options.length === 0 && !loading && (
        <div>
          <span className="text-xs text-destructive">No models received. Save API key and Reload extension.</span>
        </div>
      )}
    </div>
  );
}


