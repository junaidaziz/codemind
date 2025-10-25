"use client";
import { ThemeProvider as NextThemeProvider } from "next-themes";
import React from "react";

// Wrapper around next-themes to centralize configuration.
// Uses class strategy (html element gets 'dark') and respects system preference.
// Disable automatic color-scheme meta to avoid conflicts; we manage via Tailwind.
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      enableColorScheme={false}
      disableTransitionOnChange
    >
      {children}
    </NextThemeProvider>
  );
}
