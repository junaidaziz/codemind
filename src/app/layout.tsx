import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./ui-consistency.css";
import { AuthProvider } from "./contexts/AuthContext";
import { AppHeader } from "./components/AppHeader";
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
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ErrorBoundary>
          <ToastProvider>
            <SessionProvider>
              <AuthProvider>
                <AppHeader />
                {children}
              </AuthProvider>
            </SessionProvider>
          </ToastProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
