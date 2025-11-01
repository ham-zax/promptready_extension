import React from 'react';

interface CreditExhaustedPromptProps {
  onUpgrade: () => void;
}

export const CreditExhaustedPrompt: React.FC<CreditExhaustedPromptProps> = ({ onUpgrade }) => {
  return (
    <div className="p-4 text-center bg-red-50 border-l-4 border-red-500 text-red-700">
      <p className="font-bold">You've used all your free credits!</p>
      <p className="text-sm mt-2">
        Upgrade to unlimited use by connecting your own API key.
      </p>
      <button
        onClick={onUpgrade}
        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
      >
        Add Your API Key
      </button>
    </div>
  );
};
