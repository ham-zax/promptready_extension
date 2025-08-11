import React from 'react';
import { ProcessingState } from '@/lib/types';

interface StatusStripProps {
  processing: ProcessingState;
  lastAction?: string;
}

export function StatusStrip({ processing, lastAction }: StatusStripProps) {
  const getStatusDisplay = () => {
    switch (processing.status) {
      case 'capturing':
        return { icon: '⏳', text: 'Capturing content...', color: 'text-blue-600' };
      case 'cleaning':
        return { icon: '🧹', text: 'Cleaning content...', color: 'text-blue-600' };
      case 'structuring':
        return { icon: '🏗️', text: 'Structuring...', color: 'text-blue-600' };
      case 'exporting':
        return { icon: '📤', text: 'Exporting...', color: 'text-blue-600' };
      case 'complete':
        return { icon: '✅', text: lastAction || 'Ready', color: 'text-green-600' };
      case 'error':
        return { icon: '❌', text: processing.message || 'Error', color: 'text-red-600' };
      case 'idle':
      default:
        return { icon: '⭐', text: 'Ready to clean', color: 'text-gray-500' };
    }
  };

  const status = getStatusDisplay();

  return (
    <div className="flex items-center space-x-2">
      <span className="text-sm">{status.icon}</span>
      <span className={`text-xs ${status.color}`}>
        {status.text}
      </span>
    </div>
  );
}
