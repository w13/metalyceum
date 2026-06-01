// HDRI Environment Map Loader for Metalyceum
// Loads a free Poly Haven HDRI to provide realistic reflections and ambient lighting
// while keeping the existing stylized sky dome as the background.
// Uses dynamic import for RGBELoader (matching the @tonejs/midi pattern).
import * as THREE from 'three';
import { state } from './state.js';

const RGBE_LOADER_URL = 'three/addons/loaders/RGBELoader.js';

// Poly Haven CC0 HDRI — 1K resolution for performance, outdoor dawn sky
const HDR_URL = 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/kiara_1_dawn_1k.hdr';

let loaded = false;

let _retryTimer = null;

export async function loadHdriEnvironment() {
  if (loaded) return;
  if (!state.renderer || !state.scene) {
    console.warn('[HDRI] Renderer or scene not ready yet, will retry in 2s');
    clearTimeout(_retryTimer);
    _retryTimer = setTimeout(() => loadHdriEnvironment(), 2000);
    return;
  }

  try {
    const { RGBELoader } = await import(RGBE_LOADER_URL);
    const loader = new RGBELoader();

    await new Promise((resolve, reject) => {
      loader.load(
        HDR_URL,
        (texture) => {
          try {
            const pmremGenerator = new THREE.PMREMGenerator(state.renderer);
            pmremGenerator.compileCubemapShader();

            const envMap = pmremGenerator.fromEquirectangular(texture).texture;
            state.scene.environment = envMap;

            pmremGenerator.dispose();
            texture.dispose();

            loaded = true;
            console.log('[HDRI] Environment map loaded:', HDR_URL);
            resolve();
          } catch (genErr) {
            console.warn('[HDRI] PMREM generation failed:', genErr);
            resolve(); // Non-fatal — scene works without env map
          }
        },
        undefined, // onProgress
        (err) => {
          console.warn('[HDRI] Failed to load HDR file, scene continues without env map:', err);
          resolve(); // Non-fatal
        }
      );
    });
  } catch (importErr) {
    console.warn('[HDRI] RGBELoader import failed, scene continues without env map:', importErr);
  }
}
