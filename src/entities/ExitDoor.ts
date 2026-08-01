import * as THREE from 'three';
import { HEX } from '../theme/Palette';

export type RewardType = 'SIGNAL' | 'SUPPLIES' | 'SCRAP' | 'ARSENAL' | 'HOME';

interface RewardInfo {
  glyph: string;
  header: string;
  sub: string;
  paint: string;
  accent: number;
}

export const REWARD_INFO: Record<RewardType, RewardInfo> = {
  SIGNAL: {
    glyph: '((•))',
    header: 'RADIO CONTACT',
    sub: 'A survivor is broadcasting. Take what they offer.',
    paint: '#c9a24a',
    accent: HEX.amber
  },
  SUPPLIES: {
    glyph: '+',
    header: 'MEDICAL POST',
    sub: 'Patch up. Raise your ceiling.',
    paint: '#c6c2b0',
    accent: 0xc6c2b0
  },
  SCRAP: {
    glyph: '¤',
    header: 'SALVAGE YARD',
    sub: 'Scrap you keep even if you die out here.',
    paint: '#b0803c',
    accent: HEX.brass
  },
  ARSENAL: {
    glyph: '✚',
    header: 'ARMS CACHE',
    sub: 'Something to make the gun hit harder.',
    paint: '#a8552b',
    accent: HEX.rust
  },
  // Only ever painted on the gate that opens after the Behemoth falls.
  HOME: {
    glyph: '←',
    header: 'THE WAY BACK',
    sub: 'End the run here. Everything you carry is banked.',
    paint: '#c6c2b0',
    accent: 0xa8b4a2
  }
};

/**
 * The way out of a sector: a cut in the fence with a hand-painted plywood
 * sign nailed above it telling you what is down that street.
 */
export class ExitDoor {
  public group: THREE.Group;
  public position: THREE.Vector3 = new THREE.Vector3();
  public rewardType: RewardType = 'SIGNAL';
  public radius: number = 2.2;
  public active: boolean = false;
  public isTriggered: boolean = false;

  private frameLeft: THREE.Mesh;
  private frameRight: THREE.Mesh;
  private lintel: THREE.Mesh;
  private curtain: THREE.Mesh;
  private curtainMat: THREE.MeshBasicMaterial;
  private lamp: THREE.PointLight;

  private signMesh!: THREE.Mesh;
  private signCanvas!: HTMLCanvasElement;
  private signTexture!: THREE.CanvasTexture;

  private hoverTime: number = 0;

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    this.group.visible = false;

    const postMat = new THREE.MeshStandardMaterial({ color: 0x4a4438, roughness: 0.9, metalness: 0.35, flatShading: true });
    const postGeo = new THREE.BoxGeometry(0.36, 4.6, 0.36);

    this.frameLeft = new THREE.Mesh(postGeo, postMat);
    this.frameLeft.position.set(-1.7, 2.3, 0);
    this.frameLeft.castShadow = true;
    this.group.add(this.frameLeft);

    this.frameRight = new THREE.Mesh(postGeo, postMat);
    this.frameRight.position.set(1.7, 2.3, 0);
    this.frameRight.castShadow = true;
    this.group.add(this.frameRight);

    this.lintel = new THREE.Mesh(new THREE.BoxGeometry(3.9, 0.36, 0.36), postMat);
    this.lintel.position.set(0, 4.5, 0);
    this.group.add(this.lintel);

    // Hanging plastic sheeting — the dark rectangle you actually walk into.
    this.curtainMat = new THREE.MeshBasicMaterial({
      color: 0x0d0e0b,
      transparent: true,
      opacity: 0.72,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    this.curtain = new THREE.Mesh(new THREE.PlaneGeometry(3.1, 4.2), this.curtainMat);
    this.curtain.position.set(0, 2.15, 0);
    this.group.add(this.curtain);

    // A single hurricane lamp so the gate reads at distance without glowing.
    this.lamp = new THREE.PointLight(0xd9a441, 26, 14, 2);
    this.lamp.position.set(0, 4.1, 0.5);
    this.group.add(this.lamp);

    const lampBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.13, 0.16, 0.34, 6),
      new THREE.MeshStandardMaterial({ color: HEX.amber, emissive: 0x6a4f18, roughness: 0.5 })
    );
    lampBody.position.set(0, 4.1, 0.5);
    this.group.add(lampBody);

    this.buildSign();
    scene.add(this.group);
  }

  private buildSign(): void {
    this.signCanvas = document.createElement('canvas');
    this.signCanvas.width = 512;
    this.signCanvas.height = 192;
    this.signTexture = new THREE.CanvasTexture(this.signCanvas);

    const mat = new THREE.MeshStandardMaterial({
      map: this.signTexture,
      roughness: 1.0,
      metalness: 0.0,
      transparent: true
    });
    this.signMesh = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 1.72), mat);
    this.signMesh.position.set(0, 5.7, 0.06);
    this.group.add(this.signMesh);
  }

  /** Redraws the plywood sign. Deliberately rough — it was painted in a hurry. */
  private paintSign(reward: RewardType): void {
    const ctx = this.signCanvas.getContext('2d')!;
    const info = REWARD_INFO[reward];

    ctx.clearRect(0, 0, 512, 192);

    // Plywood board.
    ctx.fillStyle = '#6a5636';
    ctx.fillRect(6, 6, 500, 180);
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    for (let i = 0; i < 30; i++) {
      ctx.fillRect(6, 6 + i * 6.2, 500, 1.4);
    }
    ctx.strokeStyle = 'rgba(20,16,10,0.85)';
    ctx.lineWidth = 5;
    ctx.strokeRect(6, 6, 500, 180);

    // Nails.
    ctx.fillStyle = '#2a2a24';
    for (const [nx, ny] of [[24, 24], [488, 24], [24, 168], [488, 168]]) {
      ctx.beginPath();
      ctx.arc(nx, ny, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.save();
    ctx.translate(256, 0);
    ctx.rotate(-0.015); // painted slightly crooked
    ctx.textAlign = 'center';

    ctx.fillStyle = info.paint;
    ctx.font = 'bold 58px "Arial Narrow", Impact, sans-serif';
    ctx.fillText(info.glyph, 0, 74);

    ctx.font = 'bold 34px "Arial Narrow", Impact, sans-serif';
    ctx.fillText(info.header, 0, 118);

    ctx.fillStyle = 'rgba(232,226,210,0.78)';
    ctx.font = '17px "Segoe UI", sans-serif';
    ctx.fillText(info.sub, 0, 150);
    ctx.restore();

    this.signTexture.needsUpdate = true;
  }

  public activate(pos: THREE.Vector3, reward: RewardType, facePlayer: boolean = true): void {
    this.rewardType = reward;
    this.position.copy(pos);
    this.group.position.copy(pos);
    this.hoverTime = 0;
    this.active = true;
    this.isTriggered = false;
    this.group.visible = true;

    // Gates sit on the arena edge; turn them to face the middle.
    if (facePlayer) {
      this.group.rotation.y = Math.atan2(-pos.x, -pos.z);
    }

    const info = REWARD_INFO[reward];
    this.lamp.color.setHex(info.accent);
    this.paintSign(reward);
  }

  public deactivate(): void {
    this.active = false;
    this.isTriggered = false;
    this.group.visible = false;
  }

  public update(delta: number): void {
    if (!this.active) return;
    this.hoverTime += delta;

    // Lamp flicker — a wick guttering, not a pulse effect.
    const flicker = 24 + Math.sin(this.hoverTime * 9.0) * 2.0 + Math.sin(this.hoverTime * 23.0) * 1.3;
    this.lamp.intensity = flicker;
    this.curtainMat.opacity = 0.66 + Math.sin(this.hoverTime * 1.6) * 0.06;
  }

  public checkPlayerCollision(playerPos: THREE.Vector3): boolean {
    if (!this.active || this.isTriggered) return false;
    const dx = playerPos.x - this.position.x;
    const dz = playerPos.z - this.position.z;
    if (dx * dx + dz * dz <= this.radius * this.radius) {
      this.isTriggered = true;
      return true;
    }
    return false;
  }
}
