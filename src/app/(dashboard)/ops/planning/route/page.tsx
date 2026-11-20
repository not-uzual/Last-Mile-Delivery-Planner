import { Suspense } from 'react';
import { connection } from 'next/server';
import { createClient } from '@/lib/db/server';
import { getRouteForDay } from '@/lib/routing';
import Map from '@/components/map/Map';
import type { DeliveryPoint } from '@/components/map/RouteMap';

export default function DailyRoutePage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  return (
    <Suspense fallback={
      <div className="space-y-6">
        <h1 className="text-xl font-bold text-gray-900">Daily Route Plan</h1>
        <p className="text-gray-600">Loading route...</p>
      </div>
    }>
      <DailyRouteContent searchParams={searchParams} />
    </Suspense>
  );
}

async function DailyRouteContent({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  await connection();
  const supabase = await createClient();
  const { date } = await searchParams;
  const dateStr = date || new Date().toISOString().split('T')[0];

  // Fetch scheduled deliveries for this specific date
  const { data: deliveries, error } = await supabase
    .from('deliveries')
    .select('id, orders(customers(name, lat, lng))')
    .eq('scheduled_date', dateStr)
    .order('sequence_order', { ascending: true }); 
  if (error) throw error;

  // Format data for the map and routing
  const mapPoints: DeliveryPoint[] = deliveries?.flatMap((delivery) => {
    const customer = delivery.orders?.[0]?.customers?.[0];
    return customer ? [{
      id: delivery.id,
      name: customer.name,
      lat: customer.lat,
      lng: customer.lng,
    }] : [];
  }) || [];

  // Call our routing service
  const routeData = await getRouteForDay(mapPoints);

  // Merge ETA times into our map points
  if (routeData) {
    mapPoints.forEach(mp => {
      const eta = routeData.arrivals.find((arrival) => arrival.id === mp.id);
      if (eta) mp.arrivalTime = eta.arrivalTime;
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm">
        <h1 className="text-xl font-bold text-gray-900">Daily Route Plan</h1>
        <form className="flex gap-2">
          <input 
            type="date" 
            name="date" 
            defaultValue={dateStr}
            className="border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          />
          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium">
            Load Date
          </button>
        </form>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm">
        <Map deliveries={mapPoints} geometry={routeData?.geometry ?? null} />

        {routeData && (
          <div className="mt-4 flex gap-6 text-sm text-gray-600">
            <p><strong>Total Distance:</strong> {(routeData.summary.distance / 1000).toFixed(1)} km</p>
            <p><strong>Total Driving Time:</strong> {Math.round(routeData.summary.duration / 60)} mins</p>
          </div>
        )}
        
        {mapPoints.length === 0 && (
          <p className="mt-4 text-gray-500 text-sm">No deliveries scheduled for this date.</p>
        )}
      </div>
    </div>
  );
}