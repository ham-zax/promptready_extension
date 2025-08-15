// Simplified popup UI focused on 'open→copy→done' workflow
// Implements AI-first monetization with clear Offline/AI mode toggle
// Perfect separation of concerns using custom hook

import React, { useState } from 'react';
import { usePopupController } from '../hooks/usePopupController';
import { SettingsPanel } from './SettingsPanel';
import { Toast } from './Toast';
import type { Settings } from '@/lib/types';
import { ProBadge } from './ProBadge';
import { PrimaryButton } from './PrimaryButton';
import { ProUpgradePrompt } from './ProUpgradePrompt';
import { CreditExhaustedPrompt } from './CreditExhaustedPrompt';

// Main popup component - now purely presentational
export default function SimplifiedPopup() {
  const {
    state,
    isProcessing,
    hasContent,
    handleModeToggle,
    handleCapture,
    handleCopy,
    handleExport,
    handleUpgradeClose,
    // Newly exposed handlers
    showToast,
    onSettingsChange,
    onApiKeyChange,
    onApiKeySave,
    onApiKeyTest,
  } = usePopupController();

  const [showSettings, setShowSettings] = useState(false);
  const [isSettingsVisible, setIsSettingsVisible] = useState(false);

  const handleShowSettings = () => {
    setIsSettingsVisible(true);
    setShowSettings(true); // Also open the main settings panel
  };

  const getAiLabel = () => {
    if (state.hasApiKey) return 'AI (BYOK)'; // If user has their own key
    if (state.trial && !state.trial.hasExhausted) return 'AI (Trial)'; // If user is on free trial
    return 'AI'; // Default label if neither BYOK nor Trial (e.g., after trial exhausted)
  };

  return (
    <div className="w-96 bg-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-xl">📋</span>
            <h1 className="text-lg font-semibold">PromptReady</h1>
            {state.isPro && <ProBadge />}
          </div>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-1 rounded hover:bg-white hover:bg-opacity-20 transition-colors"
            aria-label="Settings"
          >
            ⚙️
          </button>
        </div>

        {/* Credits and Mode Toggle */}
        <div className="mt-3 flex items-center justify-between">
          <div className="text-xs opacity-90">
            {state.isPro
              ? ` `
              : state.trial && !state.trial.hasExhausted
              ? `You have ${state.credits?.remaining} credits left.`
              : ' '}
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-sm opacity-90">Processing Mode</span>
            <button
              onClick={handleModeToggle}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                state.mode === 'ai' ? 'bg-green-500' : 'bg-gray-400'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  state.mode === 'ai' ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
        <div className="flex justify-between text-xs mt-1 opacity-75">
          <span className={state.mode === 'offline' ? 'font-medium' : ''}>Offline</span>
          <span className={state.mode === 'ai' ? 'font-medium' : ''}>
            {getAiLabel()}
          </span>
        </div>
      </div>

      {/* Settings Panel */}
      <SettingsPanel
        isExpanded={showSettings}
        settings={state.settings as Settings}
        onSettingsChange={onSettingsChange}
        onApiKeyChange={onApiKeyChange}
        onApiKeySave={onApiKeySave}
        onApiKeyTest={onApiKeyTest}
        hasApiKey={state.hasApiKey}
        apiKeyInput={state.apiKeyInput}
      />

      {/* Main Content */}
      <div className="p-4">
        {/* Capture Button */}
        <PrimaryButton
          onClick={handleCapture}
          disabled={isProcessing || state.credits?.remaining === 0}
          isProcessing={isProcessing}
          processingText={state.processing.message || 'Processing...'}
        >
          Capture Content
        </PrimaryButton>

        {/* Credit Exhaustion Prompt */}
        {state.credits?.remaining === 0 && (
          <CreditExhaustedPrompt onUpgrade={handleShowSettings} />
        )}

        {/* Processing Progress */}
        {isProcessing && state.processing.progress && (
          <div className="mt-3">
            <div className="bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${state.processing.progress}%` }}
              ></div>
            </div>
            <p className="text-xs text-gray-600 mt-1 text-center">
              {state.processing.message}
            </p>
          </div>
        )}

        {/* Export Options */}
        {hasContent && (
          <div className="mt-4 space-y-3">
            <div className="border-t pt-3">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Export Options</h3>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleCopy(state.exportData!.markdown)}
                  className="flex items-center justify-center space-x-1 py-2 px-3 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm"
                >
                  <span>📋</span>
                  <span>Copy MD</span>
                </button>
                <button
                  onClick={() => handleExport('md')}
                  className="flex items-center justify-center space-x-1 py-2 px-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
                >
                  <span>💾</span>
                  <span>Save MD</span>
                </button>
              </div>
              <button
                onClick={() => handleCopy(JSON.stringify(state.exportData!.json, null, 2))}
                className="w-full mt-2 py-2 px-3 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors text-sm"
              >
                📄 Copy JSON
              </button>
            </div>

            {/* Quality Report */}
            {state.exportData?.qualityReport && (
              <div className="border-t pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-600">Quality Score</span>
                  <span
                    className={`text-xs font-medium ${
                      state.exportData.qualityReport.overallScore >= 80
                        ? 'text-green-600'
                        : state.exportData.qualityReport.overallScore >= 60
                        ? 'text-yellow-600'
                        : 'text-red-600'
                    }`}
                  >
                    {state.exportData.qualityReport.overallScore}/100
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Toast Notifications */}
      {state.toast && (
        <Toast
          message={state.toast.message}
          type={state.toast.type}
          onClose={() => {}}
        />
      )}

      {/* Upgrade Modal */}
      <ProUpgradePrompt
        isVisible={state.showUpgrade}
        onClose={handleUpgradeClose}
        onUpgrade={() => setShowSettings(true)}
      />
    </div>
  );
}
