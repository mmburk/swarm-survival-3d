import * as THREE from 'three';
import type { IPoolable } from '../pooling/ObjectPool';

export const PickupType = {
  /** Currency. Persists across runs. */
  SCRAP: 'SCRAP',
  /** Heals. */
  BANDAGE: 'BANDAGE',
  /** Tops up the flare meter. */
  STIM: 'STIM'
} as const;

export type PickupType = typeof PickupType[keyof typeof PickupType];

export class Pickup implements IPoolable {
  public active: boolean = false;
  public position: THREE.Vector3 = new THREE.Vector3();
  public type: PickupType = PickupType.SCRAP;
  public value: number = 1;

  private lifeTime: number = 0;
  private maxLifeTime: number = 22.0;

  public reset(pos: THREE.Vector3, type: PickupType = PickupType.SCRAP, value: number = 1): void {
    this.type = type;
    this.value = value;
    this.lifeTime = 0;
    this.position.copy(pos);
    this.active = true;
  }

  public update(delta: number, playerPos?: THREE.Vector3, magnetRadius: number = 5.5): void {
    if (!this.active) return;

    this.lifeTime += delta;
    if (this.lifeTime >= this.maxLifeTime) {
      this.deactivate();
      return;
    }

    if (!playerPos) return;

    const dx = playerPos.x - this.position.x;
    const dz = playerPos.z - this.position.z;
    const distSq = dx * dx + dz * dz;
    if (distSq <= magnetRadius * magnetRadius && distSq > 0.01) {
      const dist = Math.sqrt(distSq);
      // Accelerates as it closes, so collection feels snappy rather than floaty.
      const pull = 18.0 * (1.0 - dist / magnetRadius) + 3.0;
      this.position.x += (dx / dist) * pull * delta;
      this.position.z += (dz / dist) * pull * delta;
    }
  }

  public deactivate(): void {
    this.active = false;
    this.position.set(0, -9999, 0);
  }
}
