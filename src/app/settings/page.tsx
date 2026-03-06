import { AppNav } from '@/components/AppNav';
import { SettingsPanel } from '@/components/SettingsPanel';

export default function SettingsPage() {
  return (
    <div data-component="src/app/settings/page" className="min-h-screen bg-mc-bg">
      <AppNav />
      <main>
        <SettingsPanel />
      </main>
    </div>
  );
}
