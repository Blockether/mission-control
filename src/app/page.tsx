'use client';

import { useState } from 'react';
import Image from 'next/image';
import { LayoutGrid, Settings, Cpu } from 'lucide-react';
import { WorkspaceDashboard } from '@/components/WorkspaceDashboard';
import { SystemPanel } from '@/components/SystemPanel';
import { OpenClawPanel } from '@/components/OpenClawPanel';

type TabType = 'workspaces' | 'system' | 'openclaw';

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<TabType>('workspaces');

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'workspaces', label: 'Workspaces', icon: <LayoutGrid className="w-4 h-4" /> },
    { id: 'system', label: 'System', icon: <Settings className="w-4 h-4" /> },
    { id: 'openclaw', label: 'OpenClaw', icon: <Cpu className="w-4 h-4" /> },
  ];

  return (
    <div data-component="src/app/page" className="min-h-screen bg-mc-bg">
      {/* Top Navigation Bar */}
      <header className="bg-mc-bg-secondary border-b border-mc-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            {/* Left: Logo + Title */}
            <div className="flex items-center gap-3">
              <Image src="/logo.png" alt="Blockether" width={28} height={28} className="rounded" />
              <span className="font-mono font-medium text-lg">Mission Control</span>
            </div>

            {/* Right: Tab Buttons */}
            <div className="flex items-center gap-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'bg-mc-bg text-mc-text font-medium border border-mc-border'
                      : 'text-mc-text-secondary hover:text-mc-text hover:bg-mc-bg-tertiary'
                  }`}
                >
                  {tab.icon}
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Tab Content */}
      <main>
        {activeTab === 'workspaces' && <WorkspaceDashboard />}
        {activeTab === 'system' && <SystemPanel />}
        {activeTab === 'openclaw' && <OpenClawPanel />}
      </main>
    </div>
  );
}
