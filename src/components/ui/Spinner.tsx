import { ReactNode } from 'react';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  color?: 'blue' | 'white' | 'gray' | 'green' | 'red' | 'yellow';
  className?: string;
}

const sizeClasses = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6', 
  lg: 'w-8 h-8',
  xl: 'w-12 h-12'
};

const colorClasses = {
  blue: 'border-blue-500 border-t-transparent',
  white: 'border-white border-t-transparent',
  gray: 'border-gray-500 border-t-transparent',
  green: 'border-green-500 border-t-transparent',
  red: 'border-red-500 border-t-transparent',
  yellow: 'border-yellow-500 border-t-transparent'
};

export function Spinner({ size = 'md', color = 'blue', className = '' }: SpinnerProps) {
  return (
    <div
      className={`
        ${sizeClasses[size]} 
        ${colorClasses[color]} 
        border-2 rounded-full animate-spin
        ${className}
      `}
      role="status"
      aria-label="Loading"
    />
  );
}

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  color?: 'blue' | 'white' | 'gray' | 'green' | 'red' | 'yellow';
  text?: string;
  className?: string;
}

export function LoadingSpinner({ 
  size = 'md', 
  color = 'blue', 
  text = 'Loading...', 
  className = '' 
}: LoadingSpinnerProps) {
  return (
    <div className={`flex items-center justify-center space-x-2 ${className}`}>
      <Spinner size={size} color={color} />
      {text && (
        <span className="text-gray-600 dark:text-gray-400 text-sm font-medium">
          {text}
        </span>
      )}
    </div>
  );
}

interface FullPageSpinnerProps {
  text?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function FullPageSpinner({ text = 'Loading...', size = 'lg' }: FullPageSpinnerProps) {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center">
      <div className="text-center">
        <Spinner size={size} color="blue" className="mx-auto mb-4" />
        <p className="text-gray-600 dark:text-gray-400 text-lg">{text}</p>
      </div>
    </div>
  );
}

interface InlineSpinnerProps {
  size?: 'sm' | 'md';
  color?: 'blue' | 'white' | 'gray' | 'green' | 'red' | 'yellow';
  className?: string;
  children?: ReactNode;
}

export function InlineSpinner({ 
  size = 'sm', 
  color = 'blue', 
  className = '',
  children 
}: InlineSpinnerProps) {
  return (
    <div className={`inline-flex items-center space-x-2 ${className}`}>
      <Spinner size={size} color={color} />
      {children && <span>{children}</span>}
    </div>
  );
}