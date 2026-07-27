import * as THREE from 'three';

interface Particle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  color: THREE.Color;
  size: number;
  life: number;
  maxLife: number;
  gravity: number;
}

export class ParticleSystem {
  private particles: Particle[] = [];
  private poolSize: number = 600;
  private instancedMesh: THREE.InstancedMesh;
  private dummy = new THREE.Object3D();
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    const geometry = new THREE.BoxGeometry(0.25, 0.25, 0.25);
    const material = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.95,
      toneMapped: false
    });

    this.instancedMesh = new THREE.InstancedMesh(geometry, material, this.poolSize);
    this.instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.instancedMesh.frustumCulled = false;
    this.scene.add(this.instancedMesh);

    for (let i = 0; i < this.poolSize; i++) {
      this.particles.push({
        position: new THREE.Vector3(0, -9999, 0),
        velocity: new THREE.Vector3(),
        color: new THREE.Color(0xffffff),
        size: 0,
        life: 0,
        maxLife: 1,
        gravity: 9.8
      });
    }

    this.updateMeshMatrices();
  }

  private updateMeshMatrices(): void {
    for (let i = 0; i < this.poolSize; i++) {
      this.dummy.position.set(0, -9999, 0);
      this.dummy.scale.set(0, 0, 0);
      this.dummy.updateMatrix();
      this.instancedMesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.instancedMesh.instanceMatrix.needsUpdate = true;
  }

  public emitBurst(
    position: THREE.Vector3,
    count: number = 18,
    hexColor: number = 0x00ffff,
    speed: number = 9,
    maxLife: number = 0.5
  ): void {
    const baseColor = new THREE.Color(hexColor);

    for (let i = 0; i < count; i++) {
      let p = this.particles.find(pt => pt.life <= 0);
      if (!p) {
        p = this.particles[i % this.poolSize];
      }

      p.position.copy(position);
      p.velocity.set(
        (Math.random() - 0.5) * speed,
        Math.random() * speed * 0.8 + 2,
        (Math.random() - 0.5) * speed
      );
      p.color.copy(baseColor);
      p.size = 0.35 + Math.random() * 0.45;
      p.maxLife = maxLife * (0.6 + Math.random() * 0.8);
      p.life = p.maxLife;
      p.gravity = 14.0;
    }
  }

  public emitDebris(
    position: THREE.Vector3,
    count: number = 12,
    hexColor: number = 0x9900ff
  ): void {
    const baseColor = new THREE.Color(hexColor);

    for (let i = 0; i < count; i++) {
      let p = this.particles.find(pt => pt.life <= 0);
      if (!p) {
        p = this.particles[i % this.poolSize];
      }

      p.position.copy(position).add(new THREE.Vector3((Math.random() - 0.5) * 0.6, 0.8, (Math.random() - 0.5) * 0.6));
      p.velocity.set(
        (Math.random() - 0.5) * 12,
        Math.random() * 10 + 3,
        (Math.random() - 0.5) * 12
      );
      p.color.copy(baseColor);
      p.size = 0.6 + Math.random() * 0.5;
      p.maxLife = 0.8 + Math.random() * 0.4;
      p.life = p.maxLife;
      p.gravity = 18.0;
    }
  }

  public emitDamageText(position: THREE.Vector3, isCrit: boolean = false): void {
    // Instanced glowing damage number indicator burst
    const count = isCrit ? 8 : 4;
    const colorHex = isCrit ? 0xffaa00 : 0xffffff;

    for (let i = 0; i < count; i++) {
      let p = this.particles.find(pt => pt.life <= 0);
      if (!p) break;

      p.position.copy(position).add(new THREE.Vector3((Math.random() - 0.5) * 0.4, 1.2, (Math.random() - 0.5) * 0.4));
      p.velocity.set((Math.random() - 0.5) * 1.5, 4.0 + Math.random() * 2.0, (Math.random() - 0.5) * 1.5);
      p.color.setHex(colorHex);
      p.size = isCrit ? 0.65 : 0.45;
      p.maxLife = 0.45;
      p.life = 0.45;
      p.gravity = -2.0; // Float upward
    }
  }

  public emitTrail(
    position: THREE.Vector3,
    hexColor: number = 0x00f0ff
  ): void {
    let p = this.particles.find(pt => pt.life <= 0);
    if (!p) return;

    p.position.copy(position).add(new THREE.Vector3((Math.random() - 0.5) * 0.4, 0.3, (Math.random() - 0.5) * 0.4));
    p.velocity.set(0, Math.random() * 0.4, 0);
    p.color.setHex(hexColor);
    p.size = 0.45;
    p.maxLife = 0.35;
    p.life = 0.35;
    p.gravity = 0;
  }

  public update(delta: number): void {
    for (let i = 0; i < this.poolSize; i++) {
      const p = this.particles[i];
      if (p.life > 0) {
        p.life -= delta;
        p.position.addScaledVector(p.velocity, delta);
        p.velocity.y -= p.gravity * delta;

        const lifeRatio = Math.max(0, p.life / p.maxLife);
        const scale = p.size * lifeRatio;

        this.dummy.position.copy(p.position);
        this.dummy.scale.set(scale, scale, scale);
        this.dummy.updateMatrix();

        this.instancedMesh.setMatrixAt(i, this.dummy.matrix);
        this.instancedMesh.setColorAt(i, p.color);
      } else {
        this.dummy.position.set(0, -9999, 0);
        this.dummy.scale.set(0, 0, 0);
        this.dummy.updateMatrix();
        this.instancedMesh.setMatrixAt(i, this.dummy.matrix);
      }
    }

    this.instancedMesh.instanceMatrix.needsUpdate = true;
    if (this.instancedMesh.instanceColor) {
      this.instancedMesh.instanceColor.needsUpdate = true;
    }
  }
}
