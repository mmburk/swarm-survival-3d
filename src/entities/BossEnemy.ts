import * as THREE from 'three';
import { ParticleSystem } from '../graphics/ParticleSystem';
import { AudioManager } from '../core/AudioManager';
import { TerrainGenerator } from '../terrain/TerrainGenerator';
import { HEX } from '../theme/Palette';

const tempDir = new THREE.Vector3();
const tempRingDir = new THREE.Vector3();
const tempSlamPos = new THREE.Vector3();

/**
 * THE BEHEMOTH — whatever the outbreak does when it has months and a body
 * big enough to work with. Two phases: it stalks and slams, then at half
 * health it opens up and starts throwing bile in every direction.
 */
export class BossEnemy {
  public active: boolean = false;
  public group: THREE.Group;
  public position: THREE.Vector3 = new THREE.Vector3();
  public radius: number = 2.6;

  public health: number = 900;
  public maxHealth: number = 900;
  public phase: number = 1;

  private slamTimer: number = 0;
  private isTelegraphing: boolean = false;
  private telegraphTimer: number = 0;
  private bileTimer: number = 0;
  private time: number = 0;

  private torso!: THREE.Mesh;
  private growth!: THREE.Mesh;
  private leftArm!: THREE.Mesh;
  private rightArm!: THREE.Mesh;
  private hideMat!: THREE.MeshStandardMaterial;
  private growthMat!: THREE.MeshStandardMaterial;

  private telegraphMesh!: THREE.Mesh;
  private telegraphMat!: THREE.MeshBasicMaterial;

  private scene: THREE.Scene;
  private particles: ParticleSystem;
  private audio: AudioManager;
  private terrain: TerrainGenerator;

  constructor(scene: THREE.Scene, particles: ParticleSystem, audio: AudioManager, terrain: TerrainGenerator) {
    this.scene = scene;
    this.particles = particles;
    this.audio = audio;
    this.terrain = terrain;

    this.group = new THREE.Group();
    this.group.visible = false;
    this.buildModel();
    this.buildTelegraph();
    this.scene.add(this.group);
  }

  private buildModel(): void {
    this.hideMat = new THREE.MeshStandardMaterial({
      color: 0x6d6a52,
      roughness: 0.95,
      metalness: 0.0,
      flatShading: true
    });
    this.growthMat = new THREE.MeshStandardMaterial({
      color: 0x7a2626,
      roughness: 0.7,
      metalness: 0.0,
      flatShading: true
    });

    this.torso = new THREE.Mesh(new THREE.BoxGeometry(3.6, 3.4, 2.6), this.hideMat);
    this.torso.position.y = 0.4;
    this.torso.castShadow = true;
    this.group.add(this.torso);

    // The tumour mass it drags on its back.
    this.growth = new THREE.Mesh(new THREE.DodecahedronGeometry(1.7, 0), this.growthMat);
    this.growth.position.set(0, 1.9, 1.1);
    this.growth.castShadow = true;
    this.group.add(this.growth);

    const head = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.1, 1.2), this.hideMat);
    head.position.set(0, 1.9, -0.9);
    head.rotation.x = 0.2;
    this.group.add(head);

    const maw = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.45, 0.3), this.growthMat);
    maw.position.set(0, 1.66, -1.5);
    this.group.add(maw);

    const armGeo = new THREE.BoxGeometry(0.85, 0.85, 3.2);
    this.leftArm = new THREE.Mesh(armGeo, this.hideMat);
    this.leftArm.position.set(-2.1, 0.7, -0.9);
    this.leftArm.rotation.x = 0.35;
    this.leftArm.castShadow = true;
    this.group.add(this.leftArm);

    this.rightArm = new THREE.Mesh(armGeo, this.hideMat);
    this.rightArm.position.set(2.1, 0.7, -0.9);
    this.rightArm.rotation.x = 0.35;
    this.rightArm.castShadow = true;
    this.group.add(this.rightArm);

    const legGeo = new THREE.BoxGeometry(1.0, 2.0, 1.0);
    const ll = new THREE.Mesh(legGeo, this.hideMat);
    ll.position.set(-1.0, -1.6, 0);
    this.group.add(ll);
    const rl = new THREE.Mesh(legGeo, this.hideMat);
    rl.position.set(1.0, -1.6, 0);
    this.group.add(rl);
  }

  /** A scorched ring on the tarmac rather than a glowing hologram. */
  private buildTelegraph(): void {
    const geo = new THREE.RingGeometry(0.4, 8.0, 40);
    geo.rotateX(-Math.PI / 2);
    this.telegraphMat = new THREE.MeshBasicMaterial({
      color: 0x8e2323,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.45,
      depthWrite: false
    });
    this.telegraphMesh = new THREE.Mesh(geo, this.telegraphMat);
    this.telegraphMesh.visible = false;
    this.scene.add(this.telegraphMesh);
  }

  public spawn(pos: THREE.Vector3, healthScale: number = 1): void {
    this.maxHealth = Math.round(900 * healthScale);
    this.health = this.maxHealth;
    this.phase = 1;
    this.slamTimer = 0;
    this.isTelegraphing = false;
    this.telegraphTimer = 0;
    this.bileTimer = 0;

    this.hideMat.color.setHex(0x6d6a52);
    this.growthMat.color.setHex(0x7a2626);

    this.position.copy(pos);
    this.group.position.copy(pos);
    this.group.visible = true;
    this.telegraphMesh.visible = false;
    this.active = true;

    this.audio.playBossRoar(this.position);
    this.particles.emitBurst(this.position, 40, HEX.gore, 12, 1.0);
  }

  public takeDamage(damage: number, hitPoint: THREE.Vector3): boolean {
    if (!this.active) return false;

    this.health -= damage;
    this.particles.emitBurst(hitPoint, 7, HEX.gore, 7, 0.4);

    if (this.health <= this.maxHealth * 0.5 && this.phase === 1) {
      this.phase = 2;
      this.hideMat.color.setHex(0x53503c);
      this.growthMat.color.setHex(0xa33030);
      this.audio.playBossRoar(this.position);
      this.particles.emitBurst(this.position, 70, 0xa33030, 16, 1.2);
    }

    if (this.health <= 0) {
      this.deactivate();
      return true;
    }
    return false;
  }

  public update(
    delta: number,
    playerPos: THREE.Vector3,
    onSpit: (origin: THREE.Vector3, dir: THREE.Vector3) => void,
    onSummon: (pos: THREE.Vector3) => void,
    onPlayerDamage?: (damage: number) => void
  ): void {
    if (!this.active) return;

    this.time += delta;

    // Idle breathing on the tumour mass.
    const breathe = 1 + Math.sin(this.time * (this.phase === 2 ? 5.0 : 2.4)) * 0.06;
    this.growth.scale.setScalar(breathe);

    if (!this.isTelegraphing) {
      this.slamTimer += delta;
      if (this.slamTimer >= (this.phase === 2 ? 3.2 : 4.2)) {
        this.isTelegraphing = true;
        this.telegraphTimer = 0.95;
        // The ring on the ground only warns whoever happens to be looking at
        // that patch of road. This warns everyone.
        this.audio.playSlamWindup(this.position);
        tempSlamPos.copy(playerPos); // it aims where you are, so keep moving
        this.telegraphMesh.position.set(
          tempSlamPos.x,
          this.terrain.getHeightAt(tempSlamPos.x, tempSlamPos.z) + 0.06,
          tempSlamPos.z
        );
        this.telegraphMesh.visible = true;
      }
    } else {
      this.telegraphTimer -= delta;
      const t = Math.min(1, Math.max(0.08, 1 - this.telegraphTimer));
      this.telegraphMesh.scale.set(t, t, t);
      this.telegraphMat.opacity = 0.25 + Math.sin(this.time * 22) * 0.2;

      // Arms rear back over the wind-up.
      const wind = (1 - this.telegraphTimer) * 0.9;
      this.leftArm.rotation.x = 0.35 - wind;
      this.rightArm.rotation.x = 0.35 - wind;

      if (this.telegraphTimer <= 0) {
        this.isTelegraphing = false;
        this.slamTimer = 0;
        this.telegraphMesh.visible = false;
        this.leftArm.rotation.x = 0.35;
        this.rightArm.rotation.x = 0.35;

        this.audio.playSlam(this.position);
        this.particles.emitBurst(tempSlamPos, 45, HEX.dirt, 13, 0.9);
        this.particles.emitShockwave(tempSlamPos, 8.0, HEX.smoke);

        const dx = playerPos.x - tempSlamPos.x;
        const dz = playerPos.z - tempSlamPos.z;
        if (dx * dx + dz * dz <= 64 && onPlayerDamage) onPlayerDamage(38);

        if (this.phase === 2) onSummon(this.position);
      }
    }

    if (this.phase === 2) {
      this.bileTimer += delta;
      if (this.bileTimer >= 2.6) {
        this.bileTimer = 0;
        const count = 9;
        for (let i = 0; i < count; i++) {
          const a = (i / count) * Math.PI * 2 + this.time;
          tempRingDir.set(Math.cos(a), 0, Math.sin(a));
          onSpit(this.position, tempRingDir);
        }
      }
    }

    if (!this.isTelegraphing) {
      const speed = this.phase === 2 ? 6.4 : 5.2;
      tempDir.copy(playerPos).sub(this.position).setY(0);
      if (tempDir.lengthSq() > 0) tempDir.normalize();

      this.position.x += tempDir.x * speed * delta;
      this.position.z += tempDir.z * speed * delta;
      this.position.y = this.terrain.getHeightAt(this.position.x, this.position.z) + 2.6;

      this.group.position.copy(this.position);
      this.group.lookAt(playerPos.x, this.position.y, playerPos.z);
    }
  }

  public deactivate(): void {
    this.active = false;
    this.group.visible = false;
    if (this.telegraphMesh) this.telegraphMesh.visible = false;
  }
}
