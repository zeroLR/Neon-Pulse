import * as THREE from 'three';
import { GAME_CONFIG } from '../constants';

/**
 * Sample points along the saber blade for collision detection
 */
export const getSaberBladePoints = (
  saberGroup: THREE.Group, 
  saberScale: number
): THREE.Vector3[] => {
  const points: THREE.Vector3[] = [];
  
  // Sample along blade length and width
  const bladeLength = 4.0 * saberScale;
  const bladeWidth = 0.08 * saberScale;
  const lengthSamples = 8;
  const widthSamples = 3;
  
  for (let l = 0; l < lengthSamples; l++) {
    const zOffset = 0.3 + (bladeLength * l / (lengthSamples - 1));
    
    for (let w = 0; w < widthSamples; w++) {
      const xOffset = (w - 1) * bladeWidth;
      
      const offsets = [
        new THREE.Vector3(xOffset, 0, zOffset),
        new THREE.Vector3(0, xOffset, zOffset),
      ];
      
      for (const offset of offsets) {
        const point = offset.clone();
        point.applyMatrix4(saberGroup.matrixWorld);
        points.push(point);
      }
    }
  }
  return points;
};

/**
 * Check if saber intersects with a block using sweep detection
 */
export const checkSaberIntersection = (
  saberGroup: THREE.Group, 
  blockWorldPos: THREE.Vector3, 
  prevBladePoints: THREE.Vector3[],
  blockScale: number,
  saberScale: number
): boolean => {
  // 1. Define Block AABB in World Space
  const size = GAME_CONFIG.BLOCK_SIZE * blockScale * 1.1; 
  const halfSize = size / 2;
  
  const min = new THREE.Vector3(
    blockWorldPos.x - halfSize, 
    blockWorldPos.y - halfSize, 
    blockWorldPos.z - halfSize
  );
  const max = new THREE.Vector3(
    blockWorldPos.x + halfSize, 
    blockWorldPos.y + halfSize, 
    blockWorldPos.z + halfSize
  );
  const blockBox = new THREE.Box3(min, max);

  // Expand the block box to catch fast swings
  const expansionAmount = 0.5 * saberScale;
  blockBox.expandByScalar(expansionAmount);

  // 2. Get current blade points
  const currentBladePoints = getSaberBladePoints(saberGroup, saberScale);
  
  // 3. Check current frame collision
  for (const point of currentBladePoints) {
    if (blockBox.containsPoint(point)) {
      return true;
    }
  }

  // 4. Sweep Detection: Check interpolated positions between frames
  if (prevBladePoints.length > 0) {
    const interpSteps = 5;
    for (let i = 0; i < currentBladePoints.length; i++) {
      const currPoint = currentBladePoints[i];
      const prevPoint = prevBladePoints[i] || currPoint;
      
      for (let s = 1; s <= interpSteps; s++) {
        const t = s / (interpSteps + 1);
        const interpPoint = new THREE.Vector3().lerpVectors(prevPoint, currPoint, t);
        
        if (blockBox.containsPoint(interpPoint)) {
          return true;
        }
      }
    }
    
    // 5. Triangle-based sweep collision for the blade surface
    for (let i = 0; i < currentBladePoints.length - 1; i++) {
      const curr0 = currentBladePoints[i];
      const curr1 = currentBladePoints[i + 1];
      const prev0 = prevBladePoints[i] || curr0;
      const prev1 = prevBladePoints[i + 1] || curr1;
      
      // Check center of the swept quad
      const center = new THREE.Vector3()
        .add(curr0).add(curr1).add(prev0).add(prev1)
        .multiplyScalar(0.25);
      
      if (blockBox.containsPoint(center)) {
        return true;
      }
    }
  }

  return false;
};

/**
 * Check block collision with saber
 */
export const checkBlockCollision = (
  saberGroup: THREE.Group, 
  blockWorldPos: THREE.Vector3, 
  prevBladePoints: THREE.Vector3[],
  blockScale: number,
  saberScale: number
): boolean => {
  return checkSaberIntersection(saberGroup, blockWorldPos, prevBladePoints, blockScale, saberScale);
};
