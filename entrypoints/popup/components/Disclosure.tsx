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
    <div className="border border-border rounded-lg bg-muted/20">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between p-3 text-left hover:bg-accent rounded-lg"
        aria-expanded={open}
      >
        <div>
          <div className="text-sm font-medium text-foreground">{title}</div>
          {description && (
            <div className="text-xs text-muted-foreground mt-0.5">{description}</div>
          )}
        </div>
        <span className={`ml-3 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>
      {open && (
        <div className="p-3 border-t border-border">
          {children}
        </div>
      )}
    </div>
  );
}


