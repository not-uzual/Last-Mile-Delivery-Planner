import { createClient } from '@/lib/db/server';
import { addLeave } from '@/actions/admin';
import UpcomingLeaveList, { type UpcomingLeaveRecord } from './upcoming-leave-list';

export default async function LeavePage() {
  const supabase = await createClient();
  
  // Fetch crew members for the dropdown
  const { data: crew } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('app_role', 'crew');

  // Fetch upcoming leave records
  const { data: leaves } = await supabase
    .from('leave_records')
    .select('id, leave_date, profiles(full_name)')
    .order('leave_date', { ascending: true });

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Form Section */}
      <div className="bg-white shadow rounded-lg p-6 col-span-1 h-fit">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Add Leave Date</h2>
        <form action={addLeave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Crew Member</label>
            <select name="profileId" required className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md border">
              {crew?.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Date</label>
            <input type="date" name="leaveDate" required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
          </div>
          <button type="submit" className="w-full bg-blue-600 text-white py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium hover:bg-blue-700">
            Book Leave
          </button>
        </form>
      </div>

      {/* List Section */}
      <UpcomingLeaveList leaves={leaves as UpcomingLeaveRecord[] | null} />
    </div>
  );
}