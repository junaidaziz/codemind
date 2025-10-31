// Landing page sections composed from reusable components
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import HeroSection from '@/components/landing/HeroSection';
import AboutSection from '@/components/landing/AboutSection';
import FeaturesSection from '@/components/landing/FeaturesSection';
import ContactSection from '@/components/landing/ContactSection';
import type { Metadata } from 'next';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// SEO Metadata
export const metadata: Metadata = {
  title: 'CodeMind - AI-Powered Developer Assistant for Smarter Coding',
  description: 'CodeMind helps you understand, analyze, and improve your codebase with intelligent automation, automated testing, and AI-powered code reviews. Get started free today!',
  keywords: ['AI code assistant', 'code analysis', 'automated testing', 'code review', 'developer tools', 'AI developer assistant'],
  authors: [{ name: 'CodeMind Team' }],
  openGraph: {
    title: 'CodeMind - AI-Powered Developer Assistant',
    description: 'Understand, analyze, and improve your codebase with AI-powered insights',
    type: 'website',
    locale: 'en_US',
    siteName: 'CodeMind'
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CodeMind - AI-Powered Developer Assistant',
    description: 'Understand, analyze, and improve your codebase with AI-powered insights'
  }
};

export default function Home() {
  return (
  <div className="min-h-screen app-root surface-panel minimal rounded-none border-0">
      <Header />
      
      <main>
        <HeroSection />
        <AboutSection />
        <FeaturesSection />
        <ContactSection />
      </main>

      <Footer />
    </div>
  );
}
