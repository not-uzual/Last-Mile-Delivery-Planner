import { createClient } from '@/lib/db/server';
import { scheduleOrder } from '@/actions/ops';
import { doesItemFitLift } from '@/lib/utils';

export default async function OpsPlanningPage() {
  const supabase = await createClient();

  // Fetch unplanned orders with their items and customer data
  const { data: orders } = await supabase
    .from('orders')
    .select(`
      id, ready_date,
      customers ( name, address, lift_length, lift_width, lift_height, has_staircase_only ),
      order_items ( id, name, length, width, height, weight )
    `)
    .eq('status', 'unplanned')
    .order('ready_date', { ascending: true });

  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Route Planning & Queue</h1>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {orders?.map((order: any) => {
          // Check if ANY item in this order fails the lift check or if it's stairs only
          const needsPorter = 
            order.customers.has_staircase_only || 
            order.order_items.some((item: any) => !doesItemFitLift(item, order.customers));

          const totalWeight = order.order_items.reduce((sum: number, item: any) => sum + item.weight, 0);

          return (
            <div key={order.id} className="bg-white shadow rounded-lg p-6 border-l-4 border-blue-500">
              <div className="flex flex-col md:flex-row justify-between gap-4">
                
                {/* Order Details */}
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900">{order.customers.name}</h3>
                  <p className="text-sm text-gray-500">{order.customers.address}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      Ready: {new Date(order.ready_date).toLocaleDateString()}
                    </span>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      Weight: {totalWeight} kg
                    </span>
                    {needsPorter && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200">
                        ⚠️ Porter / Crane Required (Lift Mismatch)
                      </span>
                    )}
                  </div>
                  
                  {/* Items List */}
                  <div className="mt-4 bg-gray-50 rounded p-3">
                    <p className="text-xs font-bold text-gray-700 uppercase mb-2">Order Items:</p>
                    <ul className="text-sm text-gray-600 space-y-1">
                      {order.order_items.map((item: any) => (
                        <li key={item.id}>
                          • {item.name} <span className="text-gray-400">({item.length}x{item.width}x{item.height}cm)</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Scheduling Form */}
                <div className="md:w-72 bg-gray-50 p-4 rounded-lg border">
                  <p className="text-sm font-medium text-gray-900 mb-3">Schedule Delivery</p>
                  <form action={scheduleOrder} className="space-y-3">
                    <input type="hidden" name="orderId" value={order.id} />
                    <input type="hidden" name="requiresPorter" value={needsPorter.toString()} />
                    
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Select Date</label>
                      <input 
                        type="date" 
                        name="scheduledDate" 
                        required 
                        min={order.ready_date > todayStr ? order.ready_date : todayStr}
                        className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:ring-blue-500 focus:border-blue-500" 
                      />
                      <p className="text-xs text-gray-400 mt-1">Must be on or after ready date.</p>
                    </div>

                    <button type="submit" className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 text-sm font-medium transition-colors">
                      Assign to Calendar
                    </button>
                  </form>
                </div>

              </div>
            </div>
          );
        })}
        
        {orders?.length === 0 && (
          <div className="text-center py-12 bg-white shadow rounded-lg">
            <p className="text-gray-500">All caught up! No unplanned orders in the queue.</p>
          </div>
        )}
      </div>
    </div>
  );
}