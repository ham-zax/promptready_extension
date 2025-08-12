import React from 'react';

interface ModeToggleProps {
  mode: 'offline' | 'ai';
  isPro: boolean;
  onChange: (mode: 'offline' | 'ai') => void;
  onUpgradePrompt: () => void;
}

export function ModeToggle({ mode, isPro, onChange, onUpgradePrompt }: ModeToggleProps) {
  const handleModeClick = (selectedMode: 'offline' | 'ai') => {
    if (selectedMode === 'ai' && !isPro) {
      onUpgradePrompt();
      return;
    }
    onChange(selectedMode);
  };

  return (
    <div className="flex items-center justify-center space-x-4 py-6">
      {/* Offline Mode Button */}
      <button
        onClick={() => handleModeClick('offline')}
        className={`flex items-center space-x-3 px-6 py-4 rounded-xl transition-all duration-200 ${
          mode === 'offline'
            ? 'bg-blue-50 border-2 border-blue-500 text-blue-700'
            : 'bg-gray-50 border-2 border-gray-200 text-gray-600 hover:bg-gray-100'
        }`}
      >
        <div className={`w-4 h-4 rounded-full border-2 ${
          mode === 'offline'
            ? 'bg-blue-500 border-blue-500'
            : 'border-gray-400'
        }`}>
          {mode === 'offline' && (
            <div className="w-full h-full rounded-full bg-white scale-50"></div>
          )}
        </div>
        <div className="text-left">
          <div className={`font-semibold text-sm ${
            mode === 'offline' ? 'text-blue-700' : 'text-gray-700'
          }`}>
            Offline
          </div>
          <div className={`text-xs ${
            mode === 'offline' ? 'text-blue-600' : 'text-gray-500'
          }`}>
            Free • Instant
          </div>
        </div>
      </button>

      {/* AI Mode Button */}
      <button
        onClick={() => handleModeClick('ai')}
        className={`flex items-center space-x-3 px-6 py-4 rounded-xl transition-all duration-200 relative ${
          mode === 'ai'
            ? 'bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-500 text-purple-700'
            : 'bg-gray-50 border-2 border-gray-200 text-gray-600 hover:bg-gray-100'
        }`}
      >
        <div className={`w-4 h-4 rounded-full border-2 ${
          mode === 'ai'
            ? 'bg-gradient-to-r from-purple-500 to-pink-500 border-purple-500'
            : 'border-gray-400'
        }`}>
          {mode === 'ai' && (
            <div className="w-full h-full rounded-full bg-white scale-50"></div>
          )}
        </div>
        <div className="text-left">
          <div className={`font-semibold text-sm flex items-center space-x-1 ${
            mode === 'ai' ? 'text-purple-700' : 'text-gray-700'
          }`}>
            <span>AI Mode</span>
            {!isPro && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-gradient-to-r from-purple-500 to-pink-500 text-white">
                Pro
              </span>
            )}
          </div>
          <div className={`text-xs ${
            mode === 'ai' ? 'text-purple-600' : 'text-gray-500'
          }`}>
            Enhanced • BYOK
          </div>
        </div>
      </button>
    </div>
  );
}
