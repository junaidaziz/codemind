import Link from "next/link";
import { ArrowRight, Code, Zap, Shield, GitBranch, Sparkles, CheckCircle2 } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ContactForm from "@/components/ContactForm";
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
        {/* Hero Section */}
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
                  <span className="font-medium">Free forever plan</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* About Us Section */}
  <section id="about" className="py-20 transition-colors">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-4xl sm:text-5xl font-extrabold mb-4 tracking-tight text-[#1f2937] dark:text-white">
                About CodeMind
              </h2>
              <p className="text-xl text-secondary max-w-3xl mx-auto">
                We&apos;re on a mission to make software development more efficient and enjoyable
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <h3 className="text-3xl font-bold mb-6 tracking-tight text-[#1f2937] dark:text-white">
                  Our Story
                </h3>
                <p className="text-lg text-secondary mb-6">
                  CodeMind was born from the frustration of spending hours understanding complex codebases, debugging issues, and writing repetitive code. We believe developers should focus on solving interesting problems, not getting lost in code.
                </p>
                <p className="text-lg text-secondary mb-6">
                  Powered by cutting-edge AI technology, CodeMind understands your code deeply, provides intelligent insights, and automates tedious tasks so you can ship better software faster.
                </p>
                <div className="space-y-4">
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Code className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-primary">AI-Powered Understanding</h4>
                      <p className="text-secondary">Deep semantic analysis of your entire codebase</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                      <GitBranch className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-primary">Automated PR Generation</h4>
                      <p className="text-secondary">Let AI create pull requests with proper testing</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Shield className="w-5 h-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-primary">Smart Debugging</h4>
                      <p className="text-secondary">Identify and fix issues before they reach production</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="relative">
                <div className="aspect-square bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl p-8 shadow-2xl">
                  <div className="bg-white/10 backdrop-blur-xl rounded-xl p-6 h-full flex flex-col justify-center space-y-4">
                    <div className="text-white">
                      <div className="text-5xl font-bold mb-2">50+</div>
                      <div className="text-xl">AI-Powered Features</div>
                    </div>
                    <div className="text-white">
                      <div className="text-5xl font-bold mb-2">1000+</div>
                      <div className="text-xl">Developers Trust Us</div>
                    </div>
                    <div className="text-white">
                      <div className="text-5xl font-bold mb-2">99.9%</div>
                      <div className="text-xl">Uptime Guarantee</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* AI Features Section */}
  <section id="features" className="py-20 transition-colors">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-4xl sm:text-5xl font-bold text-primary mb-4">
                AI-Powered Capabilities
              </h2>
              <p className="text-xl text-secondary max-w-3xl mx-auto">
                Leverage the power of artificial intelligence to supercharge your development workflow
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {/* Feature 1 */}
              <div className="surface-card p-6 hover:shadow-xl transition-all duration-200 hover:-translate-y-1">
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center mb-4">
                  <Zap className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-xl font-bold text-primary mb-3">
                  Auto-Fix Code Issues
                </h3>
                <p className="text-secondary mb-4">
                  AI analyzes bugs and automatically generates fixes with proper testing and validation before creating PRs.
                </p>
                <Link href="/docs" className="text-blue-600 dark:text-blue-400 font-medium hover:underline flex items-center">
                  Learn More <ArrowRight className="w-4 h-4 ml-1" />
                </Link>
              </div>

              {/* Feature 2 */}
              <div className="surface-card p-6 hover:shadow-xl transition-all duration-200 hover:-translate-y-1">
                <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center mb-4">
                  <Code className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
                <h3 className="text-xl font-bold text-primary mb-3">
                  Code Generation
                </h3>
                <p className="text-secondary mb-4">
                  Generate production-ready code from natural language descriptions with proper types, tests, and documentation.
                </p>
                <Link href="/docs" className="text-purple-600 dark:text-purple-400 font-medium hover:underline flex items-center">
                  Learn More <ArrowRight className="w-4 h-4 ml-1" />
                </Link>
              </div>

              {/* Feature 3 */}
              <div className="surface-card p-6 hover:shadow-xl transition-all duration-200 hover:-translate-y-1">
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center mb-4">
                  <GitBranch className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-xl font-bold text-primary mb-3">
                  Intelligent Chat
                </h3>
                <p className="text-secondary mb-4">
                  Ask questions about your codebase and get context-aware answers with code examples and explanations.
                </p>
                <Link href="/chat" className="text-green-600 dark:text-green-400 font-medium hover:underline flex items-center">
                  Try it Now <ArrowRight className="w-4 h-4 ml-1" />
                </Link>
              </div>

              {/* Feature 4 */}
              <div className="surface-card p-6 hover:shadow-xl transition-all duration-200 hover:-translate-y-1">
                <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center mb-4">
                  <Shield className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                </div>
                <h3 className="text-xl font-bold text-primary mb-3">
                  Project Analytics
                </h3>
                <p className="text-secondary mb-4">
                  Get deep insights into your project health, code quality, and team productivity with AI-powered analytics.
                </p>
                <Link href="/analytics" className="text-orange-600 dark:text-orange-400 font-medium hover:underline flex items-center">
                  View Analytics <ArrowRight className="w-4 h-4 ml-1" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Contact Us Section */}
  <section id="contact" className="py-20 transition-colors">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-4xl sm:text-5xl font-bold text-primary mb-4">
                Get in Touch
              </h2>
              <p className="text-xl text-secondary max-w-3xl mx-auto">
                Have questions or feedback? We&apos;d love to hear from you!
              </p>
            </div>

            <div className="max-w-2xl mx-auto">
              <div className="surface-panel rounded-2xl p-8">
                <ContactForm />
              </div>

              <div className="mt-8 text-center text-secondary">
                <p>Or reach us at: <a href="mailto:hello@codemind.dev" className="text-blue-600 dark:text-blue-400 hover:underline">hello@codemind.dev</a></p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
