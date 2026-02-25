import React from 'react';
import { Crown } from 'lucide-react';

interface ProBadgeProps {
  onClick?: () => void;
}

export function ProBadge({ onClick }: ProBadgeProps) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center px-2 py-1 rounded-full text-[11px] font-semibold bg-amber-500 text-amber-950 hover:bg-amber-600 transition-all duration-200 shadow-sm active:scale-95"
    >
      <Crown className="w-3 h-3 mr-1" />
      PRO
    </button>
  );
}
