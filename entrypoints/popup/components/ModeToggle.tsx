import React from 'react';

interface ModeToggleProps {
  mode: 'general' | 'code_docs';
  onChange: (mode: 'general' | 'code_docs') => void;
}

export function ModeToggle({ mode, onChange }: ModeToggleProps) {
  return (
    <div className="flex bg-gray-100 rounded-lg p-1">
      <button
        className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
          mode === 'general'
            ? 'bg-white text-gray-900 shadow-sm'
            : 'text-gray-600 hover:text-gray-900'
        }`}
        onClick={() => onChange('general')}
      >
        General
      </button>
      <button
        className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
          mode === 'code_docs'
            ? 'bg-white text-gray-900 shadow-sm'
            : 'text-gray-600 hover:text-gray-900'
        }`}
        onClick={() => onChange('code_docs')}
      >
        Code & Docs
      </button>
    </div>
  );
}
