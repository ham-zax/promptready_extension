import React from 'react';

interface ProUpgradePromptProps {
  isVisible: boolean;
  onClose: () => void;
  onUpgrade: () => void;
}

export function ProUpgradePrompt({ isVisible, onClose, onUpgrade }: ProUpgradePromptProps) {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 max-w-sm mx-4 shadow-2xl">
        {/* Header */}
        <div className="text-center mb-4">
          <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-3">
            <span className="text-2xl">🤖</span>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Unlock AI Mode
          </h2>
          <p className="text-sm text-gray-600">
            Get enhanced content processing with AI-powered analysis
          </p>
        </div>

        {/* Benefits */}
        <div className="space-y-3 mb-6">
          <div className="flex items-start space-x-3">
            <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-green-600 text-xs">✓</span>
            </div>
            <div>
              <div className="font-medium text-sm text-gray-900">Smart Content Analysis</div>
              <div className="text-xs text-gray-600">AI understands context and structure</div>
            </div>
          </div>
          
          <div className="flex items-start space-x-3">
            <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-green-600 text-xs">✓</span>
            </div>
            <div>
              <div className="font-medium text-sm text-gray-900">Enhanced Formatting</div>
              <div className="text-xs text-gray-600">Better markdown structure and cleanup</div>
            </div>
          </div>
          
          <div className="flex items-start space-x-3">
            <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-green-600 text-xs">✓</span>
            </div>
            <div>
              <div className="font-medium text-sm text-gray-900">BYOK Support</div>
              <div className="text-xs text-gray-600">Use your own OpenAI/OpenRouter key</div>
            </div>
          </div>
          
          <div className="flex items-start space-x-3">
            <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-green-600 text-xs">✓</span>
            </div>
            <div>
              <div className="font-medium text-sm text-gray-900">No Usage Limits</div>
              <div className="text-xs text-gray-600">Process unlimited content with your API key</div>
            </div>
          </div>
        </div>

        {/* Pricing */}
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-4 mb-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-700 mb-1">
              $9.99<span className="text-sm font-normal text-purple-600">/month</span>
            </div>
            <div className="text-xs text-purple-600">
              Cancel anytime • 7-day free trial
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <button
            onClick={onUpgrade}
            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold py-3 px-4 rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all duration-200 shadow-sm hover:shadow-md"
          >
            Start Free Trial
          </button>
          
          <button
            onClick={onClose}
            className="w-full bg-gray-100 text-gray-700 font-medium py-2 px-4 rounded-lg hover:bg-gray-200 transition-colors duration-200"
          >
            Maybe Later
          </button>
        </div>

        {/* Fine print */}
        <div className="text-center mt-4">
          <p className="text-xs text-gray-500">
            Requires your own OpenAI or OpenRouter API key
          </p>
        </div>
      </div>
    </div>
  );
}
