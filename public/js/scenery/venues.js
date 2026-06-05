// Large outdoor venues coordinator
import { buildAmphitheater } from './amphitheater.js';
import { buildConcertVenue } from './concert-venue.js';
import { buildAirport } from './airport.js';
import { buildCaveAndUndergroundCity } from './underground-city.js';
import { buildRiver } from './river.js';
import { buildCastle } from './castle.js';
import { buildRoads } from './roads.js';

// Re-export buildAmphitheater and buildConcertVenue for coordinator/barrel consistency
export { buildAmphitheater };
export { buildConcertVenue };

export function buildOutdoorVenues() {
  buildRoads();
  buildAmphitheater();
  buildConcertVenue();
  buildAirport();
  buildCastle();
  buildCaveAndUndergroundCity();
  buildRiver();
}
