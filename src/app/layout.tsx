import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./ui-consistency.css";
import { AuthProvider } from "./contexts/AuthContext";
import { AppHeader } from "./components/AppHeader";
import DraggableThemeToggle from './components/DraggableThemeToggle';
import { ErrorBoundary } from "../components/ui";
import { ToastProvider } from "../components/ui/toast";
import { SessionProvider } from "../components/auth/SessionProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CodeMind - AI Code Assistant",
  description: "Chat with your codebase using AI - CodeMind helps you understand and work with your projects",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* Pre-hydration theme script to avoid flash and ensure dark class is applied early */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(() => { try { const t = localStorage.getItem('theme'); if (t === 'dark') { document.documentElement.classList.add('dark'); document.documentElement.dataset.theme='dark'; } else if (t === 'light') { document.documentElement.classList.remove('dark'); document.documentElement.dataset.theme='light'; } else { const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches; if (prefersDark) { document.documentElement.classList.add('dark'); document.documentElement.dataset.theme='dark'; } } } catch(_){} })();`,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors`}
      >
        <ErrorBoundary>
          <ToastProvider>
            <SessionProvider>
              <AuthProvider>
                <AppHeader />
                {children}
                {/* Draggable floating theme toggle (visible on all viewports) */}
                <DraggableThemeToggle />
              </AuthProvider>
            </SessionProvider>
          </ToastProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
