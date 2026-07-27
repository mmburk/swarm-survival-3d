import * as THREE from 'three';
import type { IPoolable } from '../pooling/ObjectPool';

export const PickupType = {
  XP_ORB: 'XP_ORB',
  HEALTH_PACK: 'HEALTH_PACK',
  SHIELD_BOOST: 'SHIELD_BOOST'
} as const;

export type PickupType = typeof PickupType[keyof typeof PickupType];

export class Pickup implements IPoolable {
  public active: boolean = false;
  public position: THREE.Vector3 = new THREE.Vector3();
  public type: PickupType = PickupType.XP_ORB;
  public value: number = 15;

  private lifeTime: number = 0;
  private maxLifeTime: number = 15.0; // Despawn after 15 seconds if uncollected

  public reset(pos: THREE.Vector3, type: PickupType = PickupType.XP_ORB, value: number = 15): void {
    this.type = type;
    this.value = value;
    this.lifeTime = 0;
    this.position.copy(pos);
    this.active = true;
  }

  public update(delta: number): void {
    if (!this.active) return;
    this.lifeTime += delta;
    if (this.lifeTime >= this.maxLifeTime) {
      this.deactivate();
    }
  }

  public deactivate(): void {
    this.active = false;
  }
}
