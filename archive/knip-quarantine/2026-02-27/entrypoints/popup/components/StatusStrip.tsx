import React from 'react';
import { ProcessingState } from '@/lib/types';
import { Loader2, Wand2, Boxes, UploadCloud, CheckCircle2, XCircle, Sparkles } from 'lucide-react';

interface StatusStripProps {
  processing: ProcessingState;
  lastAction?: string;
}

export function StatusStrip({ processing, lastAction }: StatusStripProps) {
  const getStatusDisplay = () => {
    switch (processing.status) {
      case 'capturing':
        return { icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />, text: 'Capturing content...', color: 'text-brand-primary' };
      case 'cleaning':
        return { icon: <Wand2 className="w-3.5 h-3.5 animate-pulse" />, text: 'Cleaning content...', color: 'text-brand-primary' };
      case 'structuring':
        return { icon: <Boxes className="w-3.5 h-3.5 animate-bounce" />, text: 'Structuring...', color: 'text-brand-primary' };
      case 'exporting':
        return { icon: <UploadCloud className="w-3.5 h-3.5 animate-pulse" />, text: 'Exporting...', color: 'text-brand-primary' };
      case 'complete':
        return { icon: <CheckCircle2 className="w-3.5 h-3.5" />, text: lastAction || 'Ready', color: 'text-green-600' };
      case 'error':
        return { icon: <XCircle className="w-3.5 h-3.5" />, text: processing.message || 'Error', color: 'text-red-600' };
      case 'idle':
      default:
        return { icon: <Sparkles className="w-3.5 h-3.5 opacity-70" />, text: 'Ready to clean', color: 'text-muted-foreground' };
    }
  };

  const status = getStatusDisplay();

  return (
    <div className="flex items-center space-x-2">
      <span className={`text-sm ${status.color}`}>{status.icon}</span>
      <span className={`text-xs font-medium ${status.color}`}>
        {status.text}
      </span>
    </div>
  );
}
