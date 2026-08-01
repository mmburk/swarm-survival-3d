import * as THREE from 'three';
import { HEX } from '../theme/Palette';
import { ArcadePhysics } from '../physics/ArcadePhysics';
import type { Player } from './Player';

export type TradeId = 'DRESSING' | 'ROUNDS' | 'GREASE' | 'PLATE' | 'CHARM';

export interface TradeGood {
  id: TradeId;
  name: string;
  effect: string;
  cost: number;
  apply: (player: Player) => void;
}

const CATALOGUE: TradeGood[] = [
  {
    id: 'DRESSING',
    name: 'Field Dressing',
    effect: 'Patch up 65 health, right now',
    cost: 28,
    apply: (p) => p.heal(65)
  },
  {
    id: 'ROUNDS',
    name: 'Hand-Loaded Rounds',
    effect: '+14% damage for the rest of the run',
    cost: 62,
    apply: (p) => { p.damageMultiplier *= 1.14; }
  },
  {
    id: 'GREASE',
    name: 'Boot Grease',
    effect: '+9% movement speed',
    cost: 48,
    apply: (p) => { p.moveSpeed *= 1.09; }
  },
  {
    id: 'PLATE',
    name: 'Truck Door Plate',
    effect: '+25 maximum health, filled',
    cost: 70,
    apply: (p) => { p.maxHealth += 25; p.heal(25); }
  },
  {
    id: 'CHARM',
    name: 'Somebody\'s Saint Medal',
    effect: '+6% clean-hit chance, +3% damage taken reduction',
    cost: 55,
    apply: (p) => { p.critChance += 0.06; p.toughness = Math.min(0.5, p.toughness + 0.03); }
  }
];

interface Stall {
  good: TradeGood;
  position: THREE.Vector3;
  sold: boolean;
  itemMesh: THREE.Mesh;
  tagMesh: THREE.Mesh;
  tagCanvas: HTMLCanvasElement;
  tagTexture: THREE.CanvasTexture;
}

/**
 * VIC — the only living person you meet out there.
 *
 * Sits under the underpass with three things laid out on a blanket and a
 * shotgun across his knees. Doesn't talk, doesn't haggle, doesn't ask where
 * the scrap came from. The Charon of this game.
 */
export class Trader {
  public group: THREE.Group;
  public active: boolean = false;
  public position: THREE.Vector3 = new THREE.Vector3(0, 0, -12);

  private stalls: Stall[] = [];
  private vic!: THREE.Group;
  private lantern!: THREE.PointLight;
  private time: number = 0;

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    this.group.visible = false;

    this.buildVic();
    this.buildStalls();

    scene.add(this.group);
  }

  private buildVic(): void {
    this.vic = new THREE.Group();
    this.vic.position.copy(this.position);

    const coat = new THREE.MeshStandardMaterial({ color: 0x3c3a2e, roughness: 1.0, flatShading: true });
    const mask = new THREE.MeshStandardMaterial({ color: 0x6d6a5a, roughness: 0.7, metalness: 0.3, flatShading: true });

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.5, 0.7), coat);
    body.position.y = 1.0;
    body.castShadow = true;
    this.vic.add(body);

    // Long coat skirt.
    const skirt = new THREE.Mesh(new THREE.ConeGeometry(0.75, 1.1, 6), coat);
    skirt.position.y = 0.45;
    this.vic.add(skirt);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.38, 0.36), new THREE.MeshStandardMaterial({ color: 0x8a6f52, roughness: 0.9 }));
    head.position.y = 1.95;
    this.vic.add(head);

    // Welded gas mask — the reason nobody has seen his face.
    const maskMesh = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.28, 0.18), mask);
    maskMesh.position.set(0, 1.9, -0.24);
    this.vic.add(maskMesh);

    const filter = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.22, 8), mask);
    filter.rotation.x = Math.PI / 2;
    filter.position.set(0.11, 1.84, -0.38);
    this.vic.add(filter);

    const hood = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.24, 0.46), coat);
    hood.position.y = 2.14;
    this.vic.add(hood);

    // Shotgun across the knees.
    const gun = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 0.1, 0.1),
      new THREE.MeshStandardMaterial({ color: 0x2c2e26, roughness: 0.6, metalness: 0.6 })
    );
    gun.position.set(0, 1.05, -0.45);
    gun.rotation.z = 0.08;
    this.vic.add(gun);

    // Shopping cart of salvage behind him.
    const cart = new THREE.Mesh(
      new THREE.BoxGeometry(1.3, 0.9, 1.9),
      new THREE.MeshStandardMaterial({ color: 0x5a5d52, roughness: 0.7, metalness: 0.55, wireframe: true })
    );
    cart.position.set(-2.2, 0.7, 0.6);
    this.vic.add(cart);

    for (let i = 0; i < 6; i++) {
      const junk = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 0.24, 0.3),
        new THREE.MeshStandardMaterial({ color: [0x7a6a4a, 0x5f6a52, 0x6b5f52][i % 3], roughness: 0.8, metalness: 0.4 })
      );
      junk.position.set(-2.2 + (Math.random() - 0.5) * 0.8, 0.9 + Math.random() * 0.3, 0.6 + (Math.random() - 0.5) * 1.4);
      junk.rotation.y = Math.random() * Math.PI;
      this.vic.add(junk);
    }

    // Storm lantern hung on a pole.
    this.lantern = new THREE.PointLight(0xd9a441, 42, 18, 2);
    this.lantern.position.set(1.6, 2.6, 0);
    this.vic.add(this.lantern);

    const lanternBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.26, 0.36, 0.26),
      new THREE.MeshStandardMaterial({ color: 0xd9a441, emissive: 0x7a5518, roughness: 0.5 })
    );
    lanternBody.position.set(1.6, 2.6, 0);
    this.vic.add(lanternBody);

    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 3.2, 5),
      new THREE.MeshStandardMaterial({ color: 0x4a4d42, roughness: 0.8, metalness: 0.5 })
    );
    pole.position.set(1.6, 1.6, 0.2);
    this.vic.add(pole);

    this.group.add(this.vic);
  }

  private buildStalls(): void {
    // A blanket with three things on it.
    const blanket = new THREE.Mesh(
      new THREE.PlaneGeometry(11, 4.6),
      new THREE.MeshStandardMaterial({ color: 0x5d4535, roughness: 1.0 })
    );
    blanket.rotation.x = -Math.PI / 2;
    blanket.position.set(0, 0.03, -8.4);
    this.group.add(blanket);

    const slots = [
      new THREE.Vector3(-4.0, 0, -8.4),
      new THREE.Vector3(0, 0, -8.4),
      new THREE.Vector3(4.0, 0, -8.4)
    ];

    for (const pos of slots) {
      const crate = new THREE.Mesh(
        new THREE.BoxGeometry(1.5, 0.7, 1.5),
        new THREE.MeshStandardMaterial({ color: 0x54432c, roughness: 0.95, flatShading: true })
      );
      crate.position.set(pos.x, 0.35, pos.z);
      crate.castShadow = true;
      this.group.add(crate);

      const itemMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.6, 0.5, 0.6),
        new THREE.MeshStandardMaterial({ color: HEX.brass, roughness: 0.5, metalness: 0.6, flatShading: true })
      );
      itemMesh.position.set(pos.x, 1.0, pos.z);
      this.group.add(itemMesh);

      const tagCanvas = document.createElement('canvas');
      tagCanvas.width = 320;
      tagCanvas.height = 160;
      const tagTexture = new THREE.CanvasTexture(tagCanvas);
      const tagMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(3.2, 1.6),
        new THREE.MeshBasicMaterial({ map: tagTexture, transparent: true })
      );
      tagMesh.position.set(pos.x, 2.5, pos.z);
      tagMesh.rotation.x = -0.35;
      this.group.add(tagMesh);

      this.stalls.push({
        good: CATALOGUE[0],
        position: pos.clone(),
        sold: false,
        itemMesh,
        tagCanvas,
        tagTexture,
        tagMesh
      });
    }
  }

  /** Hand-lettered cardboard price tag. */
  private paintTag(stall: Stall, affordable: boolean): void {
    const ctx = stall.tagCanvas.getContext('2d')!;
    ctx.clearRect(0, 0, 320, 160);

    ctx.fillStyle = 'rgba(190, 176, 138, 0.95)';
    ctx.fillRect(8, 8, 304, 144);
    ctx.strokeStyle = 'rgba(40, 32, 20, 0.8)';
    ctx.lineWidth = 3;
    ctx.strokeRect(8, 8, 304, 144);

    ctx.textAlign = 'center';

    if (stall.sold) {
      ctx.fillStyle = '#7a2020';
      ctx.font = 'bold 44px "Arial Narrow", Impact, sans-serif';
      ctx.fillText('TAKEN', 160, 92);
      stall.tagTexture.needsUpdate = true;
      return;
    }

    ctx.fillStyle = '#20180e';
    ctx.font = 'bold 27px "Arial Narrow", Impact, sans-serif';
    ctx.fillText(stall.good.name.toUpperCase(), 160, 44);

    ctx.fillStyle = 'rgba(38, 30, 18, 0.85)';
    ctx.font = '15px "Segoe UI", sans-serif';
    // Wrap the effect line by hand — the canvas API will not do it for us.
    const words = stall.good.effect.split(' ');
    let line = '';
    let y = 74;
    for (const w of words) {
      if (ctx.measureText(line + w).width > 270) {
        ctx.fillText(line.trim(), 160, y);
        line = '';
        y += 19;
      }
      line += w + ' ';
    }
    ctx.fillText(line.trim(), 160, y);

    ctx.fillStyle = affordable ? '#7a4a12' : '#8a2020';
    ctx.font = 'bold 30px "Arial Narrow", Impact, sans-serif';
    ctx.fillText(`${stall.good.cost} SCRAP`, 160, 140);

    stall.tagTexture.needsUpdate = true;
  }

  /** Picks three distinct goods and opens the stall. */
  public activate(currentScrap: number): void {
    this.active = true;
    this.group.visible = true;

    const pool = [...CATALOGUE].sort(() => Math.random() - 0.5);
    for (let i = 0; i < this.stalls.length; i++) {
      const stall = this.stalls[i];
      stall.good = pool[i % pool.length];
      stall.sold = false;
      (stall.itemMesh.material as THREE.MeshStandardMaterial).opacity = 1;
      (stall.itemMesh.material as THREE.MeshStandardMaterial).transparent = false;
      this.paintTag(stall, currentScrap >= stall.good.cost);
    }
  }

  public deactivate(): void {
    this.active = false;
    this.group.visible = false;
  }

  /** The good the player is standing in front of, if any. */
  public goodAt(playerPos: THREE.Vector3): { good: TradeGood; index: number } | null {
    for (let i = 0; i < this.stalls.length; i++) {
      const s = this.stalls[i];
      if (s.sold) continue;
      const dx = playerPos.x - s.position.x;
      const dz = playerPos.z - s.position.z;
      if (dx * dx + dz * dz <= 6.25) return { good: s.good, index: i };
    }
    return null;
  }

  public markSold(index: number): void {
    const stall = this.stalls[index];
    if (!stall) return;
    stall.sold = true;
    const mat = stall.itemMesh.material as THREE.MeshStandardMaterial;
    mat.transparent = true;
    mat.opacity = 0.2;
    this.paintTag(stall, false);
  }

  public refreshTags(currentScrap: number): void {
    for (const s of this.stalls) {
      if (!s.sold) this.paintTag(s, currentScrap >= s.good.cost);
    }
  }

  public update(delta: number, player?: Player): void {
    if (!this.active) return;
    this.time += delta;

    this.lantern.intensity = 38 + Math.sin(this.time * 6.5) * 2.6 + Math.sin(this.time * 17) * 1.5;

    // Vic tracks you with his head; the rest of him does not move.
    if (player) {
      const dx = player.position.x - this.position.x;
      const dz = player.position.z - this.position.z;
      this.vic.rotation.y = THREE.MathUtils.lerp(this.vic.rotation.y, Math.atan2(dx, dz) + Math.PI, delta * 3);

      ArcadePhysics.resolveSolidObstacle(player.position, player.radius, { x: this.position.x, z: this.position.z, radius: 1.4 });
    }

    for (let i = 0; i < this.stalls.length; i++) {
      const s = this.stalls[i];
      if (s.sold) continue;
      s.itemMesh.rotation.y += delta * 0.9;
      s.itemMesh.position.y = 1.0 + Math.sin(this.time * 2.2 + i) * 0.06;
    }
  }
}
