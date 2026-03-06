import { AppNav } from '@/components/AppNav';
import { OpenClawPanel } from '@/components/OpenClawPanel';

export default function OpenClawPage() {
  return (
    <div data-component="src/app/openclaw/page" className="min-h-screen bg-mc-bg">
      <AppNav />
      <main>
        <OpenClawPanel />
      </main>
    </div>
  );
}
