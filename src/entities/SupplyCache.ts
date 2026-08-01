import * as THREE from 'three';
import { HEX } from '../theme/Palette';

/**
 * A chained army supply crate.
 *
 * Breaking the padlock starts a timer and a lot of noise: clear the quota
 * before it runs out and it opens, otherwise it stays shut and you have made
 * the sector worse for nothing. The optional-risk beat of the run.
 */
export class SupplyCache {
  public group: THREE.Group;
  public position: THREE.Vector3 = new THREE.Vector3();
  public active: boolean = false;
  public isTriggered: boolean = false;
  public isOpen: boolean = false;
  public failed: boolean = false;

  public timeLeft: number = 0;
  public duration: number = 18.0;
  public required: number = 12;
  public kills: number = 0;

  private crate!: THREE.Mesh;
  private lid!: THREE.Mesh;
  private chains: THREE.Mesh[] = [];
  private crateMat!: THREE.MeshStandardMaterial;
  private lamp!: THREE.PointLight;
  private time: number = 0;

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    this.group.visible = false;

    this.crateMat = new THREE.MeshStandardMaterial({
      color: 0x4a5340,
      roughness: 0.85,
      metalness: 0.3,
      flatShading: true
    });

    this.crate = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.2, 1.4), this.crateMat);
    this.crate.position.y = 0.6;
    this.crate.castShadow = true;
    this.group.add(this.crate);

    this.lid = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.18, 1.5), this.crateMat);
    this.lid.position.y = 1.28;
    this.group.add(this.lid);

    // Chains wrapped over the top.
    const chainMat = new THREE.MeshStandardMaterial({ color: 0x54564c, roughness: 0.6, metalness: 0.8 });
    for (const dx of [-0.5, 0.5]) {
      const chain = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.06, 6, 16), chainMat);
      chain.position.set(dx, 0.65, 0);
      chain.rotation.y = Math.PI / 2;
      this.chains.push(chain);
      this.group.add(chain);
    }

    // Stencil on the side so it reads as military.
    const stencilCanvas = document.createElement('canvas');
    stencilCanvas.width = 256;
    stencilCanvas.height = 128;
    const sc = stencilCanvas.getContext('2d')!;
    sc.fillStyle = 'rgba(216, 200, 150, 0.55)';
    sc.font = 'bold 34px "Arial Narrow", Impact, sans-serif';
    sc.textAlign = 'center';
    sc.fillText('U.S. ARMY', 128, 52);
    sc.font = 'bold 22px "Arial Narrow", Impact, sans-serif';
    sc.fillText('RATION / MED', 128, 88);
    const stencilTex = new THREE.CanvasTexture(stencilCanvas);
    const stencil = new THREE.Mesh(
      new THREE.PlaneGeometry(1.7, 0.85),
      new THREE.MeshBasicMaterial({ map: stencilTex, transparent: true, opacity: 0.75 })
    );
    stencil.position.set(0, 0.62, -0.72);
    this.group.add(stencil);

    this.lamp = new THREE.PointLight(HEX.amber, 16, 9, 2);
    this.lamp.position.set(0, 1.7, 0);
    this.group.add(this.lamp);

    scene.add(this.group);
  }

  public spawn(pos: THREE.Vector3, required: number): void {
    this.position.copy(pos);
    this.group.position.copy(pos);
    this.active = true;
    this.isTriggered = false;
    this.isOpen = false;
    this.failed = false;
    this.timeLeft = 0;
    this.kills = 0;
    this.required = required;
    this.group.visible = true;
    this.crateMat.color.setHex(0x4a5340);
    this.lid.position.y = 1.28;
    this.lid.rotation.x = 0;
    for (const c of this.chains) c.visible = true;
  }

  public trigger(): void {
    if (this.isTriggered || !this.active) return;
    this.isTriggered = true;
    this.timeLeft = this.duration;
    this.kills = 0;
    this.crateMat.color.setHex(0x5c4030);
  }

  /** @returns true on the kill that completes the quota. */
  public addKill(): boolean {
    if (!this.isTriggered || this.isOpen || this.failed) return false;
    this.kills++;
    if (this.kills >= this.required) {
      this.isOpen = true;
      this.isTriggered = false;
      for (const c of this.chains) c.visible = false;
      this.lid.rotation.x = -1.1;
      this.lid.position.y = 1.42;
      this.crateMat.color.setHex(0x6b7a52);
      return true;
    }
    return false;
  }

  public update(delta: number): void {
    if (!this.active) return;
    this.time += delta;

    this.lamp.intensity = this.isTriggered
      ? 24 + Math.sin(this.time * 14) * 11
      : 14 + Math.sin(this.time * 2) * 2;

    if (this.isTriggered && !this.isOpen && !this.failed) {
      this.timeLeft -= delta;
      if (this.timeLeft <= 0) {
        this.failed = true;
        this.isTriggered = false;
        this.crateMat.color.setHex(0x3a3d33);
      }
    }
  }

  public deactivate(): void {
    this.active = false;
    this.isTriggered = false;
    this.group.visible = false;
  }
}
