import AppShell from '@/components/AppShell';

export default function OpsLayout({ children }: { children: React.ReactNode }) {
  return <AppShell role="ops">{children}</AppShell>;
}
