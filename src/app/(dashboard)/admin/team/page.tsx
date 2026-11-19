import { createClient } from '@/lib/db/server';
import { updateWeeklyOff } from '@/actions/admin';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default async function TeamPage() {
  const supabase = await createClient();
  
  // Fetch all profiles, sorted by role
  const { data: team } = await supabase
    .from('profiles')
    .select('*')
    .order('app_role', { ascending: true });

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Team Management</h1>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Weekly Off Day</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {team?.map((member) => (
              <tr key={member.id}>
                <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{member.full_name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                  <span className="capitalize">{member.app_role}</span>
                  {member.crew_role && <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full capitalize">{member.crew_role}</span>}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <form action={updateWeeklyOff} className="flex items-center gap-2">
                    <input type="hidden" name="id" value={member.id} />
                    <select 
                      name="offDay" 
                      defaultValue={member.weekly_off_day}
                      className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                    >
                      {DAYS.map((day, index) => (
                        <option key={index} value={index}>{day}</option>
                      ))}
                    </select>
                    <button type="submit" className="text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded">Save</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}