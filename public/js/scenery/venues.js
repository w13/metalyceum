// Large outdoor venues coordinator
import { buildAmphitheater } from './amphitheater.js';
import { buildConcertVenue } from './concert-venue.js';
import { buildRiver } from './river.js';
import { buildRoads } from './roads.js';

// Re-export for barrel-file consistency
export { buildAmphitheater };
export { buildConcertVenue };

// Eager-built venues (near spawn). Far landmarks (airport, castle, underground city)
// are lazy-loaded via lazy-venues.js when the player approaches.
export function buildOutdoorVenues() {
  buildRoads();
  buildAmphitheater();
  buildConcertVenue();
  buildRiver();
}
