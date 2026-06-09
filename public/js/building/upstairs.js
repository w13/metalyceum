// public/js/building/upstairs.js
// Second-floor furnishings: west wing seminar hall, executive office, Room 10 seminar.
import * as THREE from 'three';
import { state } from '../state.js';
import { MAIN_BUILDING_MEZZANINE_Y } from '../config.js';
import { HALF_PI, FLAT } from '../math.js';
import { addSceneryCollider } from '../scenery/utils.js';

export function buildUpperFloorFurnishings(pushUpperFloor) {
  const MEZZ_Y = MAIN_BUILDING_MEZZANINE_Y;           // 7.5
  const SCREEN_Y = MEZZ_Y + 3.3 * 0.55;              // ≈ 9.315
}
