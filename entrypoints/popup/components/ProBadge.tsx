import React from 'react';

interface ProBadgeProps {
  onClick?: () => void;
}

export function ProBadge({ onClick }: ProBadgeProps) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600 transition-all duration-200 shadow-sm hover:shadow-md"
    >
      <span className="mr-1">⭐</span>
      Pro
    </button>
  );
}
