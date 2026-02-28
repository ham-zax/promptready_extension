// Processing Profiles Component
// Exposes the powerful preset system to users for customizable processing

import React, { useState } from 'react';
import { Settings } from '@/lib/types';
import { Zap, Settings as SettingsIcon, Wrench, GraduationCap, MessageSquare, FileText, CheckCircle2, Circle, Info } from 'lucide-react';

interface ProcessingProfile {
  id: string;
  name: string;
  description: string;
  readabilityPreset: string;
  turndownPreset: string;
  category: 'general' | 'technical' | 'academic' | 'social';
}

interface ProcessingProfilesProps {
  settings: Settings;
  onSettingsChange: (settings: Partial<Settings>) => void;
}

// Predefined processing profiles that combine readability and turndown presets
const PROCESSING_PROFILES: ProcessingProfile[] = [
  {
    id: 'standard',
    name: 'Standard',
    description: 'Balanced processing for general web content like articles and blogs',
    readabilityPreset: 'standard',
    turndownPreset: 'standard',
    category: 'general',
  },
  {
    id: 'technical',
    name: 'Technical Documentation',
    description: 'Optimized for code documentation, API references, and technical guides',
    readabilityPreset: 'technical-documentation',
    turndownPreset: 'github-flavored',
    category: 'technical',
  },
  {
    id: 'academic',
    name: 'Academic Papers',
    description: 'Preserves citations, footnotes, and academic formatting',
    readabilityPreset: 'academic-papers',
    turndownPreset: 'academic',
    category: 'academic',
  },
  {
    id: 'social',
    name: 'Social Media',
    description: 'Handles social media posts, comments, and threaded discussions',
    readabilityPreset: 'social-media',
    turndownPreset: 'minimal',
    category: 'social',
  },
  {
    id: 'obsidian',
    name: 'Obsidian Notes',
    description: 'Formatted for Obsidian with internal links and note-taking features',
    readabilityPreset: 'standard',
    turndownPreset: 'obsidian',
    category: 'general',
  },
  {
    id: 'notion',
    name: 'Notion Pages',
    description: 'Optimized for importing into Notion with proper block formatting',
    readabilityPreset: 'standard',
    turndownPreset: 'notion',
    category: 'general',
  },
];

export function ProcessingProfiles({ settings, onSettingsChange }: ProcessingProfilesProps) {
  const selectedProfile = settings.processing?.profile || 'standard';
  const [showAdvanced, setShowAdvanced] = useState(true);

  const handleProfileChange = (profileId: string) => {
    const profile = PROCESSING_PROFILES.find(p => p.id === profileId);
    if (!profile) return;

    // Update settings with the selected profile
    onSettingsChange({
      processing: {
        profile: profileId,
        readabilityPreset: profile.readabilityPreset,
        turndownPreset: profile.turndownPreset,
        customOptions: {
          preserveCodeBlocks: true,
          includeImages: true,
          preserveTables: true,
          preserveLinks: true,
        },
      },
    });
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'technical': return <Wrench className="w-5 h-5 text-gray-500" />;
      case 'academic': return <GraduationCap className="w-5 h-5 text-gray-500" />;
      case 'social': return <MessageSquare className="w-5 h-5 text-gray-500" />;
      default: return <FileText className="w-5 h-5 text-gray-500" />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'technical': return 'bg-brand-surface text-brand-primary border-brand-border';
      case 'academic': return 'bg-brand-surface text-brand-primary border-brand-border';
      case 'social': return 'bg-green-50 text-green-700 border-green-200';
      default: return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Zap className="w-5 h-5 text-brand-primary" />
          <h4 className="font-semibold text-foreground">Processing Profiles</h4>
        </div>
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-xs text-brand-primary hover:text-brand-primary/80 font-medium transition-colors"
        >
          {showAdvanced ? 'Simple' : 'Advanced'}
        </button>
      </div>

      {/* Profile Selection */}
      <div className="space-y-3">
        {PROCESSING_PROFILES.map((profile) => (
          <div
            key={profile.id}
            className={`relative border rounded-xl p-3 cursor-pointer transition-all active:scale-[0.98] ${
              selectedProfile === profile.id
                ? 'border-brand-primary bg-brand-surface shadow-sm'
                : 'border-border hover:border-brand-border bg-card text-card-foreground hover:bg-accent'
            }`}
            onClick={() => handleProfileChange(profile.id)}
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex-shrink-0 text-muted-foreground">
                {getCategoryIcon(profile.category)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2 mb-1">
                  <h5 className="font-semibold text-sm text-foreground truncate">{profile.name}</h5>
                </div>
                <p className="text-xs text-muted-foreground leading-snug mb-2">{profile.description}</p>
                <div className="flex items-center space-x-2 mt-auto">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium border ${getCategoryColor(profile.category)}`}>
                    {profile.category}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-center h-full pt-1">
                {selectedProfile === profile.id ? (
                  <CheckCircle2 className="w-5 h-5 text-brand-primary" />
                ) : (
                  <Circle className="w-5 h-5 text-border" />
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Advanced Settings */}
      {showAdvanced && (
        <div className="border-t border-border pt-4 space-y-4">
          <div className="flex items-center space-x-2">
            <SettingsIcon className="w-4 h-4 text-muted-foreground" />
            <h5 className="font-medium text-sm text-foreground">Advanced Configuration</h5>
          </div>
          
          {/* Readability Preset */}
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">
              Content Extraction
            </label>
            <select
              value={settings.processing?.readabilityPreset || 'standard'}
              onChange={(e) => {
                onSettingsChange({
                  processing: {
                    ...settings.processing,
                    readabilityPreset: e.target.value,
                  } as any,
                });
              }}
              className="w-full px-3 py-2 bg-background text-foreground border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-brand-primary transition-all"
            >
              <option value="standard">Standard</option>
              <option value="technical-documentation">Technical Documentation</option>
              <option value="academic-papers">Academic Papers</option>
              <option value="social-media">Social Media</option>
              <option value="news-articles">News Articles</option>
            </select>
          </div>

          {/* Turndown Preset */}
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">
              Markdown Formatting
            </label>
            <select
              value={settings.processing?.turndownPreset || 'standard'}
              onChange={(e) => {
                onSettingsChange({
                  processing: {
                    ...settings.processing,
                    turndownPreset: e.target.value,
                  } as any,
                });
              }}
              className="w-full px-3 py-2 bg-background text-foreground border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-brand-primary transition-all"
            >
              <option value="standard">Standard Markdown</option>
              <option value="github-flavored">GitHub Flavored</option>
              <option value="obsidian">Obsidian</option>
              <option value="notion">Notion</option>
              <option value="academic">Academic</option>
              <option value="minimal">Minimal</option>
            </select>
          </div>

          {/* Capture Strategy */}
          <div className="bg-muted border border-border rounded-lg p-3">
            <h6 className="text-xs font-semibold text-foreground mb-3">Capture Strategy</h6>
            <label className="flex items-start space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.processing?.capturePolicy?.deepCaptureEnabled ?? false}
                onChange={(e) => {
                  onSettingsChange({
                    processing: {
                      ...settings.processing,
                      capturePolicy: {
                        ...settings.processing?.capturePolicy,
                        deepCaptureEnabled: e.target.checked,
                      },
                    } as any,
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

          {/* Custom Options */}
          <div className="bg-muted border border-border rounded-lg p-3">
            <h6 className="text-xs font-semibold text-foreground mb-3">Data Retention</h6>
            <div className="space-y-3">
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.processing?.customOptions?.preserveCodeBlocks ?? true}
                  onChange={(e) => {
                    onSettingsChange({
                      processing: {
                        ...settings.processing,
                        customOptions: {
                          ...settings.processing?.customOptions,
                          preserveCodeBlocks: e.target.checked,
                        },
                      } as any,
                    });
                  }}
                  className="w-4 h-4 rounded border-border text-brand-primary focus:ring-brand-primary"
                />
                <span className="text-sm text-foreground font-medium">Preserve code blocks</span>
              </label>
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.processing?.customOptions?.includeImages ?? true}
                  onChange={(e) => {
                    onSettingsChange({
                      processing: {
                        ...settings.processing,
                        customOptions: {
                          ...settings.processing?.customOptions,
                          includeImages: e.target.checked,
                        },
                      } as any,
                    });
                  }}
                  className="w-4 h-4 rounded border-border text-brand-primary focus:ring-brand-primary"
                />
                <span className="text-sm text-foreground font-medium">Include images</span>
              </label>
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.processing?.customOptions?.preserveTables ?? true}
                  onChange={(e) => {
                    onSettingsChange({
                      processing: {
                        ...settings.processing,
                        customOptions: {
                          ...settings.processing?.customOptions,
                          preserveTables: e.target.checked,
                        },
                      } as any,
                    });
                  }}
                  className="w-4 h-4 rounded border-border text-brand-primary focus:ring-brand-primary"
                />
                <span className="text-sm text-foreground font-medium">Preserve tables</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Profile Info */}
      {selectedProfile && (
        <div className="bg-brand-surface border border-brand-border rounded-lg p-3 mt-4">
          <div className="flex items-start space-x-3">
            <Info className="w-5 h-5 text-brand-primary mt-0.5" />
            <div>
              <p className="text-sm text-brand-primary font-semibold">
                {PROCESSING_PROFILES.find(p => p.id === selectedProfile)?.name} Profile Active
              </p>
              <p className="text-xs text-brand-primary/80 mt-1 leading-snug">
                This profile optimizes content extraction and formatting for your specific use case.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
