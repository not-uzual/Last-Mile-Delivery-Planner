'use server';

// Depot coordinates (Starting point for the vehicle)
const DEPOT = { lng: -0.1, lat: 51.5 }; 

type OsrmRoute = {
  legs: { duration: number }[];
  geometry: string;
  distance: number;
  duration: number;
};

export async function getRouteForDay(deliveries: { lat: number, lng: number, id: string }[]) {
  if (deliveries.length === 0) return null;

  // OSRM expects coordinates as: lng,lat;lng,lat;lng,lat
  const coordinatesArray = [
    [DEPOT.lng, DEPOT.lat], // Start at depot
    ...deliveries.map(d => [d.lng, d.lat]), // Customer locations
    [DEPOT.lng, DEPOT.lat]  // Return to depot
  ];

  const coordinatesString = coordinatesArray.map(coord => `${coord[0]},${coord[1]}`).join(';');

  // Fetch from the free public OSRM server
  const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${coordinatesString}?overview=full`, {
    method: 'GET',
    // No headers or API keys needed!
  });

  if (!response.ok) {
    console.error('OSRM Error:', await response.text());
    return null;
  }

  const data: { routes: OsrmRoute[] } = await response.json();
  const route = data.routes[0];
  if (!route) return null;
  
  // Calculate Arrival Times based on a 09:00 AM start time
  let currentStartTime = new Date(0);
  currentStartTime.setHours(9, 0, 0, 0); // 9:00 AM
  
  // OSRM breaks the trip into "legs" (point A to B, B to C)
  const arrivals = deliveries.map((d, index) => {
    // Add the travel time from this leg (in seconds)
    const travelTimeSeconds = route.legs[index].duration;
    currentStartTime = new Date(currentStartTime.getTime() + (travelTimeSeconds * 1000));
    
    const arrivalTime = new Date(currentStartTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    // Add 45 mins unloading time before driving to the next stop
    currentStartTime = new Date(currentStartTime.getTime() + (45 * 60000));
    
    return { id: d.id, arrivalTime };
  });

  return {
    geometry: route.geometry, // Encoded polyline, exactly the same format we decoded in RouteMap!
    arrivals,
    summary: {
      distance: route.distance, // OSRM returns meters (same as ORS)
      duration: route.duration  // OSRM returns seconds (same as ORS)
    }
  };
}