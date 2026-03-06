import { AppNav } from '@/components/AppNav';
import { WorkspaceDashboard } from '@/components/WorkspaceDashboard';

export default function HomePage() {
  return (
    <div data-component="src/app/page" className="min-h-screen bg-mc-bg">
      <AppNav />
      <main>
        <WorkspaceDashboard />
      </main>
    </div>
  );
}
