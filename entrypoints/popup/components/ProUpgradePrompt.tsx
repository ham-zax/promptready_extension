import React, { useState } from 'react';
import { browser } from 'wxt/browser';
import { Storage } from '@/lib/storage';
import { MonetizationClient } from '@/pro/mock-monetization-client';

interface ProUpgradePromptProps {
  isVisible: boolean;
  onClose: () => void;
  onUpgradeComplete: () => void;
}

export function ProUpgradePrompt({ isVisible, onClose, onUpgradeComplete }: ProUpgradePromptProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [billingEmail, setBillingEmail] = useState('');
  const [step, setStep] = useState<'trial' | 'payment' | 'processing' | 'complete'>('trial');

  if (!isVisible) return null;

  const handleStartTrial = async () => {
    if (!billingEmail || !billingEmail.includes('@')) {
      alert('Please enter a valid email address');
      return;
    }

    setIsProcessing(true);
    setStep('processing');

    try {
      // In a real implementation, this would integrate with Stripe/other payment provider
      // For now, we'll simulate a successful trial start
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate API call

      // Update user settings to reflect Pro status
      await Storage.updateSettings({
        isPro: true,
        trial: {
          hasExhausted: false,
          showUpgradePrompt: false,
          startedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
        },
        user: {
          email: billingEmail,
        },
      });

      setStep('complete');

      // Auto-close after showing success
      setTimeout(() => {
        onUpgradeComplete();
        onClose();
      }, 1500);

    } catch (error) {
      console.error('Failed to start trial:', error);
      setStep('trial');
      setIsProcessing(false);
      alert('Failed to start trial. Please try again.');
    }
  };

  const renderContent = () => {
    switch (step) {
      case 'trial':
        return (
          <>
            {/* Header */}
            <div className="text-center mb-4">
              <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl">🚀</span>
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                Start Your 7-Day Free Trial
              </h2>
              <p className="text-sm text-gray-600">
                No credit card required. Experience AI-powered content processing instantly.
              </p>
            </div>

            {/* Email Input */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email for trial confirmation
              </label>
              <input
                type="email"
                value={billingEmail}
                onChange={(e) => setBillingEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            {/* Benefits */}
            <div className="space-y-3 mb-6">
              <div className="flex items-start space-x-3">
                <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-green-600 text-xs">✓</span>
                </div>
                <div>
                  <div className="font-medium text-sm text-gray-900">AI-Powered Analysis</div>
                  <div className="text-xs text-gray-600">Smart content understanding and structure</div>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-green-600 text-xs">✓</span>
                </div>
                <div>
                  <div className="font-medium text-sm text-gray-900">BYOK Option</div>
                  <div className="text-xs text-gray-600">Use your own API key for unlimited use</div>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-green-600 text-xs">✓</span>
                </div>
                <div>
                  <div className="font-medium text-sm text-gray-900">No Credit Card</div>
                  <div className="text-xs text-gray-600">Start immediately, upgrade later</div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <button
                onClick={handleStartTrial}
                disabled={isProcessing}
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold py-3 px-4 rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing ? 'Starting Trial...' : 'Start Free Trial'}
              </button>

              <button
                onClick={onClose}
                disabled={isProcessing}
                className="w-full bg-gray-100 text-gray-700 font-medium py-2 px-4 rounded-lg hover:bg-gray-200 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Maybe Later
              </button>
            </div>
          </>
        );

      case 'processing':
        return (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Setting Up Your Trial
            </h3>
            <p className="text-sm text-gray-600">
              Activating your AI features...
            </p>
          </div>
        );

      case 'complete':
        return (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">✓</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Trial Activated!
            </h3>
            <p className="text-sm text-gray-600">
              Your AI features are now ready to use.
            </p>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 max-w-md mx-4 shadow-2xl w-full">
        {renderContent()}
      </div>
    </div>
  );
}
