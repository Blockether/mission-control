'use client';

import { useState, useEffect, useCallback } from 'react';
import { Settings, Cpu, Save, RefreshCw, CheckCircle2 } from 'lucide-react';

interface ModelsResponse {
  defaultModel?: string;
  availableModels: string[];
  source: 'remote' | 'local' | 'fallback';
  error?: string;
}

interface SaveResponse {
  success: boolean;
  defaultModel: string;
  previousModel?: string;
}

export function SettingsPanel() {
  const [modelsData, setModelsData] = useState<ModelsResponse | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [currentModel, setCurrentModel] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchModels = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch('/api/openclaw/models');
      if (res.ok) {
        const data: ModelsResponse = await res.json();
        setModelsData(data);
        setCurrentModel(data.defaultModel || '');
        setSelectedModel(data.defaultModel || data.availableModels[0] || '');
      } else {
        setFetchError('Failed to fetch models');
      }
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to fetch models');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  const handleSave = async () => {
    if (!selectedModel) return;

    setSaving(true);
    setSaveStatus('saving');
    setError(null);

    try {
      const res = await fetch('/api/openclaw/models', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ defaultModel: selectedModel }),
      });

      if (res.ok) {
        const data: SaveResponse = await res.json();
        if (data.success) {
          setCurrentModel(data.defaultModel);
          setSaveStatus('saved');
          setTimeout(() => {
            setSaveStatus('idle');
          }, 2000);
        } else {
          setSaveStatus('error');
          setError('Failed to save default model');
        }
      } else {
        setSaveStatus('error');
        setError('Failed to save default model');
      }
    } catch (err) {
      setSaveStatus('error');
      setError(err instanceof Error ? err.message : 'Failed to save default model');
    } finally {
      setSaving(false);
    }
  };

  const getSaveButtonText = () => {
    switch (saveStatus) {
      case 'saving':
        return 'Saving...';
      case 'saved':
        return 'Saved';
      case 'error':
        return 'Save';
      default:
        return 'Save';
    }
  };

  return (
    <div data-component="src/components/SettingsPanel" className="min-h-screen">
      {/* Toolbar */}
      <div className="p-3 border-b border-mc-border bg-mc-bg-secondary flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4 text-mc-accent" />
          <span className="font-mono font-medium">Settings</span>
        </div>
        <button
          onClick={fetchModels}
          disabled={loading}
          className="flex items-center gap-2 px-3 min-h-11 border border-mc-border rounded text-sm hover:bg-mc-bg-tertiary disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">{loading ? 'Refreshing...' : 'Refresh'}</span>
        </button>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {fetchError && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {fetchError}
          </div>
        )}

        {/* Card: Default Model */}
        <div className="rounded-lg border border-mc-border bg-mc-bg overflow-hidden">
          <div className="p-3 border-b border-mc-border bg-mc-bg-secondary flex items-center gap-2">
            <Cpu className="w-4 h-4 text-mc-text-secondary" />
            <h3 className="text-sm font-medium">Default Model</h3>
          </div>
          <div className="p-4">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="w-5 h-5 animate-spin text-mc-text-secondary" />
              </div>
            ) : modelsData ? (
              <div className="space-y-4">
                {modelsData.error && (
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded text-yellow-700 text-sm">
                    {modelsData.error}
                  </div>
                )}

                {/* Current Model Display */}
                <div>
                  <p className="text-sm text-mc-text-secondary mb-1">Current</p>
                  <code className="font-mono text-lg">{currentModel || 'Not set'}</code>
                </div>

                {/* Model Selection Dropdown */}
                <div>
                  <label className="block text-sm text-mc-text-secondary mb-2">
                    Select Default Model
                  </label>
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="w-full p-2 border border-mc-border rounded bg-mc-bg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-mc-accent/50"
                    disabled={saving || modelsData.availableModels.length === 0}
                  >
                    {modelsData.availableModels.length === 0 ? (
                      <option value="">No models available</option>
                    ) : (
                      modelsData.availableModels.map((model) => (
                        <option key={model} value={model}>
                          {model}
                        </option>
                      ))
                    )}
                  </select>
                  <p className="text-xs text-mc-text-secondary mt-2">Source: {modelsData.source}</p>
                </div>

                {/* Error Message */}
                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                    {error}
                  </div>
                )}

                {/* Save Button */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleSave}
                    disabled={saving || !selectedModel || selectedModel === currentModel}
                    className="flex items-center gap-2 px-4 py-2 bg-mc-accent text-white rounded text-sm font-medium hover:bg-mc-accent/90 disabled:opacity-50 transition-colors"
                  >
                    {saveStatus === 'saved' ? (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        Saved
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        {getSaveButtonText()}
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-mc-text-secondary">
                No model data available
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
