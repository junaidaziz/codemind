import { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Testing Automation | CodeMind',
  description: 'AI-powered testing automation and coverage analysis',
};

export default function TestingPage() {
  // Redirect to coverage page as default
  redirect('/testing/coverage');
}
