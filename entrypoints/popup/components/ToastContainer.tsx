import type { Toast } from '../hooks/useToastManager';

interface ToastContainerProps {
  toasts: Toast[];
  onHide: (id: string) => void;
}

export function ToastContainer({ toasts, onHide }: ToastContainerProps) {
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
          <span className="flex-shrink-0 text-sm">{getTypeIcon(toast.type)}</span>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">{toast.message}</p>

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
