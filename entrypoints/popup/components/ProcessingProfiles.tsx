import React, { useState } from 'react';
import { Settings } from '@/lib/types';
import {
  CONTENT_STRATEGIES,
  OUTPUT_FORMATS,
  normalizeProcessingSettings,
  resolveProcessingConfig,
  type ContentStrategyId,
  type OutputFormatId,
} from '@/lib/processing-profile-registry';
import { ChevronDown, Info, Settings as SettingsIcon, SlidersHorizontal, Zap } from 'lucide-react';

interface ProcessingProfilesProps {
  settings: Settings;
  onSettingsChange: (settings: Partial<Settings>) => void;
}

export function ProcessingProfiles({ settings, onSettingsChange }: ProcessingProfilesProps) {
  const currentProcessing = (settings.processing || {}) as Partial<NonNullable<Settings['processing']>>;
  const normalized = normalizeProcessingSettings(currentProcessing);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const updateProcessing = (updates: Partial<NonNullable<Settings['processing']>>) => {
    const nextBase = {
      ...currentProcessing,
      ...updates,
    };
    const resolved = resolveProcessingConfig(nextBase);

    onSettingsChange({
      processing: {
        ...currentProcessing,
        ...nextBase,
        ...resolved,
        customOptions: {
          preserveCodeBlocks: true,
          includeImages: true,
          preserveTables: true,
          preserveLinks: true,
          ...(currentProcessing.customOptions || {}),
          ...(updates.customOptions || {}),
        },
      } as NonNullable<Settings['processing']>,
    });
  };

  const handleStrategyChange = (contentStrategy: ContentStrategyId) => {
    updateProcessing({
      contentStrategy,
      outputFormat: normalized.outputFormat,
    });
  };

  const handleFormatChange = (outputFormat: OutputFormatId) => {
    updateProcessing({
      contentStrategy: normalized.contentStrategy,
      outputFormat,
    });
  };

  const selectedStrategy = CONTENT_STRATEGIES.find((strategy) => strategy.id === normalized.contentStrategy) || CONTENT_STRATEGIES[0];
  const selectedFormat = OUTPUT_FORMATS.find((format) => format.id === normalized.outputFormat) || OUTPUT_FORMATS[0];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Zap className="w-5 h-5 text-brand-primary" />
          <h4 className="font-semibold text-foreground">Processing Profiles</h4>
        </div>
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          aria-expanded={showAdvanced}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          {showAdvanced ? 'Hide advanced capture' : 'Advanced capture'}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3">
        <div className="space-y-1.5">
          <label htmlFor="content-strategy" className="block text-xs font-semibold text-foreground">
            Content strategy
          </label>
          <div className="relative">
            <select
              id="content-strategy"
              value={normalized.contentStrategy}
              onChange={(event) => handleStrategyChange(event.target.value as ContentStrategyId)}
              className="h-9 w-full appearance-none rounded-md border border-border bg-background px-3 pr-9 text-sm font-medium text-foreground shadow-sm outline-none transition-colors hover:bg-muted focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
            >
              {CONTENT_STRATEGIES.map((strategy) => (
                <option key={strategy.id} value={strategy.id}>
                  {strategy.name}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          </div>
          <p className="text-xs text-muted-foreground leading-snug">{selectedStrategy.description}</p>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="output-format" className="block text-xs font-semibold text-foreground">
            Output format
          </label>
          <div className="relative">
            <select
              id="output-format"
              value={normalized.outputFormat}
              onChange={(event) => handleFormatChange(event.target.value as OutputFormatId)}
              className="h-9 w-full appearance-none rounded-md border border-border bg-background px-3 pr-9 text-sm font-medium text-foreground shadow-sm outline-none transition-colors hover:bg-muted focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
            >
              {OUTPUT_FORMATS.map((format) => (
                <option key={format.id} value={format.id}>
                  {format.name}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          </div>
          <p className="text-xs text-muted-foreground leading-snug">{selectedFormat.description}</p>
        </div>
      </div>

      {showAdvanced && (
        <div className="border-t border-border pt-3 space-y-3">
          <div className="flex items-center space-x-2">
            <SettingsIcon className="w-4 h-4 text-muted-foreground" />
            <h5 className="font-medium text-sm text-foreground">Advanced capture</h5>
          </div>

          <div className="bg-muted border border-border rounded-lg p-3">
            <label className="flex items-start space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.processing?.capturePolicy?.deepCaptureEnabled ?? false}
                onChange={(e) => {
                  updateProcessing({
                    capturePolicy: {
                      ...settings.processing?.capturePolicy,
                      deepCaptureEnabled: e.target.checked,
                    } as NonNullable<Settings['processing']>['capturePolicy'],
                  });
                }}
                className="w-4 h-4 rounded border-border text-brand-primary focus:ring-brand-primary mt-0.5"
              />
              <div className="min-w-0">
                <span className="text-sm text-foreground font-medium">Enable deep capture (full-page only)</span>
                <p className="text-xs text-muted-foreground mt-1 leading-snug">
                  Performs bounded scroll-and-settle before snapshot selection. Selection captures remain exact and fast.
                </p>
              </div>
            </label>
          </div>

          <div className="bg-muted border border-border rounded-lg p-3">
            <h6 className="text-xs font-semibold text-foreground mb-3">Data Retention</h6>
            <div className="space-y-3">
              {([
                ['preserveCodeBlocks', 'Preserve code blocks'],
                ['includeImages', 'Include images'],
                ['preserveTables', 'Preserve tables'],
              ] as const).map(([key, label]) => (
                <label key={key} className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.processing?.customOptions?.[key] ?? true}
                    onChange={(e) => {
                      updateProcessing({
                        customOptions: {
                          ...settings.processing?.customOptions,
                          [key]: e.target.checked,
                        } as NonNullable<Settings['processing']>['customOptions'],
                      });
                    }}
                    className="w-4 h-4 rounded border-border text-brand-primary focus:ring-brand-primary"
                  />
                  <span className="text-sm text-foreground font-medium">{label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="bg-brand-surface border border-brand-border rounded-lg p-3 mt-4">
        <div className="flex items-start space-x-3">
          <Info className="w-5 h-5 text-brand-primary mt-0.5" />
          <div>
            <p className="text-sm text-brand-primary font-semibold">
              {normalized.contentStrategy === 'auto' ? 'Auto' : normalized.contentStrategy} to {normalized.outputFormat}
            </p>
            <p className="text-xs text-brand-primary/80 mt-1 leading-snug">
              Page extraction and Markdown output are configured independently.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
