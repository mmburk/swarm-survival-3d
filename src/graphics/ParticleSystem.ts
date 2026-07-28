import * as THREE from 'three';
import { ObjectPool } from '../pooling/ObjectPool';

const tempVelocity = new THREE.Vector3();
const tempPos = new THREE.Vector3();

class Particle {
  public active: boolean = false;
  public position: THREE.Vector3 = new THREE.Vector3();
  public velocity: THREE.Vector3 = new THREE.Vector3();
  public scale: number = 1.0;
  public life: number = 0;
  public maxLife: number = 0.5;
  public colorHex: number = 0x00ffff;

  public reset(pos: THREE.Vector3, vel: THREE.Vector3, colorHex: number, maxLife: number, scale: number): void {
    if (pos) this.position.copy(pos);
    if (vel) this.velocity.copy(vel);
    this.colorHex = colorHex || 0x00ffff;
    this.maxLife = maxLife || 0.5;
    this.scale = scale || 1.0;
    this.life = 0;
    this.active = true;
  }

  public update(delta: number): void {
    if (!this.active) return;
    this.life += delta;
    if (this.life >= this.maxLife) {
      this.active = false;
      return;
    }
    this.position.x += this.velocity.x * delta;
    this.position.y += this.velocity.y * delta;
    this.position.z += this.velocity.z * delta;
    this.velocity.y -= 9.8 * delta;
  }
}

export class ParticleSystem {
  private pool: ObjectPool<Particle>;
  private instancedMesh: THREE.InstancedMesh;
  private dummyMatrix: THREE.Matrix4 = new THREE.Matrix4();
  private colorBuffer: THREE.Color = new THREE.Color();

  constructor(scene: THREE.Scene) {
    this.pool = new ObjectPool<Particle>(() => new Particle(), 500, 800);

    const geometry = new THREE.BoxGeometry(0.18, 0.18, 0.18);
    const material = new THREE.MeshStandardMaterial({
      roughness: 0.2,
      metalness: 0.8,
      flatShading: true
    });

    this.instancedMesh = new THREE.InstancedMesh(geometry, material, 500);
    this.instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.instancedMesh.count = 0;
    scene.add(this.instancedMesh);
  }

  public emitBurst(origin: THREE.Vector3, count: number, colorHex: number, speed: number = 10, scale: number = 0.6): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const elevation = (Math.random() - 0.2) * Math.PI * 0.5;
      const s = speed * (0.4 + Math.random() * 0.8);

      tempVelocity.set(
        Math.cos(angle) * Math.cos(elevation) * s,
        Math.sin(elevation) * s + 2.0,
        Math.sin(angle) * Math.cos(elevation) * s
      );

      const p = this.pool.get();
      if (p) {
        p.reset(origin, tempVelocity, colorHex, 0.4 + Math.random() * 0.4, scale);
      }
    }
  }

  public emitDebris(origin: THREE.Vector3, count: number, colorHex: number): void {
    this.emitBurst(origin, count, colorHex, 14, 0.8);
  }

  public emitTrail(origin: THREE.Vector3, colorHex: number): void {
    tempVelocity.set(
      (Math.random() - 0.5) * 1.5,
      (Math.random() - 0.5) * 1.5,
      (Math.random() - 0.5) * 1.5
    );
    const p = this.pool.get();
    if (p) {
      p.reset(origin, tempVelocity, colorHex, 0.2, 0.3);
    }
  }

  public emitDamageText(_pos: THREE.Vector3, _isAOE: boolean = false): void {
    // Zero GC floating text
  }

  public update(delta: number): void {
    const activeParticles = this.pool.getActiveItems();
    let renderCount = 0;

    for (let i = 0; i < activeParticles.length; i++) {
      const p = activeParticles[i];
      if (!p || !p.active) continue;

      p.update(delta);
      if (!p.active) continue;

      const progress = p.life / p.maxLife;
      const currentScale = p.scale * (1.0 - progress);

      tempPos.copy(p.position);
      this.dummyMatrix.makeScale(currentScale, currentScale, currentScale);
      this.dummyMatrix.setPosition(tempPos);

      this.colorBuffer.setHex(p.colorHex);

      this.instancedMesh.setMatrixAt(renderCount, this.dummyMatrix);
      this.instancedMesh.setColorAt(renderCount, this.colorBuffer);
      renderCount++;
    }

    this.instancedMesh.count = renderCount;
    if (renderCount > 0) {
      this.instancedMesh.instanceMatrix.needsUpdate = true;
      if (this.instancedMesh.instanceColor) {
        this.instancedMesh.instanceColor.needsUpdate = true;
      }
    }
  }
}
