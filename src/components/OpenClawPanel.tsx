'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw,
  Cpu,
  Wifi,
  WifiOff,
  Bot,
  Star,
  AlertCircle,
} from 'lucide-react';
import type { Agent, AgentStatus } from '@/lib/types';

interface OpenClawSession {
  id: string;
  channel: string;
  peer?: string;
  model?: string;
  status: string;
}

interface OpenClawStatus {
  connected: boolean;
  sessions_count: number;
  sessions: OpenClawSession[];
  gateway_url: string;
  error?: string;
}

interface OpenClawModels {
  defaultModel?: string;
  availableModels: string[];
  source: string;
  error?: string;
}

export function OpenClawPanel() {
  const [status, setStatus] = useState<OpenClawStatus | null>(null);
  const [models, setModels] = useState<OpenClawModels | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statusRes, modelsRes, agentsRes] = await Promise.all([
        fetch('/api/openclaw/status'),
        fetch('/api/openclaw/models'),
        fetch('/api/agents'),
      ]);

      if (statusRes.ok) {
        const statusData = await statusRes.json();
        setStatus(statusData);
      }

      if (modelsRes.ok) {
        const modelsData = await modelsRes.json();
        setModels(modelsData);
      }

      if (agentsRes.ok) {
        const agentsData = await agentsRes.json();
        setAgents(Array.isArray(agentsData) ? agentsData : []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch OpenClaw data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const maskToken = (url: string) => {
    // Mask tokens in URLs like ws://host:port?token=xxx
    return url.replace(/token=[^&]+/gi, 'token=***');
  };

  const getStatusDot = (status: AgentStatus) => {
    switch (status) {
      case 'working':
        return <span className="inline-block w-2 h-2 rounded-full bg-green-500" title="Working" />;
      case 'standby':
        return <span className="inline-block w-2 h-2 rounded-full bg-blue-500" title="Standby" />;
      case 'offline':
        return <span className="inline-block w-2 h-2 rounded-full bg-gray-400" title="Offline" />;
    }
  };

  const agentCounts = {
    working: agents.filter((a) => a.status === 'working').length,
    standby: agents.filter((a) => a.status === 'standby').length,
    offline: agents.filter((a) => a.status === 'offline').length,
    total: agents.length,
  };

  const occupationBarWidths = {
    working: agentCounts.total > 0 ? (agentCounts.working / agentCounts.total) * 100 : 0,
    standby: agentCounts.total > 0 ? (agentCounts.standby / agentCounts.total) * 100 : 0,
    offline: agentCounts.total > 0 ? (agentCounts.offline / agentCounts.total) * 100 : 0,
  };

  return (
    <div data-component="src/components/OpenClawPanel" className="min-h-screen">
      {/* Toolbar */}
      <div className="p-3 border-b border-mc-border bg-mc-bg-secondary flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-mc-accent" />
          <span className="font-mono font-medium">OpenClaw Gateway</span>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-3 min-h-11 border border-mc-border rounded text-sm hover:bg-mc-bg-tertiary disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">{loading ? 'Refreshing...' : 'Refresh'}</span>
        </button>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-6">
          {/* Card 1: Gateway Status (Full Width) */}
          <div className="rounded-lg border border-mc-border bg-mc-bg overflow-hidden">
            <div className="p-3 border-b border-mc-border bg-mc-bg-secondary flex items-center gap-2">
              <Wifi className="w-4 h-4 text-mc-text-secondary" />
              <h3 className="text-sm font-medium">Gateway Status</h3>
            </div>
            <div className="p-4">
              {status ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    {status.connected ? (
                      <>
                        <span className="inline-block w-4 h-4 rounded-full bg-green-500" />
                        <Wifi className="w-5 h-5 text-green-500" />
                        <span className="text-lg font-medium text-green-600">Connected</span>
                      </>
                    ) : (
                      <>
                        <span className="inline-block w-4 h-4 rounded-full bg-red-500" />
                        <WifiOff className="w-5 h-5 text-red-500" />
                        <span className="text-lg font-medium text-red-600">Disconnected</span>
                      </>
                    )}
                  </div>

                  <div>
                    <div className="text-sm text-mc-text-secondary mb-1">Gateway URL</div>
                    <code className="text-sm bg-mc-bg-tertiary px-2 py-1 rounded font-mono">
                      {maskToken(status.gateway_url)}
                    </code>
                  </div>

                  <div>
                    <div className="text-sm text-mc-text-secondary mb-1">Active Sessions</div>
                    <span className="text-2xl font-mono font-medium">{status.sessions_count}</span>
                  </div>

                  {status.error && (
                    <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                      <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="font-medium">Error</div>
                        <div>{status.error}</div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="w-5 h-5 animate-spin text-mc-text-secondary" />
                </div>
              )}
            </div>
          </div>

          {/* Bottom Row: Agent Occupation + Available Models */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Card 2: Agent Occupation */}
            <div className="rounded-lg border border-mc-border bg-mc-bg overflow-hidden">
              <div className="p-3 border-b border-mc-border bg-mc-bg-secondary flex items-center gap-2">
                <Bot className="w-4 h-4 text-mc-text-secondary" />
                <h3 className="text-sm font-medium">Agent Occupation</h3>
              </div>
              <div className="p-4">
                {agents.length > 0 ? (
                  <div className="space-y-4">
                    {/* Counts */}
                    <div className="flex gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="inline-block w-3 h-3 rounded bg-green-500" />
                        <span>{agentCounts.working} Working</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="inline-block w-3 h-3 rounded bg-blue-500" />
                        <span>{agentCounts.standby} Standby</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="inline-block w-3 h-3 rounded bg-gray-400" />
                        <span>{agentCounts.offline} Offline</span>
                      </div>
                    </div>

                    {/* Occupation Bar */}
                    <div className="w-full h-3 rounded-full overflow-hidden bg-mc-bg-tertiary flex">
                      {occupationBarWidths.working > 0 && (
                        <div
                          className="h-full bg-green-500"
                          style={{ width: `${occupationBarWidths.working}%` }}
                        />
                      )}
                      {occupationBarWidths.standby > 0 && (
                        <div
                          className="h-full bg-blue-500"
                          style={{ width: `${occupationBarWidths.standby}%` }}
                        />
                      )}
                      {occupationBarWidths.offline > 0 && (
                        <div
                          className="h-full bg-gray-400"
                          style={{ width: `${occupationBarWidths.offline}%` }}
                        />
                      )}
                    </div>

                    {/* Agent List */}
                    <div className="border-t border-mc-border pt-4 space-y-2 max-h-64 overflow-y-auto">
                      {agents.map((agent) => (
                        <div
                          key={agent.id}
                          className="flex items-center justify-between p-2 bg-mc-bg-secondary rounded border border-mc-border"
                        >
                          <div className="flex items-center gap-2">
                            {getStatusDot(agent.status)}
                            <span className="font-medium text-sm">{agent.name}</span>
                            <span className="text-xs text-mc-text-secondary">{agent.role}</span>
                          </div>
                          {agent.model && (
                            <span className="text-xs font-mono text-mc-text-secondary">
                              {agent.model}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-8 text-mc-text-secondary">
                    <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                    <span>Loading agents...</span>
                  </div>
                )}
              </div>
            </div>

            {/* Card 3: Available Models */}
            <div className="rounded-lg border border-mc-border bg-mc-bg overflow-hidden">
              <div className="p-3 border-b border-mc-border bg-mc-bg-secondary flex items-center gap-2">
                <Cpu className="w-4 h-4 text-mc-text-secondary" />
                <h3 className="text-sm font-medium">Available Models</h3>
              </div>
              <div className="p-4">
                {models ? (
                  <div className="space-y-4">
                    {models.error && (
                      <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded text-yellow-700 text-sm">
                        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <div>
                          <div className="font-medium">Warning</div>
                          <div>{models.error}</div>
                        </div>
                      </div>
                    )}

                    <div className="text-sm text-mc-text-secondary">
                      Source: <span className="font-mono">{models.source}</span>
                    </div>

                    <div className="space-y-2 max-h-72 overflow-y-auto">
                      {models.availableModels.map((model) => (
                        <div
                          key={model}
                          className={`flex items-center justify-between p-2 rounded border ${
                            model === models.defaultModel
                              ? 'bg-mc-accent/10 border-mc-accent/40'
                              : 'bg-mc-bg-secondary border-mc-border'
                          }`}
                        >
                          <code className="text-sm font-mono truncate flex-1">{model}</code>
                          {model === models.defaultModel && (
                            <span className="flex items-center gap-1 px-2 py-0.5 bg-mc-accent text-white rounded text-xs font-medium">
                              <Star className="w-3 h-3" />
                              Default
                            </span>
                          )}
                        </div>
                      ))}
                    </div>

                    {models.availableModels.length === 0 && (
                      <div className="text-center py-4 text-mc-text-secondary text-sm">
                        No models available
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="w-5 h-5 animate-spin text-mc-text-secondary" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
