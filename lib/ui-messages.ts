/**
 * Centralized UI messages for PromptReady.
 * Use concise, user-facing text. Keep this file as the single source
 * for strings used by toasts, dialogs, and small inline notices.
 */

export const UI_MESSAGES = {
  // Generic
  failedToLoadSettings: 'Failed to load settings or extras.',
  settingsSaved: 'Settings saved',
  failedToSaveSettings: 'Failed to save settings',
  failedToUpdateMode: 'Failed to update mode',
  noContentToExport: 'No content to export',

  // Mode / processing
  switchedToMode: (mode: string) => `Switched to ${mode.toUpperCase()} mode`,
  capturingContent: 'Capturing content...',
  processingFailed: (err: string) => `Processing failed: ${err}`,

  // Export / copy
  contentProcessed: 'Content processed successfully!',
  contentExported: 'Content exported successfully!',
  copiedToClipboard: 'Copied to clipboard!',
  copyFailed: (err: string) => `Copy failed: ${err}`,

  // BYOK / API key flows
  enterAndSaveApiKeyFirst: 'Please enter and save an API key first.',
  apiKeySaved: 'API key saved',
  byokConnectionOk: 'BYOK connection OK',
  byokTestNoContent: 'BYOK test completed (no content)',
  byokTestTimeout: 'BYOK test timed out. Check network or try again.',
  byokTestUnauthorized: 'Validation Failed: The API key you entered could not be validated. Please double-check the key and try again.',
  byokTestRateLimited: 'BYOK test failed: Rate limited. Please wait and retry.',
  modelFetchFailed: "Could Not Fetch Models: Your API key is valid, but we couldn't fetch your available models. Please check your OpenRouter settings or try again.",
  connectionError: 'Connection Error: Could not connect to the service. Please check your internet connection and try again.',
  serviceTemporarilyUnavailable: 'Service Temporarily Unavailable: Our free trial is experiencing high demand. Please try again in a little while, or use the free Offline Mode.',
  intelligentBypassSuccess: 'Copied with Intelligent Analysis!',
  byokTestFailedGeneric: (msg: string) => `BYOK test failed: ${msg}`,

  // Misc
  failedToCapture: 'Failed to capture content',
  failedToExport: 'Failed to export content',
  failedToSaveApiKey: 'Failed to save API key',
};

export default UI_MESSAGES;