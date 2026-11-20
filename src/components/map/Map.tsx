'use client';

import dynamic from 'next/dynamic';
import type { DeliveryPoint } from './RouteMap';

const RouteMap = dynamic(() => import('./RouteMap'), {
  ssr: false,
  loading: () => <div className="h-96 animate-pulse rounded-lg bg-gray-100" />,
});

export default function Map({
  deliveries,
  geometry,
}: {
  deliveries: DeliveryPoint[];
  geometry: string | null;
}) {
  return <RouteMap deliveries={deliveries} geometry={geometry} />;
}