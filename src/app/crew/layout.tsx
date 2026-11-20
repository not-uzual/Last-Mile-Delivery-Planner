import LogoutButton from '@/components/LogoutButton';

export default function CrewLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-100 flex justify-center">
      <div className="w-full max-w-md bg-white min-h-screen shadow-2xl relative flex flex-col">
        <header className="bg-slate-900 text-white p-4 sticky top-0 z-10 shadow-md">
          <div className="flex justify-between items-center">
            <h1 className="text-xl font-bold tracking-tight">🚚 CrewApp</h1>
            <div className="flex items-center gap-3">
              <span className="h-2.5 w-2.5 bg-green-500 rounded-full animate-pulse"></span>
              <div className="bg-white rounded">
                <LogoutButton />
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-gray-50 pb-20">
          {children}
        </main>
      </div>
    </div>
  );
}