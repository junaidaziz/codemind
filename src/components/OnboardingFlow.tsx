'use client';

import React, { useState } from 'react';
import Link from 'next/link';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: string;
  completed: boolean;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
}

interface OnboardingFlowProps {
  onComplete?: () => void;
}

const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ onComplete }) => {
  const [steps, setSteps] = useState<OnboardingStep[]>([
    {
      id: 'welcome',
      title: 'Welcome to CodeMind',
      description: 'Get familiar with CodeMind\'s AI-powered code analysis platform',
      icon: '👋',
      completed: false,
      action: {
        label: 'Start Tour',
        onClick: () => markStepComplete('welcome')
      }
    },
    {
      id: 'create-project',
      title: 'Create Your First Project',
      description: 'Add your codebase to start asking questions and getting AI insights',
      icon: '📁',
      completed: false,
      action: {
        label: 'Create Project',
        href: '/projects'
      }
    },
    {
      id: 'explore-chat',
      title: 'Try the AI Chat',
      description: 'Ask questions about your code and get intelligent responses',
      icon: '💬',
      completed: false,
      action: {
        label: 'Start Chatting',
        href: '/chat'
      }
    },
    {
      id: 'view-analytics',
      title: 'Check Analytics',
      description: 'Monitor your usage patterns and system performance',
      icon: '📊',
      completed: false,
      action: {
        label: 'View Dashboard',
        href: '/analytics'
      }
    },
    {
      id: 'read-docs',
      title: 'Explore Documentation',
      description: 'Learn about advanced features, API integration, and best practices',
      icon: '📚',
      completed: false,
      action: {
        label: 'Read Docs',
        href: '/docs'
      }
    }
  ]);

  const markStepComplete = (stepId: string) => {
    setSteps(prev => prev.map(step => 
      step.id === stepId ? { ...step, completed: true } : step
    ));
  };

  const completedSteps = steps.filter(step => step.completed).length;
  const totalSteps = steps.length;
  const progressPercentage = (completedSteps / totalSteps) * 100;

  const allCompleted = completedSteps === totalSteps;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-3">
            Welcome to CodeMind! 🚀
          </h1>
          <p className="text-gray-600 text-lg">
            Let&apos;s get you started with your AI-powered code analysis journey
          </p>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">
              Progress: {completedSteps} of {totalSteps} completed
            </span>
            <span className="text-sm text-gray-500">
              {Math.round(progressPercentage)}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>

        {/* Onboarding Steps */}
        <div className="space-y-4">
          {steps.map((step, index) => (
            <div 
              key={step.id}
              className={`border rounded-lg p-6 transition-all ${
                step.completed 
                  ? 'border-green-200 bg-green-50' 
                  : 'border-gray-200 bg-white hover:border-blue-200'
              }`}
            >
              <div className="flex items-start space-x-4">
                <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-xl ${
                  step.completed 
                    ? 'bg-green-100 text-green-600' 
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {step.completed ? '✅' : step.icon}
                </div>
                
                <div className="flex-1 min-w-0">
                  <h3 className={`text-lg font-semibold mb-2 ${
                    step.completed ? 'text-green-900' : 'text-gray-900'
                  }`}>
                    Step {index + 1}: {step.title}
                  </h3>
                  <p className={`text-sm mb-4 ${
                    step.completed ? 'text-green-700' : 'text-gray-600'
                  }`}>
                    {step.description}
                  </p>
                  
                  {step.action && !step.completed && (
                    <div>
                      {step.action.href ? (
                        <Link
                          href={step.action.href}
                          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
                          onClick={() => markStepComplete(step.id)}
                        >
                          {step.action.label}
                          <span className="ml-2">→</span>
                        </Link>
                      ) : (
                        <button
                          onClick={step.action.onClick}
                          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
                        >
                          {step.action.label}
                          <span className="ml-2">→</span>
                        </button>
                      )}
                    </div>
                  )}
                  
                  {step.completed && (
                    <div className="text-green-600 text-sm font-medium">
                      ✓ Completed
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Completion Message */}
        {allCompleted && (
          <div className="mt-8 p-6 bg-green-50 border border-green-200 rounded-lg text-center">
            <div className="text-4xl mb-3">🎉</div>
            <h3 className="text-xl font-semibold text-green-900 mb-2">
              Congratulations! You&apos;re all set!
            </h3>
            <p className="text-green-700 mb-4">
              You&apos;ve completed the onboarding process. You&apos;re now ready to make the most of CodeMind.
            </p>
            <div className="flex justify-center space-x-4">
              <Link
                href="/projects"
                className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
              >
                Go to Projects
              </Link>
              <Link
                href="/docs"
                className="px-6 py-2 bg-white text-green-600 border border-green-600 rounded-md hover:bg-green-50 transition-colors"
              >
                Learn More
              </Link>
            </div>
            {onComplete && (
              <button
                onClick={onComplete}
                className="mt-4 text-sm text-gray-500 hover:text-gray-700 underline"
              >
                Close Onboarding
              </button>
            )}
          </div>
        )}

        {/* Quick Links */}
        <div className="mt-8 pt-8 border-t border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Links</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link
              href="/docs"
              className="p-4 border border-gray-200 rounded-lg hover:border-blue-200 transition-colors group"
            >
              <div className="text-2xl mb-2">📚</div>
              <h4 className="font-semibold text-gray-900 group-hover:text-blue-600">
                Documentation
              </h4>
              <p className="text-sm text-gray-600 mt-1">
                Complete guides and API reference
              </p>
            </Link>
            
            <Link
              href="/profile"
              className="p-4 border border-gray-200 rounded-lg hover:border-blue-200 transition-colors group"
            >
              <div className="text-2xl mb-2">⚙️</div>
              <h4 className="font-semibold text-gray-900 group-hover:text-blue-600">
                Settings
              </h4>
              <p className="text-sm text-gray-600 mt-1">
                Customize your CodeMind experience
              </p>
            </Link>
            
            <a
              href="mailto:support@codemind.dev"
              className="p-4 border border-gray-200 rounded-lg hover:border-blue-200 transition-colors group"
            >
              <div className="text-2xl mb-2">💬</div>
              <h4 className="font-semibold text-gray-900 group-hover:text-blue-600">
                Get Help
              </h4>
              <p className="text-sm text-gray-600 mt-1">
                Contact support for assistance
              </p>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

// Simple Welcome Banner Component for existing users
interface WelcomeBannerProps {
  userName?: string;
  onStartOnboarding?: () => void;
  onDismiss?: () => void;
}

export const WelcomeBanner: React.FC<WelcomeBannerProps> = ({ 
  userName, 
  onStartOnboarding,
  onDismiss 
}) => {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <span className="text-2xl">👋</span>
          <div>
            <h3 className="font-semibold text-blue-900">
              Welcome{userName ? ` back, ${userName}` : ' to CodeMind'}!
            </h3>
            <p className="text-blue-700 text-sm">
              Ready to explore your codebase with AI? Let&apos;s get started.
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {onStartOnboarding && (
            <button
              onClick={onStartOnboarding}
              className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
            >
              Quick Tour
            </button>
          )}
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="text-blue-600 hover:text-blue-800 p-1"
            >
              <span className="sr-only">Dismiss</span>
              ✕
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default OnboardingFlow;