import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';

declare global {
  namespace THREE {
    var OrbitControls: any;
    var TransformControls: any;
  }
}

const THREE_GLOBAL = Object.assign({}, THREE);
(THREE_GLOBAL as any).OrbitControls = OrbitControls;
(THREE_GLOBAL as any).TransformControls = TransformControls;
(window as any).THREE = THREE_GLOBAL;
