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
import { CheckCircle2, Circle, FileText, Info, Settings as SettingsIcon, Zap } from 'lucide-react';

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

  const renderChoiceButton = (
    item: { id: string; name: string; description: string },
    selected: boolean,
    onClick: () => void
  ) => (
    <button
      key={item.id}
      type="button"
      onClick={onClick}
      className={`w-full text-left border rounded-lg p-3 transition-all active:scale-[0.98] ${
        selected
          ? 'border-brand-primary bg-brand-surface shadow-sm'
          : 'border-border bg-card text-card-foreground hover:bg-accent hover:border-brand-border'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 text-muted-foreground">
          <FileText className="w-4 h-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-foreground">{item.name}</div>
          <div className="text-xs text-muted-foreground mt-1 leading-snug">{item.description}</div>
        </div>
        {selected ? (
          <CheckCircle2 className="w-5 h-5 text-brand-primary flex-shrink-0" />
        ) : (
          <Circle className="w-5 h-5 text-border flex-shrink-0" />
        )}
      </div>
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Zap className="w-5 h-5 text-brand-primary" />
          <h4 className="font-semibold text-foreground">Processing Profiles</h4>
        </div>
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-xs text-brand-primary hover:text-brand-primary/80 font-medium transition-colors"
        >
          {showAdvanced ? 'Hide Advanced' : 'Advanced'}
        </button>
      </div>

      <div className="space-y-3">
        <div>
          <h5 className="text-xs font-semibold text-foreground mb-2">Content Strategy</h5>
          <div className="grid grid-cols-1 gap-2">
            {CONTENT_STRATEGIES.map((strategy) =>
              renderChoiceButton(
                strategy,
                normalized.contentStrategy === strategy.id,
                () => handleStrategyChange(strategy.id as ContentStrategyId)
              )
            )}
          </div>
        </div>

        <div>
          <h5 className="text-xs font-semibold text-foreground mb-2">Output Format</h5>
          <div className="grid grid-cols-1 gap-2">
            {OUTPUT_FORMATS.map((format) =>
              renderChoiceButton(
                format,
                normalized.outputFormat === format.id,
                () => handleFormatChange(format.id as OutputFormatId)
              )
            )}
          </div>
        </div>
      </div>

      <div className="bg-muted border border-border rounded-lg p-3">
        <h6 className="text-xs font-semibold text-foreground mb-3">Capture Strategy</h6>
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

      {showAdvanced && (
        <div className="border-t border-border pt-4 space-y-4">
          <div className="flex items-center space-x-2">
            <SettingsIcon className="w-4 h-4 text-muted-foreground" />
            <h5 className="font-medium text-sm text-foreground">Advanced Configuration</h5>
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
