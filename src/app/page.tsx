import Link from "next/link";
import prisma from "./lib/db";
// Intentional TypeScript error for testing
const testError: number = "this will cause a TypeScript error";

export default async function Home() {
  const projects = await prisma.project.findMany({
    select: {
      id: true,
      name: true,
      status: true,
      lastIndexedAt: true,
      createdAt: true
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  return (
    <main className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
      <div className="max-w-6xl mx-auto p-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-4">🧠 CodeMind</h1>
          <p className="text-gray-600 dark:text-gray-400 text-lg">
            AI-powered code assistant that helps you understand and work with your projects.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <Link
            href="/chat"
            className="block p-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
          >
            <div className="flex items-center mb-3">
              <span className="text-2xl mr-3">💬</span>
              <h2 className="text-xl font-semibold">Chat with Your Code</h2>
            </div>
            <p className="text-gray-600 dark:text-gray-300">
              Ask questions about your codebase and get intelligent responses with context.
            </p>
          </Link>

          <Link
            href="/projects"
            className="block p-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
          >
            <div className="flex items-center mb-3">
              <span className="text-2xl mr-3">📁</span>
              <h2 className="text-xl font-semibold">Manage Projects</h2>
            </div>
            <p className="text-gray-600 dark:text-gray-300">
              View and manage your indexed projects, check status, and reindex when needed.
            </p>
          </Link>
        </div>

        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6">
          <h2 className="text-2xl font-bold mb-4">Recent Projects</h2>
          {projects.length === 0 ? (
            <p className="text-gray-600 dark:text-gray-400">
              No projects found. Add some projects to get started!
            </p>
          ) : (
            <div className="space-y-4">
              {projects.slice(0, 5).map((project: typeof projects[0]) => (
                <div
                  key={project.id}
                  className="flex items-center justify-between p-4 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600"
                >
                  <div>
                    <h3 className="font-semibold">{project.name}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      Status: <span className="capitalize">{project.status}</span>
                      {project.lastIndexedAt && (
                        <span className="ml-2">
                          • Last indexed: {new Date(project.lastIndexedAt).toLocaleDateString()}
                        </span>
                      )}
                    </p>
                  </div>
                  <Link
                    href={`/chat?project=${project.id}`}
                    className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors text-sm"
                  >
                    Chat
                  </Link>
                </div>
              ))}
              {projects.length > 5 && (
                <Link
                  href="/projects"
                  className="block text-center text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  View all {projects.length} projects →
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
