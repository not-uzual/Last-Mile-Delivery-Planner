import { createClient } from '@/lib/db/server';
import { updateCallStatus } from '@/actions/ops';

export default async function OpsCallsPage() {
  const supabase = await createClient();
  const today = new Date();
  
  // Calculate D-4 and D-1 Dates
  const d4Date = new Date(today); d4Date.setDate(today.getDate() + 4);
  const d1Date = new Date(today); d1Date.setDate(today.getDate() + 1);
  
  const d4Str = d4Date.toISOString().split('T')[0];
  const d1Str = d1Date.toISOString().split('T')[0];

  // Fetch Deliveries for these days including customer info
  const { data: deliveries } = await supabase
    .from('deliveries')
    .select(`
      id, scheduled_date, d4_call_status, d1_call_status,
      orders ( customers ( name, phone ) )
    `)
    .in('scheduled_date', [d4Str, d1Str]);

  const d4Calls = deliveries?.filter(d => d.scheduled_date === d4Str) || [];
  const d1Calls = deliveries?.filter(d => d.scheduled_date === d1Str) || [];

  const CallRow = ({ delivery, type }: { delivery: any, type: 'd4_call_status' | 'd1_call_status' }) => (
    <div className="flex items-center justify-between p-4 border-b last:border-0 hover:bg-gray-50">
      <div>
        <p className="font-medium text-gray-900">{delivery.orders.customers.name}</p>
        <p className="text-sm text-gray-500">{delivery.orders.customers.phone}</p>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-xs uppercase font-bold text-gray-500">{delivery[type]}</span>
        
        {/* Simple form interacting directly with Server Action */}
        <form action={updateCallStatus} className="flex gap-2">
          <input type="hidden" name="deliveryId" value={delivery.id} />
          <input type="hidden" name="callType" value={type} />
          <button type="submit" name="status" value="confirmed" className="text-xs bg-green-100 hover:bg-green-200 text-green-800 px-3 py-1.5 rounded">
            Confirm
          </button>
          <button type="submit" name="status" value="unreachable" className="text-xs bg-red-100 hover:bg-red-200 text-red-800 px-3 py-1.5 rounded">
            No Answer
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="space-y-8">
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="bg-blue-50 px-6 py-4 border-b border-blue-100">
          <h2 className="text-lg font-bold text-blue-900">D-4 Calls (Agree Slot for {new Date(d4Str).toLocaleDateString()})</h2>
        </div>
        <div className="divide-y divide-gray-200">
          {d4Calls.length === 0 ? <p className="p-6 text-gray-500 text-sm">No D-4 calls pending.</p> : null}
          {d4Calls.map(d => <CallRow key={d.id} delivery={d} type="d4_call_status" />)}
        </div>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="bg-purple-50 px-6 py-4 border-b border-purple-100">
          <h2 className="text-lg font-bold text-purple-900">D-1 Calls (Reconfirm for {new Date(d1Str).toLocaleDateString()})</h2>
        </div>
        <div className="divide-y divide-gray-200">
          {d1Calls.length === 0 ? <p className="p-6 text-gray-500 text-sm">No D-1 calls pending.</p> : null}
          {d1Calls.map(d => <CallRow key={d.id} delivery={d} type="d1_call_status" />)}
        </div>
      </div>
    </div>
  );
}