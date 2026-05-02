import { describe, expect, it } from 'vitest';
import {
  normalizeProcessingSettings,
  resolveProcessingConfig,
} from '@/lib/processing-profile-registry';

describe('processing profile registry', () => {
  it('maps legacy profiles to content strategy and output format selections', () => {
    expect(normalizeProcessingSettings({ profile: 'standard' })).toMatchObject({
      profile: 'standard',
      contentStrategy: 'auto',
      outputFormat: 'clean-markdown',
      readabilityPreset: 'standard',
      turndownPreset: 'standard',
    });

    expect(normalizeProcessingSettings({ profile: 'technical' })).toMatchObject({
      profile: 'technical',
      contentStrategy: 'technical',
      outputFormat: 'github',
      readabilityPreset: 'technical-documentation',
      turndownPreset: 'github',
    });

    expect(normalizeProcessingSettings({ profile: 'obsidian' })).toMatchObject({
      profile: 'obsidian',
      contentStrategy: 'auto',
      outputFormat: 'obsidian',
      readabilityPreset: 'standard',
      turndownPreset: 'obsidian',
    });
  });

  it('resolves strategy and format independently from legacy profile names', () => {
    const resolved = resolveProcessingConfig({
      profile: 'standard',
      contentStrategy: 'technical',
      outputFormat: 'clean-markdown',
      readabilityPreset: 'standard',
      turndownPreset: 'standard',
    });

    expect(resolved).toMatchObject({
      contentStrategy: 'technical',
      outputFormat: 'clean-markdown',
      readabilityPreset: 'technical-documentation',
      turndownPreset: 'github',
    });
  });

  it('uses thread strategy without the old minimal markdown stripping preset', () => {
    const resolved = resolveProcessingConfig({
      contentStrategy: 'thread',
      outputFormat: 'clean-markdown',
    });

    expect(resolved.readabilityPreset).toBe('forum-discussion');
    expect(resolved.turndownPreset).toBe('standard');
  });
});
