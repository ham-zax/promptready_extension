import React, { useState } from 'react';

interface DisclosureProps {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export function Disclosure({ title, description, defaultOpen = false, children }: DisclosureProps) {
  const [open, setOpen] = useState<boolean>(defaultOpen);

  return (
    <div className="border border-gray-200 rounded-lg">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-50 rounded-lg"
        aria-expanded={open}
      >
        <div>
          <div className="text-sm font-medium text-gray-900">{title}</div>
          {description && (
            <div className="text-xs text-gray-500 mt-0.5">{description}</div>
          )}
        </div>
        <span className={`ml-3 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>
      {open && (
        <div className="p-3 border-t border-gray-200">
          {children}
        </div>
      )}
    </div>
  );
}


