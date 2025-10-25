"use client";
import { useEffect, useState, useCallback } from "react";

// Simple theme toggle using Tailwind's class strategy.
// Persists preference in localStorage under 'theme'.
export default function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    const stored = localStorage.getItem('theme');
    if (stored === 'dark') {
      root.classList.add('dark');
      body.classList.add('dark');
      root.dataset.theme = 'dark';
      setIsDark(true);
    } else if (stored === 'light') {
      root.classList.remove('dark');
      body.classList.remove('dark');
      root.dataset.theme = 'light';
      setIsDark(false);
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        root.classList.add('dark');
        body.classList.add('dark');
        root.dataset.theme = 'dark';
        setIsDark(true);
      } else {
        root.dataset.theme = 'light';
      }
    }
    // Sync with other toggle instances via custom event
    const onThemeChange = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (typeof detail?.dark === 'boolean') {
        setIsDark(detail.dark);
      }
    };
    window.addEventListener('themechange', onThemeChange);
    // Also listen for storage changes (e.g., manual localStorage edits)
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'theme') {
        const val = e.newValue;
        if (val === 'dark') setIsDark(true);
        else if (val === 'light') setIsDark(false);
      }
    };
    window.addEventListener('storage', onStorage);
    setMounted(true);
    return () => {
      window.removeEventListener('themechange', onThemeChange);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const applyTheme = useCallback((dark: boolean) => {
    const root = document.documentElement;
    const body = document.body;
    if (dark) {
      root.classList.add('dark');
      body.classList.add('dark');
      root.dataset.theme = 'dark';
    } else {
      root.classList.remove('dark');
      body.classList.remove('dark');
      root.dataset.theme = 'light';
    }
    try { localStorage.setItem('theme', dark ? 'dark' : 'light'); } catch {}
    window.dispatchEvent(new CustomEvent('themechange', { detail: { dark } }));
  }, []);

  const toggle = useCallback(() => {
    const next = !isDark;
    setIsDark(next);
    applyTheme(next);
    // Debug instrumentation: log theme state & presence of dark class
    const root = document.documentElement;
    const hasDark = root.classList.contains('dark');
    const ds = root.dataset.theme;
    console.log('[ThemeToggle] toggle ->', { next, hasDark, dataTheme: ds });
    // Force reflow to ensure Tailwind dark styles repaint
    void root.offsetHeight;
    // Fallback: if desired dark but class missing, reapply
    if (next && !hasDark) {
      root.classList.add('dark');
      document.body.classList.add('dark');
      console.warn('[ThemeToggle] Re-applied dark class (fallback)');
    }
  }, [isDark, applyTheme]);

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
