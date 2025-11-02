// Toast Manager Hook
// Centralized toast notification system

import { useState, useCallback, useEffect, useRef } from 'react';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
  persistent?: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export interface ToastState {
  toasts: Toast[];
}

export interface ToastActions {
  showToast: (message: string, type?: Toast['type'], duration?: number) => void;
  showSuccess: (message: string, duration?: number) => void;
  showError: (message: string, duration?: number) => void;
  showInfo: (message: string, duration?: number) => void;
  showWarning: (message: string, duration?: number) => void;
  showPersistentToast: (message: string, type: Toast['type'], action?: Toast['action']) => void;
  hideToast: (id: string) => void;
  clearAll: () => void;
}

const DEFAULT_DURATION = 3000; // 3 seconds
const MAX_TOASTS = 5; // Maximum concurrent toasts

export function useToastManager(): ToastState & ToastActions {
  const [state, setState] = useState<ToastState>({
    toasts: [],
  });

  const toastCounter = useRef(0);

  const generateId = useCallback(() => {
    return `toast-${++toastCounter.current}-${Date.now()}`;
  }, []);

  const showToast = useCallback((
    message: string,
    type: Toast['type'] = 'info',
    duration: number = DEFAULT_DURATION
  ) => {
    const id = generateId();

    setState(prev => {
      // Remove oldest toast if we exceed max
      const newToasts = [...prev.toasts];
      if (newToasts.length >= MAX_TOASTS) {
        newToasts.shift();
      }

      return {
        toasts: [...newToasts, {
          id,
          message,
          type,
          duration,
        }],
      };
    });

    // Auto-hide if not persistent
    if (duration > 0) {
      setTimeout(() => {
        hideToast(id);
      }, duration);
    }
  }, [generateId]);

  const showSuccess = useCallback((message: string, duration?: number) => {
    showToast(message, 'success', duration);
  }, [showToast]);

  const showError = useCallback((message: string, duration?: number) => {
    showToast(message, 'error', duration || 5000); // Errors show longer
  }, [showToast]);

  const showInfo = useCallback((message: string, duration?: number) => {
    showToast(message, 'info', duration);
  }, [showToast]);

  const showWarning = useCallback((message: string, duration?: number) => {
    showToast(message, 'warning', duration || 4000);
  }, [showToast]);

  const showPersistentToast = useCallback((
    message: string,
    type: Toast['type'],
    action?: Toast['action']
  ) => {
    const id = generateId();

    setState(prev => {
      const newToasts = [...prev.toasts];
      if (newToasts.length >= MAX_TOASTS) {
        newToasts.shift();
      }

      return {
        toasts: [...newToasts, {
          id,
          message,
          type,
          persistent: true,
          action,
        }],
      };
    });
  }, [generateId]);

  const hideToast = useCallback((id: string) => {
    setState(prev => ({
      toasts: prev.toasts.filter(toast => toast.id !== id),
    }));
  }, []);

  const clearAll = useCallback(() => {
    setState({ toasts: [] });
  }, []);

  // Auto-cleanup for very old toasts (safety net)
  useEffect(() => {
    const interval = setInterval(() => {
      setState(prev => ({
        toasts: prev.toasts.filter(toast => {
          // Remove toasts older than 10 seconds if they weren't persistent
          if (toast.persistent) return true;

          const toastAge = Date.now() - parseInt(toast.id.split('-')[2]);
          return toastAge < 10000; // 10 seconds
        }),
      }));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return {
    ...state,
    showToast,
    showSuccess,
    showError,
    showInfo,
    showWarning,
    showPersistentToast,
    hideToast,
    clearAll,
  };
}

// Toast component for rendering
export function ToastContainer({ toasts, onHide }: {
  toasts: Toast[];
  onHide: (id: string) => void;
}) {
  const getTypeStyles = (type: Toast['type']) => {
    switch (type) {
      case 'success':
        return 'bg-green-500 text-white';
      case 'error':
        return 'bg-red-500 text-white';
      case 'warning':
        return 'bg-yellow-500 text-white';
      case 'info':
      default:
        return 'bg-blue-500 text-white';
    }
  };

  const getTypeIcon = (type: Toast['type']) => {
    switch (type) {
      case 'success':
        return '✓';
      case 'error':
        return '✗';
      case 'warning':
        return '⚠️';
      case 'info':
      default:
        return 'ℹ️';
    }
  };

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`
            transform transition-all duration-300 ease-in-out
            ${getTypeStyles(toast.type)}
            px-4 py-3 rounded-lg shadow-lg
            flex items-start space-x-2
            min-w-0 max-w-xs
            ${toast.persistent ? 'cursor-auto' : 'cursor-pointer'}
          `}
          onClick={() => !toast.persistent && onHide(toast.id)}
        >
          <span className="flex-shrink-0 text-sm">
            {getTypeIcon(toast.type)}
          </span>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">
              {toast.message}
            </p>

            {toast.action && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toast.action!.onClick();
                }}
                className="mt-2 text-xs underline hover:no-underline"
              >
                {toast.action.label}
              </button>
            )}
          </div>

          {toast.persistent && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onHide(toast.id);
              }}
              className="flex-shrink-0 ml-2 text-white/70 hover:text-white transition-colors"
            >
              ×
            </button>
          )}
        </div>
      ))}
    </div>
  );
}