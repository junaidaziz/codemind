// CI Integration Dashboard Page
import { CIDashboard } from '../../components/CIDashboard';

export default function CIPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <CIDashboard />
      </div>
    </div>
  );
}

export const metadata = {
  title: 'CI Integration - CodeMind',
  description: 'Manage continuous integration and automated code analysis',
};