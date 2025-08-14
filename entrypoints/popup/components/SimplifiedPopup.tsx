// Simplified popup UI focused on 'open→copy→done' workflow
// Implements AI-first monetization with clear Offline/AI mode toggle
// Perfect separation of concerns using custom hook

import React, { useState } from 'react';
import { usePopupController } from '../hooks/usePopupController';
import { SettingsPanel } from './SettingsPanel';
import { Toast } from './Toast';

// Simple upgrade modal component (inline for now)
function UpgradeModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Upgrade to Pro</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>
        <div className="mb-6">
          <p className="text-gray-600 mb-4">
            Unlock AI-powered processing with your own API key for enhanced content extraction and formatting.
          </p>
          <ul className="text-sm text-gray-600 space-y-2">
            <li>• Use your own OpenAI or OpenRouter API key</li>
            <li>• Advanced AI processing capabilities</li>
            <li>• Custom processing profiles</li>
            <li>• Priority support</li>
          </ul>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Maybe Later
          </button>
          <button
            onClick={() => {
              // TODO: Implement upgrade flow
              console.log('Upgrade clicked');
              onClose();
            }}
            className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-md hover:from-purple-600 hover:to-pink-600"
          >
            Upgrade Now
          </button>
        </div>
      </div>
    </div>
  );
}

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
  } = usePopupController();

  const [showSettings, setShowSettings] = useState(false);

  return (
    <div className="w-96 bg-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-xl">📋</span>
            <h1 className="text-lg font-semibold">PromptReady</h1>
          </div>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-1 rounded hover:bg-white hover:bg-opacity-20 transition-colors"
            aria-label="Settings"
          >
            ⚙️
          </button>
        </div>

        {/* Mode Toggle */}
        <div className="mt-3 flex items-center justify-between">
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
        <div className="flex justify-between text-xs mt-1 opacity-75">
          <span className={state.mode === 'offline' ? 'font-medium' : ''}>Offline</span>
          <span className={state.mode === 'ai' ? 'font-medium' : ''}>
            AI {!state.isPro && '(Pro)'}
          </span>
        </div>
      </div>

      {/* Settings Panel */}
      <SettingsPanel
        isExpanded={showSettings}
        settings={{
          mode: state.mode,
          isPro: state.isPro,
          theme: 'system',
          templates: { bundles: [] },
          byok: {
            provider: 'openrouter',
            apiBase: 'https://openrouter.ai/api/v1',
            apiKey: '',
            model: '',
          },
          privacy: { telemetryEnabled: false },
          renderer: 'turndown',
          useReadability: true,
        }}
        onSettingsChange={() => {}}
        onApiKeyChange={() => {}}
        onApiKeySave={() => {}}
        onApiKeyTest={() => {}}
        hasApiKey={false}
        apiKeyInput=""
      />

      {/* Main Content */}
      <div className="p-4">
        {/* Capture Button */}
        <button
          onClick={handleCapture}
          disabled={isProcessing}
          className={`w-full py-3 px-4 rounded-lg font-medium transition-all ${
            isProcessing
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg'
          }`}
        >
          {isProcessing ? (
            <div className="flex items-center justify-center space-x-2">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
              <span>{state.processing.message || 'Processing...'}</span>
            </div>
          ) : (
            <div className="flex items-center justify-center space-x-2">
              <span>📋</span>
              <span>Capture Content</span>
            </div>
          )}
        </button>

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
                  <span className={`text-xs font-medium ${
                    state.exportData.qualityReport.overallScore >= 80 
                      ? 'text-green-600' 
                      : state.exportData.qualityReport.overallScore >= 60 
                      ? 'text-yellow-600' 
                      : 'text-red-600'
                  }`}>
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
      <UpgradeModal
        isOpen={state.showUpgrade}
        onClose={handleUpgradeClose}
      />
    </div>
  );
}
