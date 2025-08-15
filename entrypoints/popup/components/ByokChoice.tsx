import React from 'react';

export type ByokProvider = 'openrouter' | 'custom';

interface ByokChoiceProps {
  onChoose: (provider: ByokProvider) => void;
  onClose?: () => void;
}

/**
 * BYOK Choice View
 * - Presents two clear choices: OpenRouter or Manual
 * - Minimal, accessible, and consistent with the spec's progressive disclosure approach
 */
export function ByokChoice({ onChoose, onClose }: ByokChoiceProps) {
  return (
    <div className="space-y-4 p-3">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-gray-800">Connect your AI Provider</h4>
        {onClose && (
          <button
            aria-label="Close"
            onClick={onClose}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Close
          </button>
        )}
      </div>

      <p className="text-sm text-gray-600">
        Choose a provider to continue. OpenRouter will fetch your available models automatically. Manual lets you enter a custom API base, key and model name.
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button
          onClick={() => onChoose('openrouter')}
          className="flex flex-col items-start p-3 border border-gray-200 rounded-lg hover:shadow-sm text-left focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <div className="flex items-center space-x-2">
            <span className="text-xl">🔗</span>
            <div>
              <div className="font-medium">OpenRouter</div>
              <div className="text-xs text-gray-500">Paste your OpenRouter key and pick from your available models.</div>
            </div>
          </div>
        </button>

        <button
          onClick={() => onChoose('custom')}
          className="flex flex-col items-start p-3 border border-gray-200 rounded-lg hover:shadow-sm text-left focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <div className="flex items-center space-x-2">
            <span className="text-xl">🛠️</span>
            <div>
              <div className="font-medium">Manual</div>
              <div className="text-xs text-gray-500">Enter API Base URL, API Key, and Model Name for custom providers.</div>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}

export default ByokChoice;