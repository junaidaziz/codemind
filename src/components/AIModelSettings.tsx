'use client';

import { useState, useEffect } from 'react';
import { MODEL_CONFIGS, AIModel, AIProvider } from '@/lib/ai-model-service';

interface ModelConfig {
  preferredModel: string;
  fallbackModel: string;
  maxTokens: number;
  temperature: number;
  openaiApiKey?: string;
  anthropicApiKey?: string;
}

interface UsageStats {
  totalCost: number;
  totalTokens: number;
  totalRequests: number;
  byModel: Record<string, { cost: number; tokens: number; requests: number }>;
  byProvider: Record<string, { cost: number; tokens: number; requests: number }>;
}

export default function AIModelSettings({ projectId }: { projectId: string }) {
  const [config, setConfig] = useState<ModelConfig>({
    preferredModel: 'gpt-4-turbo-preview',
    fallbackModel: 'gpt-3.5-turbo',
    maxTokens: 4096,
    temperature: 0.7,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);

  useEffect(() => {
    loadConfig();
    loadUsageStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const loadConfig = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/config`);
      if (response.ok) {
        const data = await response.json();
        setConfig({
          preferredModel: data.preferredModel || 'gpt-4-turbo-preview',
          fallbackModel: data.fallbackModel || 'gpt-3.5-turbo',
          maxTokens: data.maxTokens || 4096,
          temperature: data.temperature || 0.7,
          openaiApiKey: data.openaiApiKey ? '***' : undefined,
          anthropicApiKey: data.anthropicApiKey ? '***' : undefined,
        });
      }
    } catch (error) {
      console.error('Failed to load config:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUsageStats = async () => {
    try {
      const response = await fetch(`/api/ai-models/usage?projectId=${projectId}`);
      if (response.ok) {
        const data = await response.json();
        setUsageStats(data);
      }
    } catch (error) {
      console.error('Failed to load usage stats:', error);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/config`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        throw new Error('Failed to save config');
      }

      alert('Configuration saved successfully!');
    } catch (error) {
      console.error('Failed to save config:', error);
      alert('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const groupedModels: Record<AIProvider, AIModel[]> = {
    openai: [],
    anthropic: [],
    mistral: [],
    local: [],
  };

  Object.entries(MODEL_CONFIGS).forEach(([model, modelConfig]) => {
    groupedModels[modelConfig.provider].push(model as AIModel);
  });

  const selectedModelConfig = MODEL_CONFIGS[config.preferredModel as AIModel];
  const estimatedCost =
    (selectedModelConfig?.costPerPromptToken * 1000 +
      selectedModelConfig?.costPerCompletionToken * 1000) *
    config.maxTokens;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-400">Loading configuration...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">AI Model Settings</h2>
        <p className="text-gray-400">
          Configure which AI models to use for this project and manage API keys
        </p>
      </div>

      {/* Model Selection */}
      <div className="bg-gray-800 rounded-lg p-6 space-y-6">
        <h3 className="text-lg font-semibold text-white mb-4">Model Configuration</h3>

        {/* Preferred Model */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Preferred Model
          </label>
          <select
            value={config.preferredModel}
            onChange={(e) => setConfig({ ...config, preferredModel: e.target.value })}
            className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          >
            {Object.entries(groupedModels).map(([provider, models]) => (
              <optgroup key={provider} label={provider.toUpperCase()}>
                {models.map((model) => (
                  <option key={model} value={model}>
                    {model} - ${MODEL_CONFIGS[model].costPerPromptToken * 1000000}/1M
                    prompt tokens
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <p className="text-sm text-gray-400 mt-1">
            Primary model to use for all AI operations
          </p>
        </div>

        {/* Fallback Model */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Fallback Model
          </label>
          <select
            value={config.fallbackModel}
            onChange={(e) => setConfig({ ...config, fallbackModel: e.target.value })}
            className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          >
            {Object.entries(groupedModels).map(([provider, models]) => (
              <optgroup key={provider} label={provider.toUpperCase()}>
                {models.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <p className="text-sm text-gray-400 mt-1">
            Backup model if primary model fails or is unavailable
          </p>
        </div>

        {/* Advanced Settings */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Max Tokens
            </label>
            <input
              type="number"
              value={config.maxTokens}
              onChange={(e) =>
                setConfig({ ...config, maxTokens: parseInt(e.target.value) })
              }
              min="1"
              max={selectedModelConfig?.contextWindow || 128000}
              className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
            <p className="text-sm text-gray-400 mt-1">Maximum response length</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Temperature
            </label>
            <input
              type="number"
              value={config.temperature}
              onChange={(e) =>
                setConfig({ ...config, temperature: parseFloat(e.target.value) })
              }
              min="0"
              max="2"
              step="0.1"
              className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
            <p className="text-sm text-gray-400 mt-1">
              Higher = more creative (0-2)
            </p>
          </div>
        </div>

        {/* Cost Estimate */}
        <div className="bg-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-400">Estimated Cost per Request</div>
              <div className="text-2xl font-bold text-white">
                ${estimatedCost.toFixed(4)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-400">Context Window</div>
              <div className="text-lg font-semibold text-white">
                {selectedModelConfig?.contextWindow.toLocaleString()} tokens
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* API Keys */}
      <div className="bg-gray-800 rounded-lg p-6 space-y-4">
        <h3 className="text-lg font-semibold text-white mb-4">API Keys</h3>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            OpenAI API Key
          </label>
          <input
            type="password"
            value={config.openaiApiKey || ''}
            onChange={(e) => setConfig({ ...config, openaiApiKey: e.target.value })}
            placeholder="sk-..."
            className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
          <p className="text-sm text-gray-400 mt-1">
            Required for GPT models (encrypted at rest)
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Anthropic API Key
          </label>
          <input
            type="password"
            value={config.anthropicApiKey || ''}
            onChange={(e) => setConfig({ ...config, anthropicApiKey: e.target.value })}
            placeholder="sk-ant-..."
            className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
          <p className="text-sm text-gray-400 mt-1">
            Required for Claude models (encrypted at rest)
          </p>
        </div>
      </div>

      {/* Usage Statistics */}
      {usageStats && (
        <div className="bg-gray-800 rounded-lg p-6 space-y-4">
          <h3 className="text-lg font-semibold text-white mb-4">Usage Statistics</h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-700 rounded-lg p-4">
              <div className="text-sm text-gray-400">Total Cost</div>
              <div className="text-2xl font-bold text-white">
                ${usageStats.totalCost.toFixed(4)}
              </div>
            </div>

            <div className="bg-gray-700 rounded-lg p-4">
              <div className="text-sm text-gray-400">Total Tokens</div>
              <div className="text-2xl font-bold text-white">
                {usageStats.totalTokens.toLocaleString()}
              </div>
            </div>

            <div className="bg-gray-700 rounded-lg p-4">
              <div className="text-sm text-gray-400">Total Requests</div>
              <div className="text-2xl font-bold text-white">
                {usageStats.totalRequests.toLocaleString()}
              </div>
            </div>
          </div>

          {/* By Model */}
          {Object.keys(usageStats.byModel).length > 0 && (
            <div>
              <h4 className="text-md font-medium text-white mb-2">Usage by Model</h4>
              <div className="space-y-2">
                {Object.entries(usageStats.byModel).map(([model, stats]) => (
                  <div
                    key={model}
                    className="flex items-center justify-between bg-gray-700 rounded p-3"
                  >
                    <div className="text-white font-medium">{model}</div>
                    <div className="flex gap-4 text-sm">
                      <span className="text-gray-400">
                        ${stats.cost.toFixed(4)}
                      </span>
                      <span className="text-gray-400">
                        {stats.tokens.toLocaleString()} tokens
                      </span>
                      <span className="text-gray-400">
                        {stats.requests} requests
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving...' : 'Save Configuration'}
        </button>
      </div>
    </div>
  );
}
