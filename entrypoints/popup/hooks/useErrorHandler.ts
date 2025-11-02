// Error Handling Hook
// Centralized error management with user-friendly feedback

import { useState, useCallback, useEffect } from 'react';
import type { Settings } from '@/lib/types';

export interface ErrorState {
  hasError: boolean;
  error: {
    code?: string;
    message: string;
    details?: any;
    context?: string;
    timestamp: string;
  } | null;
  errorHistory: Array<{
    code?: string;
    message: string;
    timestamp: string;
  }>;
}

export interface ErrorActions {
  showError: (message: string, code?: string, details?: any, context?: string) => void;
  showSuccess: (message: string) => void;
  showInfo: (message: string) => void;
  clearError: () => void;
  clearHistory: () => void;
  retryLastAction: () => void;
  reportError: (error: Error, context?: string) => void;
}

const ERROR_CODES = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  STORAGE_ERROR: 'STORAGE_ERROR',
  API_ERROR: 'API_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

const ERROR_MESSAGES = {
  [ERROR_CODES.NETWORK_ERROR]: 'Network connection failed. Please check your internet connection.',
  [ERROR_CODES.VALIDATION_ERROR]: 'Invalid input. Please check your information and try again.',
  [ERROR_CODES.PERMISSION_DENIED]: 'Permission denied. Please check your settings and try again.',
  [ERROR_CODES.QUOTA_EXCEEDED]: 'You have exceeded your usage limit. Please upgrade your plan.',
  [ERROR_CODES.STORAGE_ERROR]: 'Failed to save settings. Please try again.',
  [ERROR_CODES.API_ERROR]: 'API request failed. Please try again later.',
  [ERROR_CODES.UNKNOWN_ERROR]: 'An unexpected error occurred. Please try again.',
};

export function useErrorHandler(): ErrorState & ErrorActions {
  const [state, setState] = useState<ErrorState>({
    hasError: false,
    error: null,
    errorHistory: [],
  });

  const [lastAction, setLastAction] = useState<{
    action: () => void;
    description: string;
  } | null>(null);

  // Log errors to console for debugging
  useEffect(() => {
    if (state.error) {
      console.error('Error occurred:', {
        code: state.error.code,
        message: state.error.message,
        details: state.error.details,
        context: state.error.context,
        timestamp: state.error.timestamp,
      });
    }
  }, [state.error]);

  const getUserFriendlyMessage = useCallback((error: {
    code?: string;
    message: string;
    details?: any;
  }): string => {
    // If we have a specific error code, use the friendly message
    if (error.code && ERROR_MESSAGES[error.code as keyof typeof ERROR_MESSAGES]) {
      return ERROR_MESSAGES[error.code as keyof typeof ERROR_MESSAGES];
    }

    // Check for common error patterns
    if (error.message) {
      const lowerMessage = error.message.toLowerCase();

      if (lowerMessage.includes('network') || lowerMessage.includes('fetch')) {
        return ERROR_MESSAGES[ERROR_CODES.NETWORK_ERROR];
      }
      if (lowerMessage.includes('permission') || lowerMessage.includes('unauthorized')) {
        return ERROR_MESSAGES[ERROR_CODES.PERMISSION_DENIED];
      }
      if (lowerMessage.includes('quota') || lowerMessage.includes('limit')) {
        return ERROR_MESSAGES[ERROR_CODES.QUOTA_EXCEEDED];
      }
      if (lowerMessage.includes('validation')) {
        return ERROR_MESSAGES[ERROR_CODES.VALIDATION_ERROR];
      }
      if (lowerMessage.includes('storage')) {
        return ERROR_MESSAGES[ERROR_CODES.STORAGE_ERROR];
      }
      if (lowerMessage.includes('api')) {
        return ERROR_MESSAGES[ERROR_CODES.API_ERROR];
      }
    }

    // Fallback to original message
    return error.message || ERROR_MESSAGES[ERROR_CODES.UNKNOWN_ERROR];
  }, []);

  const showError = useCallback((
    message: string,
    code?: string,
    details?: any,
    context?: string
  ) => {
    const error = {
      code: code || ERROR_CODES.UNKNOWN_ERROR,
      message: getUserFriendlyMessage({ code, message, details }),
      details,
      context,
      timestamp: new Date().toISOString(),
    };

    setState(prev => ({
      hasError: true,
      error,
      errorHistory: [...prev.errorHistory.slice(-9), { // Keep last 10 errors
        code: error.code,
        message: error.message,
        timestamp: error.timestamp,
      }],
    }));
  }, [getUserFriendlyMessage]);

  const showSuccess = useCallback((message: string) => {
    setState(prev => ({
      ...prev,
      hasError: false,
      error: null,
    }));

    // Success feedback could be handled by a toast system
    console.log('Success:', message);
  }, []);

  const showInfo = useCallback((message: string) => {
    setState(prev => ({
      ...prev,
      hasError: false,
      error: null,
    }));

    // Info feedback could be handled by a toast system
    console.log('Info:', message);
  }, []);

  const clearError = useCallback(() => {
    setState(prev => ({
      ...prev,
      hasError: false,
      error: null,
    }));
    setLastAction(null);
  }, []);

  const clearHistory = useCallback(() => {
    setState(prev => ({
      ...prev,
      errorHistory: [],
    }));
  }, []);

  const retryLastAction = useCallback(() => {
    if (lastAction) {
      try {
        lastAction.action();
        clearError();
      } catch (error) {
        reportError(error as Error, 'retry_action');
      }
    }
  }, [lastAction, clearError]);

  const reportError = useCallback((error: Error, context?: string) => {
    const errorObj = {
      code: ERROR_CODES.UNKNOWN_ERROR,
      message: getUserFriendlyMessage({
        code: ERROR_CODES.UNKNOWN_ERROR,
        message: error.message,
        details: error.stack
      }),
      details: {
        name: error.name,
        stack: error.stack,
      },
      context,
      timestamp: new Date().toISOString(),
    };

    setState(prev => ({
      ...prev,
      hasError: true,
      error: errorObj,
      errorHistory: [...prev.errorHistory.slice(-9), {
        code: errorObj.code,
        message: errorObj.message,
        timestamp: errorObj.timestamp,
      }],
    }));

    // Store error for debugging/telemetry
    try {
      if (context !== 'development') {
        console.error('Error reported:', errorObj);
      }
    } catch (e) {
      console.warn('Failed to report error:', e);
    }
  }, [getUserFriendlyMessage]);

  const setLastActionForRetry = useCallback((action: () => void, description: string) => {
    setLastAction({ action, description });
  }, []);

  // Expose a way to set last action for retry functionality
  useEffect(() => {
    // This could be enhanced to automatically track user actions
  }, []);

  return {
    ...state,
    showError,
    showSuccess,
    showInfo,
    clearError,
    clearHistory,
    retryLastAction,
    reportError,
    setLastActionForRetry,
  };
}

// Helper function to categorize errors automatically
export function categorizeError(error: any): string {
  if (!error) return ERROR_CODES.UNKNOWN_ERROR;

  const message = error.message || error.toString() || '';
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes('network') || lowerMessage.includes('fetch') || lowerMessage.includes('connection')) {
    return ERROR_CODES.NETWORK_ERROR;
  }
  if (lowerMessage.includes('permission') || lowerMessage.includes('unauthorized') || lowerMessage.includes('forbidden')) {
    return ERROR_CODES.PERMISSION_DENIED;
  }
  if (lowerMessage.includes('quota') || lowerMessage.includes('limit') || lowerMessage.includes('exceeded')) {
    return ERROR_CODES.QUOTA_EXCEEDED;
  }
  if (lowerMessage.includes('validation') || lowerMessage.includes('invalid')) {
    return ERROR_CODES.VALIDATION_ERROR;
  }
  if (lowerMessage.includes('storage') || lowerMessage.includes('chrome.storage')) {
    return ERROR_CODES.STORAGE_ERROR;
  }
  if (lowerMessage.includes('api') || lowerMessage.includes('http')) {
    return ERROR_CODES.API_ERROR;
  }

  return ERROR_CODES.UNKNOWN_ERROR;
}

export { ERROR_CODES, ERROR_MESSAGES };