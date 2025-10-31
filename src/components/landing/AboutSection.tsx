import { Code, GitBranch, Shield } from 'lucide-react';

import { ReactNode } from 'react';

interface FeaturePoint {
  iconBg: string;
  icon: ReactNode;
  title: string;
  description: string;
}

const featurePoints: FeaturePoint[] = [
  {
    iconBg: 'bg-blue-100 dark:bg-blue-900/30',
    icon: <Code className="w-5 h-5 text-blue-600 dark:text-blue-400" />,
    title: 'AI-Powered Understanding',
    description: 'Deep semantic analysis of your entire codebase'
  },
  {
    iconBg: 'bg-purple-100 dark:bg-purple-900/30',
    icon: <GitBranch className="w-5 h-5 text-purple-600 dark:text-purple-400" />,
    title: 'Automated PR Generation',
    description: 'Let AI create pull requests with proper testing'
  },
  {
    iconBg: 'bg-green-100 dark:bg-green-900/30',
    icon: <Shield className="w-5 h-5 text-green-600 dark:text-green-400" />,
    title: 'Smart Debugging',
    description: 'Identify and fix issues before they reach production'
  }
];

export function AboutSection() {
  return (
    <section id="about" className="py-20 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="section-heading text-4xl sm:text-5xl mb-6 tracking-tight">About CodeMind</h2>
          <p className="text-xl text-secondary max-w-3xl mx-auto">We&apos;re on a mission to make software development more efficient and enjoyable</p>
        </div>

        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <h3 className="feature-heading text-3xl mb-6 tracking-tight">Our Story</h3>
            <p className="text-lg text-secondary mb-6">CodeMind was born from the frustration of spending hours understanding complex codebases, debugging issues, and writing repetitive code. We believe developers should focus on solving interesting problems, not getting lost in code.</p>
            <p className="text-lg text-secondary mb-6">Powered by cutting-edge AI technology, CodeMind understands your code deeply, provides intelligent insights, and automates tedious tasks so you can ship better software faster.</p>
            <div className="space-y-4">
              {featurePoints.map(fp => (
                <div key={fp.title} className="flex items-start space-x-3">
                  <div className={`w-8 h-8 ${fp.iconBg} rounded-lg flex items-center justify-center flex-shrink-0`}>{fp.icon}</div>
                  <div>
                    <h4 className="feature-heading">{fp.title}</h4>
                    <p className="feature-subtext">{fp.description}</p>
                  </div>
                </div>
              ))}
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
  );
}

export default AboutSection;
