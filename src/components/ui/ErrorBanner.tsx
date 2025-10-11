import { ReactNode } from 'react';

interface ErrorBannerProps {
  title?: string;
  message: string;
  type?: 'error' | 'warning' | 'info';
  dismissible?: boolean;
  onDismiss?: () => void;
  className?: string;
  children?: ReactNode;
}

const typeStyles = {
  error: {
    container: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
    icon: '⚠️',
    iconColor: 'text-red-500',
    title: 'text-red-800 dark:text-red-400',
    message: 'text-red-700 dark:text-red-300',
    button: 'text-red-500 hover:text-red-700 dark:hover:text-red-300'
  },
  warning: {
    container: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800',
    icon: '⚠️',
    iconColor: 'text-yellow-500',
    title: 'text-yellow-800 dark:text-yellow-400',
    message: 'text-yellow-700 dark:text-yellow-300',
    button: 'text-yellow-500 hover:text-yellow-700 dark:hover:text-yellow-300'
  },
  info: {
    container: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
    icon: 'ℹ️',
    iconColor: 'text-blue-500',
    title: 'text-blue-800 dark:text-blue-400',
    message: 'text-blue-700 dark:text-blue-300',
    button: 'text-blue-500 hover:text-blue-700 dark:hover:text-blue-300'
  }
};

export function ErrorBanner({
  title,
  message,
  type = 'error',
  dismissible = true,
  onDismiss,
  className = '',
  children
}: ErrorBannerProps) {
  const styles = typeStyles[type];

  return (
    <div className={`border rounded-lg p-4 ${styles.container} ${className}`}>
      <div className="flex items-start">
        <span className={`${styles.iconColor} mr-3 text-lg flex-shrink-0`}>
          {styles.icon}
        </span>
        <div className="flex-1">
          {title && (
            <h3 className={`font-semibold mb-1 ${styles.title}`}>
              {title}
            </h3>
          )}
          <p className={`text-sm ${styles.message}`}>
            {message}
          </p>
          {children && (
            <div className="mt-3">
              {children}
            </div>
          )}
        </div>
        {dismissible && onDismiss && (
          <button
            onClick={onDismiss}
            className={`ml-3 ${styles.button} hover:opacity-75 flex-shrink-0`}
            aria-label="Dismiss"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}

interface ErrorPageProps {
  title?: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  showRetry?: boolean;
  onRetry?: () => void;
}

export function ErrorPage({
  title = 'Something went wrong',
  message,
  actionLabel = 'Go Home',
  onAction,
  showRetry = false,
  onRetry
}: ErrorPageProps) {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="text-center max-w-md mx-auto">
        <div className="text-6xl mb-6">😵</div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
          {title}
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          {message}
        </p>
        <div className="space-y-3">
          {showRetry && onRetry && (
            <button
              onClick={onRetry}
              className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              Try Again
            </button>
          )}
          {onAction && (
            <button
              onClick={onAction}
              className="w-full px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              {actionLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

interface InlineErrorProps {
  message: string;
  className?: string;
}

export function InlineError({ message, className = '' }: InlineErrorProps) {
  return (
    <div className={`flex items-center text-red-600 dark:text-red-400 text-sm ${className}`}>
      <span className="mr-1">⚠️</span>
      <span>{message}</span>
    </div>
  );
}

interface ErrorCardProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
}

export function ErrorCard({
  title = 'Error',
  message,
  onRetry,
  onDismiss,
  className = ''
}: ErrorCardProps) {
  return (
    <div className={`bg-white dark:bg-gray-800 border border-red-200 dark:border-red-800 rounded-lg p-6 ${className}`}>
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <span className="text-2xl">❌</span>
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">
            {title}
          </h3>
          <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
            {message}
          </p>
          <div className="flex space-x-3">
            {onRetry && (
              <button
                onClick={onRetry}
                className="px-3 py-2 bg-red-500 text-white text-sm rounded-md hover:bg-red-600 transition-colors"
              >
                Try Again
              </button>
            )}
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="px-3 py-2 bg-gray-500 text-white text-sm rounded-md hover:bg-gray-600 transition-colors"
              >
                Dismiss
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}