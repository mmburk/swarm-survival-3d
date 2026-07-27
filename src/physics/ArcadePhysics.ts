import * as THREE from 'three';

export interface IArcadeBody {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  radius: number;
  active: boolean;
}

export class ArcadePhysics {
  // Ultra-fast 2D/3D Sphere vs Sphere distance check (Zero Math.sqrt)
  public static checkSphereOverlap(
    posA: THREE.Vector3,
    radiusA: number,
    posB: THREE.Vector3,
    radiusB: number
  ): boolean {
    const dx = posA.x - posB.x;
    const dy = posA.y - posB.y;
    const dz = posA.z - posB.z;
    const distSq = dx * dx + dy * dy + dz * dz;
    const minRadiusSq = (radiusA + radiusB) * (radiusA + radiusB);
    return distSq < minRadiusSq;
  }

  // Soft Arcade Separation Force for overlapping entities
  public static resolveSoftOverlap(
    posA: THREE.Vector3,
    velA: THREE.Vector3,
    posB: THREE.Vector3,
    radiusA: number,
    radiusB: number,
    pushForce: number = 10.0
  ): void {
    const dx = posA.x - posB.x;
    const dz = posA.z - posB.z;
    const distSq = dx * dx + dz * dz;
    const minRadiusSq = (radiusA + radiusB) * (radiusA + radiusB);

    if (distSq > 0 && distSq < minRadiusSq) {
      const dist = Math.sqrt(distSq);
      const overlap = (radiusA + radiusB) - dist;
      const nx = dx / dist;
      const nz = dz / dist;

      posA.x += nx * overlap * 0.5;
      posA.z += nz * overlap * 0.5;
      velA.x += nx * pushForce;
      velA.z += nz * pushForce;
    }
  }

  // Apply velocity integration, friction damping, and 140x140 terrain bounds clamping
  public static integratePosition(
    position: THREE.Vector3,
    velocity: THREE.Vector3,
    delta: number,
    damping: number = 0.85
  ): void {
    position.x += velocity.x * delta;
    position.y += velocity.y * delta;
    position.z += velocity.z * delta;

    // Apply linear friction
    const friction = Math.pow(damping, delta * 60);
    velocity.x *= friction;
    velocity.z *= friction;

    // Clamp position within world terrain boundaries (-65 to 65)
    position.x = Math.max(-65, Math.min(65, position.x));
    position.z = Math.max(-65, Math.min(65, position.z));
  }
}
