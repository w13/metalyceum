// Large outdoor venues coordinator
// Eager venues are statically imported (synchronous). Lazy venues use the
// VENUE_REGISTRY in config.js — add an entry there + create a builder module.
import { buildAmphitheater } from './amphitheater.js';
import { buildConcertVenue } from './concert-venue.js';
import { buildRiver } from './river.js';
import { buildRoads } from './roads.js';

export { buildAmphitheater, buildConcertVenue };

// Eager-built venues (near spawn). Far landmarks (airport, castle, underground city)
// are lazy-loaded via lazy-venues.js which reads VENUE_REGISTRY from config.js.
export function buildOutdoorVenues() {
  buildRoads();
  buildAmphitheater();
  buildConcertVenue();
  buildRiver();
}
