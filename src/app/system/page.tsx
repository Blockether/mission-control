import { AppNav } from '@/components/AppNav';
import { SystemPanel } from '@/components/SystemPanel';

export default function SystemPage() {
  return (
    <div data-component="src/app/system/page" className="min-h-screen bg-mc-bg">
      <AppNav />
      <main>
        <SystemPanel />
      </main>
    </div>
  );
}
