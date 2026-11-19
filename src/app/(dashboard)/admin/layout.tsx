import LogoutButton from '@/components/LogoutButton';
import Link from 'next/link';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-gray-100">
            <nav className="bg-white shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16">
                        <div className="flex">
                            <div className="flex-shrink-0 flex items-center font-bold text-xl text-blue-600">
                                Admin Panel
                            </div>
                            <div className="hidden sm:-my-px sm:ml-6 sm:flex sm:space-x-8">
                                <Link href="/admin/team" className="border-blue-500 text-gray-900 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                                    Team Management
                                </Link>
                                <Link href="/admin/leave" className="border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                                    Leave Calendar
                                </Link>
                            </div>
                        </div>
                        <div className="flex items-center">
                            <LogoutButton />
                        </div>
                    </div>
                </div>
            </nav>

            <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                {children}
            </main>
        </div>
    );
}