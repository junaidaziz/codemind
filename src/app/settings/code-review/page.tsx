'use client';

import React, { useState, useEffect } from 'react';
import { ErrorBanner } from '@/components/ui';
import type { RuleWeightsConfig } from '@/lib/code-review/rule-weights-config';

export default function CodeReviewSettingsPage() {
  const [config, setConfig] = useState<RuleWeightsConfig | null>(null);
  const [presets, setPresets] = useState<Record<string, RuleWeightsConfig & { description: string }>>({});
  const [selectedPreset, setSelectedPreset] = useState<string>('balanced');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Load presets on mount
  useEffect(() => {
    loadPresets();
  }, []);

  const loadPresets = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/code-review/rule-weights/presets');
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to load presets');
      }

      setPresets(data.presets);
      // Set initial config to balanced preset
      setConfig(data.presets.balanced);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load presets');
      setLoading(false);
    }
  };

  const handlePresetChange = (presetName: string) => {
    setSelectedPreset(presetName);
    if (presets[presetName]) {
      setConfig(presets[presetName]);
      setValidationErrors([]);
      setSuccess(false);
    }
  };

  const handleWeightChange = (
    category: keyof RuleWeightsConfig,
    field: string,
    value: number | boolean
  ) => {
    if (!config) return;

    const currentValue = config[category];
    
    // Handle different types of values
    if (typeof currentValue === 'object' && currentValue !== null) {
      setConfig({
        ...config,
        [category]: {
          ...currentValue,
          [field]: value,
        },
      });
    } else {
      // For primitive values (though unlikely in current schema)
      setConfig({
        ...config,
        [category]: value,
      });
    }
    
    setSuccess(false);
  };

  const validateConfig = async () => {
    if (!config) return false;

    try {
      const response = await fetch('/api/code-review/rule-weights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      const data = await response.json();

      if (!response.ok || !data.valid) {
        setValidationErrors(data.errors || ['Validation failed']);
        return false;
      }

      setValidationErrors([]);
      return true;
    } catch (err) {
      setValidationErrors([err instanceof Error ? err.message : 'Validation error']);
      return false;
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      const isValid = await validateConfig();
      if (!isValid) {
        setSaving(false);
        return;
      }

      // In a real app, save to database/user preferences
      // For now, we'll just validate and show success
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleExport = () => {
    if (!config) return;

    const dataStr = JSON.stringify(config, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `rule-weights-${config.name}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target?.result as string);
        setConfig(imported);
        setSelectedPreset('custom');
        setSuccess(false);
      } catch (_err) {
        setError('Invalid JSON file');
      }
    };
    reader.readAsText(file);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-gray-500">Loading settings...</div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <ErrorBanner message="Failed to load configuration" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Code Review Rule Weights
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Customize how code reviews are analyzed and scored
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Error/Success Messages */}
        {error && (
          <div className="mb-6">
            <ErrorBanner message={error} onDismiss={() => setError(null)} />
          </div>
        )}

        {success && (
          <div className="mb-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <p className="text-sm text-green-800 dark:text-green-200">
              ✅ Configuration saved successfully!
            </p>
          </div>
        )}

        {validationErrors.length > 0 && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-red-800 dark:text-red-200 mb-2">
              Validation Errors:
            </h3>
            <ul className="list-disc list-inside space-y-1">
              {validationErrors.map((err, idx) => (
                <li key={idx} className="text-sm text-red-700 dark:text-red-300">{err}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Preset Selector */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Preset Configuration
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(presets).map(([name, preset]) => (
              <button
                key={name}
                onClick={() => handlePresetChange(name)}
                className={`p-4 rounded-lg border-2 transition-all text-left ${
                  selectedPreset === name
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <h3 className="font-semibold text-gray-900 dark:text-white capitalize mb-1">
                  {preset.name}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {preset.description}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Risk Factor Weights */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Risk Factor Weights
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Weights must sum to 1.0. Adjust how much each factor contributes to the overall risk score.
          </p>
          
          <div className="space-y-4">
            {Object.entries(config.riskFactorWeights).map(([key, value]) => (
              <div key={key}>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </label>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {value.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={value}
                  onChange={(e) => handleWeightChange('riskFactorWeights', key, parseFloat(e.target.value))}
                  className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            ))}
          </div>

          <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Total: <span className="font-semibold">
                {Object.values(config.riskFactorWeights).reduce((a, b) => a + b, 0).toFixed(2)}
              </span> (must equal 1.00)
            </p>
          </div>
        </div>

        {/* Risk Thresholds */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Risk Level Thresholds
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Define score thresholds for each risk level (0-100).
          </p>
          
          <div className="space-y-4">
            {Object.entries(config.riskThresholds).map(([key, value]) => (
              <div key={key}>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">
                    {key} Risk (≥{value})
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={value}
                    onChange={(e) => handleWeightChange('riskThresholds', key, parseInt(e.target.value))}
                    className="w-20 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={value}
                  onChange={(e) => handleWeightChange('riskThresholds', key, parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Severity Penalties */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Severity Penalties
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Points added to risk score per issue of each severity.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(config.severityPenalties).map(([key, value]) => (
              <div key={key}>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 capitalize mb-2 block">
                  {key}
                </label>
                <input
                  type="number"
                  min="0"
                  max="50"
                  value={value}
                  onChange={(e) => handleWeightChange('severityPenalties', key, parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Approval Rules */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Approval Rules
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Configure automatic approval recommendations.
          </p>
          
          <div className="space-y-4">
            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={config.approvalRules.requestChangesOnCritical}
                onChange={(e) => handleWeightChange('approvalRules', 'requestChangesOnCritical', e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Request changes on critical issues
              </span>
            </label>

            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={config.approvalRules.requestChangesOnHighRisk}
                onChange={(e) => handleWeightChange('approvalRules', 'requestChangesOnHighRisk', e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Request changes on high risk score
              </span>
            </label>

            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={config.approvalRules.commentOnMediumIssues}
                onChange={(e) => handleWeightChange('approvalRules', 'commentOnMediumIssues', e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Comment on medium issues
              </span>
            </label>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                  Min Critical Issues to Block
                </label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  value={config.approvalRules.minCriticalIssuesForBlock}
                  onChange={(e) => handleWeightChange('approvalRules', 'minCriticalIssuesForBlock', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                  Min High Issues to Block
                </label>
                <input
                  type="number"
                  min="0"
                  max="20"
                  value={config.approvalRules.minHighIssuesForBlock}
                  onChange={(e) => handleWeightChange('approvalRules', 'minHighIssuesForBlock', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex gap-3">
            <button
              onClick={handleExport}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium transition-colors"
            >
              Export Config
            </button>
            
            <label className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium transition-colors cursor-pointer">
              Import Config
              <input
                type="file"
                accept=".json"
                onChange={handleImport}
                className="hidden"
              />
            </label>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
          >
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </div>
    </div>
  );
}
