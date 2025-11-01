'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './contexts/AuthContext';
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import HeroSection from '@/components/landing/HeroSection';
import AboutSection from '@/components/landing/AboutSection';
import FeaturesSection from '@/components/landing/FeaturesSection';
import ContactSection from '@/components/landing/ContactSection';

export default function HomePageClient() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Only redirect if user is logged in and not loading
    // Allow user to view home page if they explicitly navigate to it via logo click
    if (user && !loading) {
      // Check if user came from direct navigation (typing URL or bookmark)
      const isDirectNavigation = document.referrer === '';
      
      // Only redirect if this is a direct navigation
      if (isDirectNavigation) {
        router.replace('/dashboard');
      }
    }
  }, [user, loading, router]);

  // Show loading state while auth is being checked
  if (loading) {
    return (
      <div className="min-h-screen app-root surface-panel minimal rounded-none border-0 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-secondary">Loading...</p>
        </div>
      </div>
    );
  }

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
