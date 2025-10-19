'use client';

import { Suspense, ComponentType, lazy } from 'react';
import { motion } from 'framer-motion';

// Loading skeleton component
export function LoadingSkeleton() {
  return (
    <div className="w-full h-full min-h-[400px] flex items-center justify-center">
      <div className="flex flex-col items-center space-y-4">
        <motion.div
          className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
        <p className="text-sm text-gray-600 dark:text-gray-400">Loading...</p>
      </div>
    </div>
  );
}

// Card skeleton for lists
export function CardSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
      <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
    </div>
  );
}

// Table skeleton
export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="animate-pulse space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex space-x-4">
          <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded flex-1"></div>
          <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
        </div>
      ))}
    </div>
  );
}

// Chart skeleton
export function ChartSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded flex items-end justify-around p-4 space-x-2">
        {[60, 80, 45, 90, 70, 55].map((height, i) => (
          <div
            key={i}
            className="bg-gray-300 dark:bg-gray-600 rounded-t w-full"
            style={{ height: `${height}%` }}
          ></div>
        ))}
      </div>
    </div>
  );
}

// Dashboard skeleton
export function DashboardSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-6"></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
          ))}
        </div>
        <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded"></div>
      </div>
    </div>
  );
}

// Generic lazy loader with custom fallback
type ComponentProps = Record<string, unknown>;

interface LazyLoadProps {
  loader: () => Promise<{ default: ComponentType<ComponentProps> }>;
  fallback?: React.ReactNode;
}

export function lazyLoad({ loader, fallback }: LazyLoadProps) {
  const LazyComponent = lazy(loader);

  return function LazyLoadedComponent(props: ComponentProps) {
    return (
      <Suspense fallback={fallback || <LoadingSkeleton />}>
        <LazyComponent {...props} />
      </Suspense>
    );
  };
}

// Intersection Observer based lazy load (for images and heavy components)
export function LazyLoadOnScroll({
  children,
  threshold = 0.1,
  rootMargin = '50px',
}: {
  children: React.ReactNode;
  threshold?: number;
  rootMargin?: string;
}) {
  const [isVisible, setIsVisible] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold, rootMargin }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [threshold, rootMargin]);

  return (
    <div ref={ref} className="min-h-[100px]">
      {isVisible ? children : <LoadingSkeleton />}
    </div>
  );
}

// Image lazy loading with blur effect
export function LazyImage({
  src,
  alt,
  className,
  width,
  height,
}: {
  src: string;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
}) {
  const [isLoaded, setIsLoaded] = React.useState(false);

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <motion.img
        src={src}
        alt={alt}
        width={width}
        height={height}
        className={`w-full h-full object-cover transition-all duration-300 ${
          isLoaded ? 'blur-0' : 'blur-sm'
        }`}
        onLoad={() => setIsLoaded(true)}
        initial={{ opacity: 0 }}
        animate={{ opacity: isLoaded ? 1 : 0.5 }}
        transition={{ duration: 0.3 }}
      />
      {!isLoaded && (
        <div className="absolute inset-0 bg-gray-200 dark:bg-gray-700 animate-pulse" />
      )}
    </div>
  );
}

// Add React import for hooks
import * as React from 'react';
