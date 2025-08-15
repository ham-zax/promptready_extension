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
      className={`w-full py-3 px-4 rounded-lg font-medium text-sm transition-all ${
        disabled || loading
          ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
          : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm hover:shadow-md'
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
