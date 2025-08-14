// Processing Profiles Component
// Exposes the powerful preset system to users for customizable processing

import React, { useState, useEffect } from 'react';
import { Settings } from '@/lib/types';

interface ProcessingProfile {
  id: string;
  name: string;
  description: string;
  readabilityPreset: string;
  turndownPreset: string;
  category: 'general' | 'technical' | 'academic' | 'social';
  isPro?: boolean;
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
    isPro: true,
  },
  {
    id: 'academic',
    name: 'Academic Papers',
    description: 'Preserves citations, footnotes, and academic formatting',
    readabilityPreset: 'academic-papers',
    turndownPreset: 'academic',
    category: 'academic',
    isPro: true,
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
    isPro: true,
  },
  {
    id: 'notion',
    name: 'Notion Pages',
    description: 'Optimized for importing into Notion with proper block formatting',
    readabilityPreset: 'standard',
    turndownPreset: 'notion',
    category: 'general',
    isPro: true,
  },
];

export function ProcessingProfiles({ settings, onSettingsChange }: ProcessingProfilesProps) {
  const [selectedProfile, setSelectedProfile] = useState<string>('standard');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Load current profile from settings
  useEffect(() => {
    const currentProfile = settings.processing?.profile || 'standard';
    setSelectedProfile(currentProfile);
  }, [settings]);

  const handleProfileChange = (profileId: string) => {
    const profile = PROCESSING_PROFILES.find(p => p.id === profileId);
    if (!profile) return;

    // 🔓 Pro features unlocked for testing/development
    // if (profile.isPro && !settings.isPro) {
    //   console.log('Pro feature - show upgrade modal');
    //   return;
    // }

    setSelectedProfile(profileId);

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
      case 'technical': return '🔧';
      case 'academic': return '🎓';
      case 'social': return '💬';
      default: return '📄';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'technical': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'academic': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'social': return 'bg-green-100 text-green-700 border-green-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="text-sm">⚡</span>
          <h4 className="font-medium text-gray-800">Processing Profiles</h4>
          {!settings.isPro && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gradient-to-r from-purple-500 to-pink-500 text-white">
              Pro
            </span>
          )}
        </div>
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-xs text-blue-600 hover:text-blue-800"
        >
          {showAdvanced ? 'Simple' : 'Advanced'}
        </button>
      </div>

      {/* Profile Selection */}
      <div className="space-y-3">
        {PROCESSING_PROFILES.map((profile) => (
          <div
            key={profile.id}
            className={`relative border rounded-lg p-3 cursor-pointer transition-all ${
              selectedProfile === profile.id
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            } ${profile.isPro && !settings.isPro ? 'opacity-60' : ''}`}
            onClick={() => handleProfileChange(profile.id)}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-1">
                  <span className="text-lg">{getCategoryIcon(profile.category)}</span>
                  <h5 className="font-medium text-gray-900">{profile.name}</h5>
                  {profile.isPro && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">
                      Pro
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600 mb-2">{profile.description}</p>
                <div className="flex items-center space-x-2">
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getCategoryColor(profile.category)}`}>
                    {profile.category}
                  </span>
                </div>
              </div>
              <div className="flex items-center">
                <div className={`w-4 h-4 rounded-full border-2 ${
                  selectedProfile === profile.id
                    ? 'border-blue-500 bg-blue-500'
                    : 'border-gray-300'
                }`}>
                  {selectedProfile === profile.id && (
                    <div className="w-2 h-2 bg-white rounded-full m-0.5"></div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Advanced Settings */}
      {showAdvanced && (
        <div className="border-t pt-4 space-y-3">
          <h5 className="font-medium text-gray-800">Advanced Configuration</h5>
          
          {/* Readability Preset */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
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
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="standard">Standard</option>
              <option value="technical-documentation">Technical Documentation</option>
              <option value="academic-papers">Academic Papers</option>
              <option value="social-media">Social Media</option>
              <option value="news-articles">News Articles</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              How content is extracted from the webpage
            </p>
          </div>

          {/* Turndown Preset */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
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
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="standard">Standard Markdown</option>
              <option value="github-flavored">GitHub Flavored</option>
              <option value="obsidian">Obsidian</option>
              <option value="notion">Notion</option>
              <option value="academic">Academic</option>
              <option value="minimal">Minimal</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              How HTML is converted to Markdown
            </p>
          </div>

          {/* Custom Options */}
          <div className="bg-gray-50 rounded-md p-3">
            <h6 className="text-sm font-medium text-gray-700 mb-2">Custom Options</h6>
            <div className="space-y-2">
              <label className="flex items-center space-x-2">
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
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-600">Preserve code blocks</span>
              </label>
              <label className="flex items-center space-x-2">
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
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-600">Include images</span>
              </label>
              <label className="flex items-center space-x-2">
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
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-600">Preserve tables</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Profile Info */}
      {selectedProfile && (
        <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
          <div className="flex items-start space-x-2">
            <span className="text-blue-500 mt-0.5">ℹ️</span>
            <div>
              <p className="text-sm text-blue-700 font-medium">
                {PROCESSING_PROFILES.find(p => p.id === selectedProfile)?.name} Profile Active
              </p>
              <p className="text-xs text-blue-600 mt-1">
                This profile optimizes content extraction and formatting for your specific use case.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
