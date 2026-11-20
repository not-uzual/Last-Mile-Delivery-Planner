import { createClient } from '@/lib/db/server';
import { updateDeliveryStatus } from '@/actions/crew';

export default async function CrewAppPage() {
  const supabase = await createClient();
  const todayStr = new Date().toISOString().split('T')[0];
  const dayOfWeek = new Date().getDay();

  // 1. Get the currently logged-in crew member's profile
  const { data: { user } } = await supabase.auth.getUser();
  const { data: currentProfile } = await supabase
    .from('profiles')
    .select('id, full_name, crew_role')
    .eq('id', user?.id)
    .single();

  // 2. Find today's active team (who isn't on weekly off or leave today)
  const [teamRes, leavesRes] = await Promise.all([
    supabase.from('profiles').select('id, full_name, crew_role, weekly_off_day').eq('app_role', 'crew'),
    supabase.from('leave_records').select('profile_id').eq('leave_date', todayStr),
  ]);

  const leaveIds = new Set((leavesRes.data || []).map((l) => l.profile_id));
  const activeCrew = (teamRes.data || []).filter(
    (m) => m.weekly_off_day !== dayOfWeek && !leaveIds.has(m.id)
  );

  const driver = activeCrew.find((m) => m.crew_role === 'driver');
  const assembler = activeCrew.find((m) => m.crew_role === 'assembler');

  // 3. Fetch today's deliveries
  const { data: deliveries } = await supabase
    .from('deliveries')
    .select(`
      id, status, requires_porter,
      orders (
        id, 
        customers (name, address, phone, lat, lng, has_staircase_only),
        order_items (id, name, length, width, height, weight)
      )
    `)
    .eq('scheduled_date', todayStr)
    .order('sequence_order', { ascending: true });

  const pendingStops = deliveries?.filter((d) => d.status === 'scheduled') || [];
  const completedStops = deliveries?.filter((d) => d.status === 'completed' || d.status === 'failed') || [];
  const isAssembler = currentProfile?.crew_role === 'assembler';

  return (
    <div className="p-4 space-y-6">
      {/* Role & Today's Truck Pairing Card */}
      <div className="bg-slate-800 text-white p-4 rounded-xl shadow-sm space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-xs uppercase tracking-wider text-slate-400 font-bold">
            Logged in as {currentProfile?.crew_role || 'Crew'}
          </span>
          <span className="text-xs bg-slate-700 px-2 py-0.5 rounded font-medium">
            {currentProfile?.full_name}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-700 text-xs">
          <div>
            <span className="text-slate-400 block">Driver</span>
            <span className="font-semibold">{driver?.full_name || 'Unassigned'}</span>
          </div>
          <div>
            <span className="text-slate-400 block">Assembler</span>
            <span className="font-semibold">{assembler?.full_name || 'Unassigned'}</span>
          </div>
        </div>
      </div>

      {/* Progress Header */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">Today's Route</h2>
        <div className="flex items-center justify-between mb-2">
          <span className="text-2xl font-black text-gray-900">{pendingStops.length}</span>
          <span className="text-sm text-gray-500">Stops Remaining</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2.5">
          <div
            className="bg-blue-600 h-2.5 rounded-full"
            style={{ width: `${deliveries?.length ? (completedStops.length / deliveries.length) * 100 : 0}%` }}
          ></div>
        </div>
      </div>

      {/* Pending Stops List */}
      <div className="space-y-4">
        {pendingStops.map((stop, index) => {
          const order = stop.orders as any;
          const customer = order.customers;
          const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${customer.lat},${customer.lng}`;

          return (
            <div key={stop.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              {/* Stop Header */}
              <div className="bg-blue-50 p-4 border-b border-blue-100 flex justify-between items-start">
                <div>
                  <span className="inline-block bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded mb-2">
                    STOP {index + 1}
                  </span>
                  <h3 className="text-lg font-bold text-gray-900">{customer.name}</h3>
                </div>
                {stop.requires_porter && (
                  <span className="text-xs font-bold bg-amber-100 text-amber-800 px-2 py-1 rounded border border-amber-200">
                    🏗️ Porter Needed
                  </span>
                )}
              </div>

              {/* Stop Details */}
              <div className="p-4 space-y-4">
                <div>
                  <p className="text-sm text-gray-500 font-medium mb-1">Address</p>
                  <p className="text-base text-gray-900 leading-snug">{customer.address}</p>
                  {/* Driver-focused quick navigation button */}
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1.5 text-sm font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg"
                  >
                    🧭 Navigate
                  </a>
                </div>

                <div>
                  <p className="text-sm text-gray-500 font-medium mb-1">Contact</p>
                  <a href={`tel:${customer.phone}`} className="text-blue-600 font-bold text-lg flex items-center gap-2">
                    📞 {customer.phone}
                  </a>
                </div>

                {/* Item & Assembly Checklist */}
                <div className="bg-gray-50 p-3 rounded-lg border">
                  <p className="text-xs font-bold text-gray-500 uppercase mb-2">
                    {isAssembler ? '🔧 Assembly & Unload List' : '📦 Items to Unload'} ({order.order_items.length}):
                  </p>
                  <ul className="text-sm text-gray-800 space-y-2">
                    {order.order_items.map((item: any) => (
                      <li key={item.id} className="border-b pb-2 border-gray-200 last:border-0 last:pb-0">
                        <div className="flex justify-between font-medium">
                          <span>{item.name}</span>
                          <span className="text-gray-500">{item.weight}kg</span>
                        </div>
                        <span className="text-xs text-gray-500">
                          Dimensions: {item.length} × {item.width} × {item.height} cm
                        </span>
                      </li>
                    ))}
                  </ul>
                  {customer.has_staircase_only && (
                    <p className="mt-3 text-sm text-red-600 font-bold flex items-center gap-1">
                      ⚠️ Stairs Only - No Lift!
                    </p>
                  )}
                </div>

                {/* Action Buttons */}
                <form action={updateDeliveryStatus} className="space-y-3 pt-2">
                  <input type="hidden" name="deliveryId" value={stop.id} />
                  <input type="hidden" name="orderId" value={order.id} />

                  {/* Optional field note (e.g. missing hardware / assembly note) */}
                  <input
                    type="text"
                    name="notes"
                    placeholder={isAssembler ? 'Assembly notes (optional)...' : 'Delivery notes (optional)...'}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                  />

                  {/* Native Mobile Camera Integration for Proof of Delivery */}
                  <div>
                    <label className="flex items-center justify-center gap-2 w-full bg-gray-100 text-gray-700 font-bold py-3 px-4 rounded-lg border-2 border-dashed border-gray-300 cursor-pointer active:bg-gray-200">
                      📸 {isAssembler ? 'Take Assembled Photo' : 'Take PoD Photo'}
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        name="pod_photo"
                      />
                    </label>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="submit"
                      name="status"
                      value="failed"
                      className="w-1/3 bg-red-100 text-red-700 font-bold py-4 rounded-lg active:bg-red-200 transition-colors"
                    >
                      Fail
                    </button>
                    <button
                      type="submit"
                      name="status"
                      value="completed"
                      className="w-2/3 bg-green-600 text-white font-bold text-lg py-4 rounded-lg shadow-md active:bg-green-700 active:transform active:scale-95 transition-all"
                    >
                      ✓ {isAssembler ? 'Assembled & Done' : 'Delivered'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          );
        })}

        {pendingStops.length === 0 && (
          <div className="text-center py-12">
            <span className="text-5xl block mb-4">🎉</span>
            <h3 className="text-xl font-bold text-gray-900">All Done!</h3>
            <p className="text-gray-500 mt-2">No more stops on your route today.</p>
          </div>
        )}
      </div>
    </div>
  );
}