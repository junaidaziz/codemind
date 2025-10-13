import React, { useState } from 'react';

interface Toast {
  id: string;
  title: string;
  description?: string;
  variant?: 'default' | 'destructive';
}

interface ToastOptions {
  title: string;
  description?: string;
  variant?: 'default' | 'destructive';
}

// Simple toast implementation
let toasts: Toast[] = [];
let listeners: Array<(toasts: Toast[]) => void> = [];

const addToast = (toast: Omit<Toast, 'id'>) => {
  const newToast: Toast = {
    ...toast,
    id: Math.random().toString(36).substring(2, 15),
  };
  
  toasts = [...toasts, newToast];
  listeners.forEach(listener => listener(toasts));
  
  // Auto-remove after 5 seconds
  setTimeout(() => {
    toasts = toasts.filter(t => t.id !== newToast.id);
    listeners.forEach(listener => listener(toasts));
  }, 5000);
};

const removeToast = (id: string) => {
  toasts = toasts.filter(t => t.id !== id);
  listeners.forEach(listener => listener(toasts));
};

export function useToast() {
  const [currentToasts, setCurrentToasts] = useState<Toast[]>(toasts);

  // Subscribe to toast changes
  React.useEffect(() => {
    const listener = (newToasts: Toast[]) => {
      setCurrentToasts(newToasts);
    };
    
    listeners.push(listener);
    
    return () => {
      listeners = listeners.filter(l => l !== listener);
    };
  }, []);

  const toast = (options: ToastOptions) => {
    addToast(options);
  };

  return {
    toast,
    toasts: currentToasts,
    dismiss: removeToast,
  };
}

// Simple toast display component (you can improve this)
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { toasts, dismiss } = useToast();

  return (
    <>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`
              max-w-sm rounded-lg border bg-white p-4 shadow-lg
              ${toast.variant === 'destructive' 
                ? 'border-red-200 bg-red-50 text-red-800' 
                : 'border-gray-200 bg-white text-gray-800'
              }
            `}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="font-medium">{toast.title}</div>
                {toast.description && (
                  <div className="text-sm mt-1 opacity-90">{toast.description}</div>
                )}
              </div>
              <button 
                onClick={() => dismiss(toast.id)}
                className="text-gray-400 hover:text-gray-600 ml-4"
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}