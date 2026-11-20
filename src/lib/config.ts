/** Warehouse the vehicle leaves from and returns to (mock location, central London). */
export const DEPOT = { name: 'Wudhomes depot', lat: 51.5, lng: -0.1 };

/** Vehicle leaves the depot at this time (minutes after midnight). */
export const DAY_START_MINUTES = 9 * 60;

/** Time on site per stop: unloading, carrying in and assembly. */
export const SERVICE_MINUTES = 45;
