import * as THREE from 'three';

export interface IArcadeBody {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  radius: number;
  active: boolean;
}

export class ArcadePhysics {
  // Fast 2D XZ-Plane Circle vs Circle Overlap Check (Ignores Y height difference)
  public static checkSphereOverlap(
    posA: THREE.Vector3,
    radiusA: number,
    posB: THREE.Vector3,
    radiusB: number
  ): boolean {
    const dx = posA.x - posB.x;
    const dz = posA.z - posB.z;
    const distSq = dx * dx + dz * dz;
    const minRadiusSq = (radiusA + radiusB) * (radiusA + radiusB);
    return distSq <= minRadiusSq;
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

  // Solid Circle / Cylinder Obstacle Resolution (Pushes entity cleanly out of obstacle radius)
  public static resolveSolidObstacle(
    entityPos: THREE.Vector3,
    entityRadius: number,
    obstaclePos: { x: number; z: number; radius: number }
  ): void {
    const dx = entityPos.x - obstaclePos.x;
    const dz = entityPos.z - obstaclePos.z;
    const distSq = dx * dx + dz * dz;
    const minDist = entityRadius + obstaclePos.radius;
    const minDistSq = minDist * minDist;

    if (distSq < minDistSq) {
      const dist = Math.sqrt(distSq) || 0.001;
      const overlap = minDist - dist;
      const nx = dx / dist;
      const nz = dz / dist;

      entityPos.x += nx * overlap;
      entityPos.z += nz * overlap;
    }
  }

  // Apply velocity integration, friction damping, and a hard world-bounds clamp
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

    // Backstop only — callers apply the real arena shape on top of this.
    position.x = Math.max(-70, Math.min(70, position.x));
    position.z = Math.max(-70, Math.min(70, position.z));
  }
}
