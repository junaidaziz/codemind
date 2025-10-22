import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Workspaces | CodeMind',
  description: 'Manage your multi-repository workspaces',
};

export default function WorkspacesPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            🗂️ Workspaces
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage your multi-repository workspaces
          </p>
        </div>

        {/* Coming Soon Message */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
          <div className="max-w-2xl mx-auto">
            <div className="text-6xl mb-6">🚧</div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
              Multi-Repo Workspaces Coming Soon!
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              We've completed the backend infrastructure for Feature #3 (Multi-Repository Workspace Management),
              including all 6 phases with ~7,500 lines of code. The frontend UI is currently under development.
            </p>
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6 text-left">
              <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-3">
                ✅ Backend Features Available:
              </h3>
              <ul className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
                <li>• Workspace Management System</li>
                <li>• Multi-repo dependency graphs</li>
                <li>• Cross-repo issue and PR linking</li>
                <li>• GitHub Actions log analysis</li>
                <li>• Branch policy enforcement</li>
                <li>• Multi-organization support</li>
              </ul>
            </div>
            <div className="mt-6 flex justify-center gap-4">
              <a
                href="/projects"
                className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                Browse Projects
              </a>
              <a
                href="/dashboard"
                className="px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-medium rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Back to Dashboard
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
