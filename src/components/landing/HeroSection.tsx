import Link from 'next/link';
import { Sparkles, ArrowRight, CheckCircle2 } from 'lucide-react';

export function HeroSection() {
  return (
    <section className="hero-bg relative overflow-hidden py-20 sm:py-32 transition-colors surface">
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <div className="hero-badge mb-8">
            <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>AI-Powered Developer Assistant</span>
          </div>

          <h1 className="hero-heading text-5xl sm:text-6xl lg:text-7xl font-extrabold mb-6 tracking-tight">
            Code Smarter with
            <span className="heading-accent inline-block ml-3">AI-Powered Insights</span>
          </h1>

          <p className="hero-subtext text-xl sm:text-2xl mb-10 max-w-3xl mx-auto">
            CodeMind helps you understand, analyze, and improve your codebase with intelligent automation, automated testing, and AI-powered code reviews.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/auth/signup"
              aria-label="Sign up for CodeMind"
              className="btn-primary-gradient group"
            >
              <span className="tracking-wide">Get Started Free</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href="/docs"
              aria-label="View CodeMind documentation"
              className="btn-secondary-accent"
            >
              View Documentation
            </Link>
          </div>

          <div className="mt-12 flex items-center justify-center space-x-8 text-sm text-secondary">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              <span className="heading-accent font-semibold">No credit card required</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              <span className="heading-accent font-semibold">Free forever plan</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default HeroSection;
