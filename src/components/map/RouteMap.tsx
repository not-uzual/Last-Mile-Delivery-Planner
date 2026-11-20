'use client';

import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { DEPOT } from '@/lib/config';

/** Decodes an encoded polyline (precision 5), the format OSRM returns. */
function decodePolyline(encoded: string): [number, number][] {
  const points: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    for (const axis of ['lat', 'lng'] as const) {
      let b: number;
      let shift = 0;
      let result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const delta = result & 1 ? ~(result >> 1) : result >> 1;
      if (axis === 'lat') lat += delta;
      else lng += delta;
    }
    points.push([lat / 1e5, lng / 1e5]);
  }
  return points;
}

export type DeliveryPoint = {
  id: string;
  name: string;
  address?: string;
  lat: number;
  lng: number;
  arrivalTime?: string;
  status?: 'scheduled' | 'delivered' | 'failed';
};

const depotIcon = L.divIcon({
  className: '',
  html: '<div class="depot-pin"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21V8l9-5 9 5v13"/><path d="M7 21v-8h10v8"/></svg></div>',
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

function stopIcon(n: number, status?: DeliveryPoint['status']) {
  const cls = status === 'delivered' ? 'is-done' : status === 'failed' ? 'is-failed' : '';
  return L.divIcon({
    className: '',
    html: `<div class="stop-pin ${cls}">${n}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  const key = points.map((p) => p.join(',')).join('|');
  useEffect(() => {
    if (points.length > 1) map.fitBounds(L.latLngBounds(points), { padding: [32, 32] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key]);
  return null;
}

export default function RouteMap({
  deliveries,
  geometry,
  className = 'h-96',
}: {
  deliveries: DeliveryPoint[];
  geometry: string | null;
  className?: string;
}) {
  const route = geometry ? decodePolyline(geometry) : [];
  const bounds: [number, number][] = [[DEPOT.lat, DEPOT.lng], ...deliveries.map((d) => [d.lat, d.lng] as [number, number])];

  return (
    <div className={`isolate w-full overflow-hidden ${className}`}>
      <MapContainer center={[DEPOT.lat, DEPOT.lng]} zoom={11} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds points={bounds} />

        {route.length > 0 && (
          <>
            <Polyline positions={route} pathOptions={{ color: '#ffffff', weight: 7, opacity: 0.9 }} />
            <Polyline positions={route} pathOptions={{ color: '#82572e', weight: 4, opacity: 0.95 }} />
          </>
        )}

        <Marker position={[DEPOT.lat, DEPOT.lng]} icon={depotIcon}>
          <Popup>
            <strong>{DEPOT.name}</strong>
            <br />
            Start and end of every trip
          </Popup>
        </Marker>

        {deliveries.map((d, idx) => (
          <Marker key={d.id} position={[d.lat, d.lng]} icon={stopIcon(idx + 1, d.status)}>
            <Popup>
              <strong>
                {idx + 1}. {d.name}
              </strong>
              {d.address && (
                <>
                  <br />
                  {d.address}
                </>
              )}
              <br />
              ETA {d.arrivalTime ?? '—'}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
