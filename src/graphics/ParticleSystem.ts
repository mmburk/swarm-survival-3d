import * as THREE from 'three';
import { ObjectPool } from '../pooling/ObjectPool';

const tempVelocity = new THREE.Vector3();
const tempPos = new THREE.Vector3();
const tempRing = new THREE.Vector3();

/** Fireball shades, picked from per particle. */
const FIRE_COLORS = [0xd9a441, 0xc2551f, 0x8e2323, 0x4a463c];

class Particle {
  public active: boolean = false;
  public position: THREE.Vector3 = new THREE.Vector3();
  public velocity: THREE.Vector3 = new THREE.Vector3();
  public scale: number = 1.0;
  public life: number = 0;
  public maxLife: number = 0.5;
  public colorHex: number = 0x8b8878;

  public reset(pos: THREE.Vector3, vel: THREE.Vector3, colorHex: number, maxLife: number, scale: number): void {
    if (pos) this.position.copy(pos);
    if (vel) this.velocity.copy(vel);
    this.colorHex = colorHex || 0x8b8878;
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

/**
 * Hard ceiling on live particles. The pool and the instance buffer are sized
 * from the same number on purpose: they used to be 1000 and 600, so a couple of
 * overlapping explosions filled the pool past what the buffer could hold and
 * the draw ran off the end of it.
 */
const MAX_PARTICLES = 1000;

export class ParticleSystem {
  private pool: ObjectPool<Particle>;
  private instancedMesh: THREE.InstancedMesh;
  private dummyMatrix: THREE.Matrix4 = new THREE.Matrix4();
  private colorBuffer: THREE.Color = new THREE.Color();

  constructor(scene: THREE.Scene) {
    this.pool = new ObjectPool<Particle>(() => new Particle(), 600, MAX_PARTICLES);

    const geometry = new THREE.BoxGeometry(0.22, 0.22, 0.22);
    const material = new THREE.MeshStandardMaterial({
      roughness: 0.85,
      metalness: 0.1,
      flatShading: true
    });

    this.instancedMesh = new THREE.InstancedMesh(geometry, material, MAX_PARTICLES);
    this.instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.instancedMesh.count = 0;
    // Dust is emitted all over the arena and the mesh sits at the origin, so a
    // bounding sphere around the origin says nothing useful about where it is.
    this.instancedMesh.frustumCulled = false;
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

  public emitExplosion(origin: THREE.Vector3, radius: number = 8.5, colorHex: number = 0xd2622a): void {
    // 1. Core Fireball & Rising Flame Burst
    for (let i = 0; i < 36; i++) {
      const angle = Math.random() * Math.PI * 2;
      const elevation = (Math.random() - 0.2) * Math.PI * 0.5;
      const speed = (6.0 + Math.random() * 14.0);

      tempVelocity.set(
        Math.cos(angle) * Math.cos(elevation) * speed,
        Math.sin(elevation) * speed + 3.5,
        Math.sin(angle) * Math.cos(elevation) * speed
      );

      const col = FIRE_COLORS[Math.floor(Math.random() * FIRE_COLORS.length)];

      const p = this.pool.get();
      if (p) {
        p.reset(origin, tempVelocity, col, 0.45 + Math.random() * 0.35, 1.4 + Math.random() * 0.8);
      }
    }

    // 2. High-Speed Horizontal Shockwave Ring
    const ringCount = 48;
    for (let i = 0; i < ringCount; i++) {
      const angle = (i / ringCount) * Math.PI * 2;
      const speed = radius * (3.0 + Math.random() * 0.6);
      tempVelocity.set(Math.cos(angle) * speed, 0.8 + Math.random() * 0.8, Math.sin(angle) * speed);

      const p = this.pool.get();
      if (p) {
        p.reset(origin, tempVelocity, colorHex, 0.5, 1.0);
      }
    }

    // 3. Flying Fiery Sparks & Debris
    for (let i = 0; i < 24; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 14.0 + Math.random() * 12.0;
      tempVelocity.set(
        Math.cos(angle) * speed,
        6.0 + Math.random() * 10.0,
        Math.sin(angle) * speed
      );
      const p = this.pool.get();
      if (p) {
        p.reset(origin, tempVelocity, 0xe8b45a, 0.65, 0.55);
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

  public emitShockwave(origin: THREE.Vector3, radius: number = 6.0, colorHex: number = 0x6b6b63): void {
    const count = 36;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      tempVelocity.set(Math.cos(angle) * radius * 3, 1.5, Math.sin(angle) * radius * 3);
      const p = this.pool.get();
      if (p) {
        p.reset(origin, tempVelocity, colorHex, 0.4, 0.6);
      }
    }
  }

  public emitTelegraphRing(origin: THREE.Vector3, duration: number = 0.5, colorHex: number = 0x6b1a1a): void {
    const count = 16;
    const radius = 1.2;
    tempVelocity.set(0, 0.4, 0);
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      tempRing.set(
        origin.x + Math.cos(angle) * radius,
        origin.y + 0.05,
        origin.z + Math.sin(angle) * radius
      );
      const p = this.pool.get();
      if (p) {
        p.reset(tempRing, tempVelocity, colorHex, duration, 0.4);
      }
    }
  }

  public update(delta: number): void {
    const activeParticles = this.pool.getActiveItems();
    let renderCount = 0;

    for (let i = 0; i < activeParticles.length; i++) {
      const p = activeParticles[i];
      if (!p || !p.active) continue;

      p.update(delta);
      if (!p.active) continue;
      if (renderCount >= MAX_PARTICLES) continue;

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
