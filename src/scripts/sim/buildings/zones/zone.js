import * as THREE from 'three';
import { DEG2RAD } from 'three/src/math/MathUtils.js';
import { DevelopmentModule, DevelopmentState } from '../modules/development.js';
import { Building } from '../building.js';

/**
 * Represents a zoned building such as residential, commercial or industrial
 */
export class Zone extends Building {
  /**
   * The mesh style to use when rendering
   */
  style = ['A', 'B', 'C'][Math.floor(3 * Math.random())];

  /**
   * @type {DevelopmentModule}
   */
  development = new DevelopmentModule(this);

  constructor(x = 0, y = 0) {
    super(x, y);
    
    
    
    // Randomize the building rotation
    this.rotation.y = 90 * Math.floor(4 * Math.random()) * DEG2RAD;
  }

refreshView(city) {
  let modelName;
  switch (this.development.state) {
    case DevelopmentState.underConstruction:
    case DevelopmentState.undeveloped:
      modelName = 'under-construction';
      break;
    default:
      modelName = `${this.type}-${this.style}${this.development.level}`;
      break;
  }

  const mesh = window.assetManager.getModel(modelName, this);

  // Keep the model's scale at 1
  mesh.scale.set(.1, .1, .1);

  // Position the model at the center of the occupied area
  
  const offset = (this.size - 1) / 2;
    mesh.position.set(offset, 0, offset);
  // Tint building a dark color if it is abandoned
  if (this.development.state === DevelopmentState.abandoned) {
    mesh.traverse((obj) => {
      if (obj.material) {
        obj.material.color = new THREE.Color(0x707070);
      }
    });
  }

  this.setMesh(mesh);
}

  simulate(city) {
    super.simulate(city);
    this.development.simulate(city);
  }

  /**
   * Returns an HTML representation of this object
   * @returns {string}
   */
  toHTML() {
    let html = super.toHTML();
    html += this.development.toHTML();
    return html;
  }
}