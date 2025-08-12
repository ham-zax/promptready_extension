import React from 'react';

interface ModeToggleProps {
  mode: 'general' | 'code_docs';
  onChange: (mode: 'general' | 'code_docs') => void;
}

export function ModeToggle({ mode, onChange }: ModeToggleProps) {
  return (
    <div className="flex bg-muted rounded-lg p-1 border border-border">
      <button
        className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
          mode === 'general'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        }`}
        onClick={() => onChange('general')}
      >
        General
      </button>
      <button
        className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
          mode === 'code_docs'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        }`}
        onClick={() => onChange('code_docs')}
      >
        Code & Docs
      </button>
    </div>
  );
}
