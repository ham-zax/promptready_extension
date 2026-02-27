import React from 'react';

interface CreditExhaustedPromptProps {
  onUpgrade: () => void;
}

export const CreditExhaustedPrompt: React.FC<CreditExhaustedPromptProps> = ({ onUpgrade }) => {
  return (
    <div className="p-4 text-center bg-red-50 border-l-4 border-red-500 text-red-700">
      <p className="font-bold">You&apos;ve used all your free credits!</p>
      <p className="text-sm mt-2">
        Upgrade to unlimited use by connecting your own API key.
      </p>
      <button
        onClick={onUpgrade}
        className="mt-4 px-4 py-2 bg-brand-primary text-brand-primary-foreground rounded-md hover:opacity-90 active:scale-95 transition-all"
      >
        Add Your API Key
      </button>
    </div>
  );
};
