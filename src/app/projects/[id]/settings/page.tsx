'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { FullPageSpinner, ErrorBanner } from '../../../../components/ui';
import { ProtectedRoute } from '../../../components/ProtectedRoute';

interface Project {
  id: string;
  name: string;
  githubUrl: string;
  status: string;
  lastIndexedAt: string | null;
}

interface ProjectConfig {
  id?: number;
  projectId: number;
  vercelToken?: string;
  vercelProjectId?: string;
  vercelTeamId?: string;
  openaiApiKey?: string;
  githubAppId?: string;
  githubPrivateKey?: string;
  githubInstallationId?: string;
  githubWebhookSecret?: string;
}

interface ConfigField {
  key: keyof ProjectConfig;
  label: string;
  description: string;
  type: 'text' | 'textarea' | 'password';
  placeholder: string;
  required?: boolean;
}

const CONFIG_FIELDS: ConfigField[] = [
  {
    key: 'vercelToken',
    label: 'Vercel API Token',
    description: 'API token for Vercel deployment integration',
    type: 'password',
    placeholder: 'vercel_xxxxxxxxxxxx',
    required: false
  },
  {
    key: 'vercelProjectId',
    label: 'Vercel Project ID',
    description: 'Vercel project identifier for deployments',
    type: 'text',
    placeholder: 'prj_xxxxxxxxxxxx',
    required: false
  },
  {
    key: 'vercelTeamId',
    label: 'Vercel Team ID',
    description: 'Optional team ID for Vercel organization deployments',
    type: 'text',
    placeholder: 'team_xxxxxxxxxxxx',
    required: false
  },
  {
    key: 'openaiApiKey',
    label: 'OpenAI API Key',
    description: 'API key for AI services and code analysis',
    type: 'password',
    placeholder: 'sk-xxxxxxxxxxxx',
    required: false
  },
  {
    key: 'githubAppId',
    label: 'GitHub App ID',
    description: 'GitHub App identifier for repository integration',
    type: 'text',
    placeholder: '123456',
    required: false
  },
  {
    key: 'githubPrivateKey',
    label: 'GitHub Private Key',
    description: 'PEM private key for GitHub App authentication',
    type: 'textarea',
    placeholder: '-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----',
    required: false
  },
  {
    key: 'githubInstallationId',
    label: 'GitHub Installation ID',
    description: 'GitHub App installation identifier',
    type: 'text',
    placeholder: '12345678',
    required: false
  },
  {
    key: 'githubWebhookSecret',
    label: 'GitHub Webhook Secret',
    description: 'Secret for validating GitHub webhook signatures',
    type: 'password',
    placeholder: 'whsec_xxxxxxxxxxxx',
    required: false
  }
];

function ProjectSettingsPageContent() {
  const params = useParams();
  const projectId = params.id as string;
  
  const [project, setProject] = useState<Project | null>(null);
  const [config, setConfig] = useState<ProjectConfig>({
    projectId: parseInt(projectId)
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'configuration' | 'danger'>('configuration');
  const [showSensitive, setShowSensitive] = useState<Record<string, boolean>>({});
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string }>>({});

  useEffect(() => {
    const fetchProject = async () => {
      try {
        const response = await fetch(`/api/projects/${projectId}`);
        if (!response.ok) throw new Error('Failed to fetch project');
        const data = await response.json();
        setProject(data);
      } catch (err) {
        console.error('Error fetching project:', err);
        setError('Failed to load project details');
      }
    };

    const fetchConfig = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/projects/${projectId}/config`);
        if (response.ok) {
          const data = await response.json();
          setConfig(data);
        } else if (response.status === 404) {
          // Config doesn't exist yet, that's fine
          setConfig({ projectId: parseInt(projectId) });
        } else {
          throw new Error('Failed to fetch configuration');
        }
      } catch (err) {
        console.error('Error fetching config:', err);
        setError('Failed to load project configuration');
      } finally {
        setLoading(false);
      }
    };

    fetchProject();
    fetchConfig();
  }, [projectId]);

  const handleConfigChange = (key: keyof ProjectConfig, value: string) => {
    setConfig(prev => ({
      ...prev,
      [key]: value || undefined
    }));
  };

  const toggleShowSensitive = (key: string) => {
    setShowSensitive(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const maskSensitiveValue = (value: string | number | undefined) => {
    if (!value) return '';
    const stringValue = String(value);
    if (stringValue.length <= 8) return '••••••••';
    return stringValue.substring(0, 4) + '••••••••' + stringValue.substring(stringValue.length - 4);
  };

  const handleSaveConfig = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const method = config.id ? 'PUT' : 'POST';
      const response = await fetch(`/api/projects/${projectId}/config`, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        throw new Error('Failed to save configuration');
      }

      const savedConfig = await response.json();
      setConfig(savedConfig);
      setSuccess('Configuration saved successfully');
    } catch (err) {
      console.error('Error saving config:', err);
      setError('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    try {
      setTesting(true);
      setTestResults({});

      const response = await fetch(`/api/projects/${projectId}/config/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        throw new Error('Failed to test connections');
      }

      const results = await response.json();
      setTestResults(results);
    } catch (err) {
      console.error('Error testing connections:', err);
      setError('Failed to test connections');
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return <FullPageSpinner text="Loading project settings..." />;
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
        <div className="max-w-4xl mx-auto p-8">
          <ErrorBanner message="Project not found" type="error" />
          <Link href="/projects" className="text-blue-500 hover:text-blue-600 mt-4 inline-block">
            ← Back to Projects
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
      <div className="max-w-4xl mx-auto p-8">
        {/* Header */}
        <div className="mb-8">
          <nav className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            <Link href="/projects" className="hover:text-gray-700 dark:hover:text-gray-300">
              Projects
            </Link>
            {' / '}
            <Link href={`/projects/${project.id}`} className="hover:text-gray-700 dark:hover:text-gray-300">
              {project.name}
            </Link>
            {' / '}
            <span className="text-gray-900 dark:text-white">Settings</span>
          </nav>
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">⚙️ Project Settings</h1>
              <p className="text-gray-600 dark:text-gray-400">
                Configure integrations and manage project-specific settings for <span className="font-medium">{project.name}</span>
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href={`/projects/${project.id}`}
                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                ← Back to Project
              </Link>
            </div>
          </div>
        </div>

        {/* Status Messages */}
        {error && (
          <ErrorBanner
            message={error}
            type="error"
            onDismiss={() => setError(null)}
            className="mb-6"
          />
        )}
        
        {success && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <div className="text-green-600 dark:text-green-400 mr-3">✅</div>
              <div className="text-green-800 dark:text-green-200">{success}</div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700 mb-8">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('configuration')}
              className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'configuration'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              🔧 Configuration
            </button>
            <button
              onClick={() => setActiveTab('danger')}
              className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'danger'
                  ? 'border-red-500 text-red-600 dark:text-red-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              ⚠️ Danger Zone
            </button>
          </nav>
        </div>

        {/* Configuration Tab */}
        {activeTab === 'configuration' && (
          <div className="space-y-8">
            {/* Introduction */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
              <div className="flex items-start gap-3">
                <div className="text-blue-600 dark:text-blue-400 text-xl">🔐</div>
                <div>
                  <h3 className="font-semibold text-blue-900 dark:text-blue-300 mb-2">Project-Specific Configuration</h3>
                  <p className="text-sm text-blue-800 dark:text-blue-300 leading-relaxed">
                    Configure API keys and integration settings specific to this project. These settings will override global defaults 
                    and enable per-project customization of Vercel deployments, GitHub integration, and AI services.
                  </p>
                  <p className="text-sm text-blue-800 dark:text-blue-300 leading-relaxed mt-2">
                    All sensitive data is encrypted before storage and masked in the interface for security.
                  </p>
                </div>
              </div>
            </div>

            {/* Configuration Form */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold">Integration Settings</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Configure API keys and credentials for external services
                </p>
              </div>

              <div className="p-6 space-y-8">
                {CONFIG_FIELDS.map((field) => (
                  <div key={field.key} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {field.label}
                          {field.required && <span className="text-red-500 ml-1">*</span>}
                        </label>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                          {field.description}
                        </p>
                      </div>
                      {(field.type === 'password' || field.type === 'textarea') && config[field.key] && (
                        <button
                          type="button"
                          onClick={() => toggleShowSensitive(field.key)}
                          className="text-xs text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                          {showSensitive[field.key] ? '🙈 Hide' : '👁️ Show'}
                        </button>
                      )}
                    </div>

                    {field.type === 'textarea' ? (
                      <textarea
                        value={
                          showSensitive[field.key] 
                            ? config[field.key] || ''
                            : config[field.key] 
                            ? maskSensitiveValue(config[field.key])
                            : ''
                        }
                        onChange={(e) => handleConfigChange(field.key, e.target.value)}
                        placeholder={field.placeholder}
                        rows={6}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                                 bg-white dark:bg-gray-700 text-gray-900 dark:text-white 
                                 placeholder-gray-500 dark:placeholder-gray-400 
                                 focus:ring-2 focus:ring-blue-500 focus:border-transparent
                                 font-mono text-sm"
                      />
                    ) : (
                      <input
                        type={
                          field.type === 'password' && !showSensitive[field.key] 
                            ? 'password' 
                            : 'text'
                        }
                        value={
                          field.type === 'password' && !showSensitive[field.key] && config[field.key]
                            ? maskSensitiveValue(config[field.key])
                            : config[field.key] || ''
                        }
                        onChange={(e) => handleConfigChange(field.key, e.target.value)}
                        placeholder={field.placeholder}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                                 bg-white dark:bg-gray-700 text-gray-900 dark:text-white 
                                 placeholder-gray-500 dark:placeholder-gray-400 
                                 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    )}

                    {/* Test Results */}
                    {testResults[field.key] && (
                      <div className={`p-3 rounded-md border text-sm ${
                        testResults[field.key].success
                          ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200'
                          : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
                      }`}>
                        <div className="flex items-center">
                          <span className="mr-2">
                            {testResults[field.key].success ? '✅' : '❌'}
                          </span>
                          {testResults[field.key].message}
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {/* Action Buttons */}
                <div className="flex items-center justify-between pt-6 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={handleTestConnection}
                    disabled={testing}
                    className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 
                             disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {testing ? (
                      <div className="flex items-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                        Testing Connections...
                      </div>
                    ) : (
                      '🔍 Test Connections'
                    )}
                  </button>

                  <button
                    onClick={handleSaveConfig}
                    disabled={saving}
                    className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 
                             disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {saving ? (
                      <div className="flex items-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                        Saving...
                      </div>
                    ) : (
                      '💾 Save Configuration'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Danger Zone Tab */}
        {activeTab === 'danger' && (
          <div className="space-y-6">
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
              <div className="flex items-start gap-3">
                <div className="text-red-600 dark:text-red-400 text-xl">⚠️</div>
                <div>
                  <h3 className="font-semibold text-red-900 dark:text-red-300 mb-2">Danger Zone</h3>
                  <p className="text-sm text-red-800 dark:text-red-300 leading-relaxed">
                    These actions are irreversible and can permanently affect your project configuration and data.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 border border-red-200 dark:border-red-700 rounded-lg">
              <div className="p-6">
                <h4 className="text-lg font-semibold text-red-900 dark:text-red-100 mb-2">
                  Reset Configuration
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Remove all stored API keys and configuration settings for this project. This will revert to using global defaults.
                </p>
                <button 
                  className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                  onClick={() => {
                    if (confirm('Are you sure you want to reset all configuration settings? This action cannot be undone.')) {
                      // TODO: Implement reset functionality
                      alert('Reset functionality will be implemented in a future update.');
                    }
                  }}
                >
                  🗑️ Reset Configuration
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ProjectSettingsPage() {
  return (
    <ProtectedRoute>
      <ProjectSettingsPageContent />
    </ProtectedRoute>
  );
}