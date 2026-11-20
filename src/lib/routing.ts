import { DAY_START_MINUTES, DEPOT, SERVICE_MINUTES } from './config';

type OsrmRoute = {
  legs: { duration: number; distance: number }[];
  geometry: string;
  distance: number;
  duration: number;
};

export type RouteStop = {
  id: string;
  lat: number;
  lng: number;
  /** Start of the customer's booked window (minutes after midnight); the crew waits if early. */
  notBeforeMinutes?: number;
};

export type RoutePlan = {
  geometry: string;
  arrivals: { id: string; arrival: string; departure: string }[];
  returnToDepot: string;
  distanceKm: number;
  drivingMinutes: number;
};

function hhmm(totalMinutes: number) {
  const m = Math.round(totalMinutes);
  return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/**
 * Drives depot → stops (in the given order) → depot over real roads using the
 * free public OSRM server. Arrival at stop N = departure from stop N-1 + road
 * travel time of that leg (or the start of the customer's booked window, if the
 * van would be early); departure = arrival + SERVICE_MINUTES.
 */
export async function getRouteForDay(stops: RouteStop[]): Promise<RoutePlan | null> {
  if (stops.length === 0) return null;

  const coords = [DEPOT, ...stops, DEPOT].map((p) => `${p.lng},${p.lat}`).join(';');

  try {
    const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=full`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.error('OSRM error:', res.status, await res.text());
      return null;
    }
    const data: { routes?: OsrmRoute[] } = await res.json();
    const route = data.routes?.[0];
    if (!route) return null;

    let clock = DAY_START_MINUTES;
    const arrivals = stops.map((stop, i) => {
      clock += route.legs[i].duration / 60;
      if (stop.notBeforeMinutes !== undefined) clock = Math.max(clock, stop.notBeforeMinutes);
      const arrival = hhmm(clock);
      clock += SERVICE_MINUTES;
      return { id: stop.id, arrival, departure: hhmm(clock) };
    });
    clock += route.legs[stops.length].duration / 60;

    return {
      geometry: route.geometry,
      arrivals,
      returnToDepot: hhmm(clock),
      distanceKm: route.distance / 1000,
      drivingMinutes: route.duration / 60,
    };
  } catch (err) {
    console.error('OSRM request failed:', err);
    return null;
  }
}
