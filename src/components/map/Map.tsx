'use client';

import dynamic from 'next/dynamic';
import type { DeliveryPoint } from './RouteMap';

// Leaflet touches `window`, so it can only render in the browser.
const RouteMap = dynamic(() => import('./RouteMap'), {
  ssr: false,
  loading: () => <div className="h-full min-h-72 w-full animate-pulse bg-zinc-100" />,
});

export default function Map(props: { deliveries: DeliveryPoint[]; geometry: string | null; className?: string }) {
  return <RouteMap {...props} />;
}
