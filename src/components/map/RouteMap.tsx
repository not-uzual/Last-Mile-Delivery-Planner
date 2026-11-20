'use client';

import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default Leaflet marker icons in Next.js
Reflect.deleteProperty(L.Icon.Default.prototype, '_getIconUrl');
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Polyline decoding utility for OpenRouteService geometry
function decodePolyline(encoded: string) {
  const points = [];
  let index = 0;
  const len = encoded.length;
  let lat = 0, lng = 0;

  while (index < len) {
    let b, shift = 0, result = 0;
    do {
      b = encoded.charAt(index++).charCodeAt(0) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charAt(index++).charCodeAt(0) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lng += dlng;

    points.push([lat / 1E5, lng / 1E5] as [number, number]);
  }
  return points;
}

export type DeliveryPoint = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  arrivalTime?: string;
};

export default function RouteMap({ deliveries, geometry }: { deliveries: DeliveryPoint[], geometry: string | null }) {
  const routePositions = geometry ? decodePolyline(geometry) : [];
  const center = deliveries.length > 0 
    ? [deliveries[0].lat, deliveries[0].lng] as [number, number]
    : [51.5, -0.1] as [number, number];

  return (
    <div className="h-96 w-full rounded-lg overflow-hidden border shadow-sm">
      <MapContainer center={center} zoom={11} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {/* Depot Marker */}
        <Marker position={[51.5, -0.1]}>
          <Popup><strong>Depot</strong><br/>Start/End Location</Popup>
        </Marker>

        {/* Customer Markers */}
        {deliveries.map((d, idx) => (
          <Marker key={d.id} position={[d.lat, d.lng]}>
            <Popup>
              <strong>Stop {idx + 1}: {d.name}</strong><br/>
              Est. Arrival: {d.arrivalTime || 'Pending'}
            </Popup>
          </Marker>
        ))}

        {/* Route Line */}
        {routePositions.length > 0 && (
          <Polyline positions={routePositions} color="blue" weight={4} opacity={0.6} />
        )}
      </MapContainer>
    </div>
  );
}