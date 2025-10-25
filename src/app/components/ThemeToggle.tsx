"use client";
import { useEffect, useState, useCallback } from "react";
import { useTheme } from "next-themes";

// Simple theme toggle using Tailwind's class strategy.
// Persists preference in localStorage under 'theme'.
export default function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const isDark = resolvedTheme === 'dark';

  useEffect(() => { setMounted(true); }, []);

  const toggle = useCallback(() => {
    const next = isDark ? 'light' : 'dark';
    setTheme(next);
  }, [isDark, setTheme]);

  if (!mounted) {
    return (
      <button
        aria-label="Loading theme toggle"
        className="h-8 w-8 rounded flex items-center justify-center border border-gray-300 dark:border-gray-700 text-xs text-gray-500"
        disabled
      >
        …
      </button>
    );
  }

  return (
    <button
      onClick={toggle}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="h-10 w-10 rounded-full flex items-center justify-center border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-md hover:shadow-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-300 relative group"
    >
      <span className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-500/0 to-purple-500/0 group-hover:from-blue-500/10 group-hover:to-purple-500/10 transition-opacity" aria-hidden="true" />
      {isDark ? (
        <span className="text-yellow-400" title="Light mode">☀️</span>
      ) : (
        <span className="text-gray-700 dark:text-gray-300" title="Dark mode">🌙</span>
      )}
      <span className="sr-only">Theme toggle</span>
      <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[11px] font-medium text-gray-600 dark:text-gray-400">
        {isDark ? 'Dark' : 'Light'}
      </span>
    </button>
  );
}
