import React from 'react';

interface PrimaryButtonProps {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  isProcessing?: boolean;
  processingText?: string;
}

export function PrimaryButton({ 
  children, 
  onClick, 
  disabled = false, 
  isProcessing = false, 
  processingText = 'Processing...' 
}: PrimaryButtonProps) {
  const loading = isProcessing;
  const loadingText = processingText;

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`w-full py-3 px-5 rounded-full border font-semibold text-sm transform-gpu transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
        disabled || loading
          ? 'bg-muted border-border text-muted-foreground cursor-not-allowed'
          : 'bg-brand-primary border-[#c90000] hover:bg-[#d20000] text-brand-primary-foreground shadow-sm hover:shadow-[0_8px_20px_rgba(231,0,0,0.2)] active:scale-[0.985]'
      }`}
    >
      {loading ? (
        <div className="flex items-center justify-center space-x-2">
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          <span>{loadingText}</span>
        </div>
      ) : children}
    </button>
  );
}
