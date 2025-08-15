import React from 'react';

export type ByokProvider = 'openrouter' | 'custom';

interface ByokChoiceProps {
  onChoose: (provider: ByokProvider) => void;
  onClose: () => void;
}

export default function ByokChoice({ onChoose, onClose }: ByokChoiceProps) {
  return (
    <div className="p-4 text-center">
      <h3 className="font-medium text-gray-800">Connect your AI Provider</h3>
      <p className="text-sm text-gray-500 mt-1 mb-4">
        Choose a provider to get started.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => onChoose('openrouter')}
          className="p-3 border rounded-lg hover:bg-gray-50 text-center"
          aria-label="Choose OpenRouter"
        >
          <span className="text-2xl">🌀</span>
          <span className="block text-sm font-medium mt-1">OpenRouter</span>
        </button>
        <button
          onClick={() => onChoose('custom')}
          className="p-3 border rounded-lg hover:bg-gray-50 text-center"
          aria-label="Choose Manual provider"
        >
          <span className="text-2xl">⚙️</span>
          <span className="block text-sm font-medium mt-1">Manual</span>
        </button>
      </div>
      <div className="mt-3">
        <button
          onClick={onClose}
          className="text-xs text-gray-600 hover:underline"
        >
          Close
        </button>
      </div>
    </div>
  );
}