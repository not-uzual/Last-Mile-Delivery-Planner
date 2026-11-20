import AppShell from '@/components/AppShell';

export default function CrewLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell role="crew" width="narrow">
      {children}
    </AppShell>
  );
}
