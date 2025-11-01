import { Metadata } from 'next';
import DashboardClient from './DashboardClient';

export const metadata: Metadata = {
  title: 'Dashboard | CodeMind',
  description: 'Your AI development dashboard',
};

export default function DashboardPage() {
  return (
    <div className="min-h-screen app-root">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <DashboardClient />
      </div>
    </div>
  );
}
