import { Zap, Code, GitBranch, Shield } from 'lucide-react';
import FeatureCard from './FeatureCard';

export function FeaturesSection() {
  return (
    <section id="features" className="py-20 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="section-heading text-4xl sm:text-5xl mb-6">AI-Powered Capabilities</h2>
          <p className="text-xl text-secondary max-w-3xl mx-auto">
            Leverage the power of artificial intelligence to supercharge your development workflow
          </p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          <FeatureCard
            icon={<Zap className="w-6 h-6 text-blue-600 dark:text-blue-400" />}
            title="Auto-Fix Code Issues"
            description="AI analyzes bugs and automatically generates fixes with proper testing and validation before creating PRs."
            href="/docs"
            linkLabel="Learn More"
            linkColorClass="text-blue-600 dark:text-blue-400"
          />
          <FeatureCard
            icon={<Code className="w-6 h-6 text-purple-600 dark:text-purple-400" />}
            title="Code Generation"
            description="Generate production-ready code from natural language descriptions with proper types, tests, and documentation."
            href="/docs"
            linkLabel="Learn More"
            linkColorClass="text-purple-600 dark:text-purple-400"
          />
          <FeatureCard
            icon={<GitBranch className="w-6 h-6 text-green-600 dark:text-green-400" />}
            title="Intelligent Chat"
            description="Ask questions about your codebase and get context-aware answers with code examples and explanations."
            href="/chat"
            linkLabel="Try it Now"
            linkColorClass="text-green-600 dark:text-green-400"
          />
          <FeatureCard
            icon={<Shield className="w-6 h-6 text-orange-600 dark:text-orange-400" />}
            title="Project Analytics"
            description="Get deep insights into your project health, code quality, and team productivity with AI-powered analytics."
            href="/analytics"
            linkLabel="View Analytics"
            linkColorClass="text-orange-600 dark:text-orange-400"
          />
        </div>
      </div>
    </section>
  );
}

export default FeaturesSection;
