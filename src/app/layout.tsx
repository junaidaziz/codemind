import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./ui-consistency.css";
import { AuthProvider } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeProvider";
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
        {/* next-themes will handle initial theme; removed manual pre-hydration script */}
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased app-root text-gray-900 dark:text-gray-100 transition-colors`}
      >
        <ThemeProvider>
          <ErrorBoundary>
            <ToastProvider>
              <SessionProvider>
                <AuthProvider>
                  <AppHeader />
                  {children}
                  <DraggableThemeToggle />
                </AuthProvider>
              </SessionProvider>
            </ToastProvider>
          </ErrorBoundary>
        </ThemeProvider>
      </body>
    </html>
  );
}
