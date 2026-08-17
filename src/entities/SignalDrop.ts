import * as THREE from 'three';
import { CAMERA_RIG } from '../graphics/CameraRig';
import { HEX } from '../theme/Palette';
import { drawSvg } from '../ui/art/Ink';
import { emblemSvg } from '../ui/art/Emblems';
import { callerToken, type CallerArtId } from '../ui/art/Portraits';
import { CALLERS } from '../ui/BoonModal';

const TOKEN_PX = 320;

/**
 * WHAT THE VOICE LEFT IN THE STREET.
 *
 * Hades does not hand you a boon for opening a door. It makes you clear the
 * room first, then drops the god's mark in the middle of the floor and waits
 * for you to walk into it — and only then does anybody speak. The gap between
 * the last kill and the pickup is the whole trick: the fight ends, the noise
 * stops, and a thing with somebody's name on it is standing there lit up.
 *
 * So this is deliberately not a Pickup. It does not get hoovered up by magnet
 * range and it does not stack with the coin drops; it is a case somebody set
 * down on this street, with their mark hanging over it, and the player has to
 * go and stand on it.
 */
export class SignalDrop {
  public group: THREE.Group;
  public position: THREE.Vector3 = new THREE.Vector3();
  /** Whose case this is. Null when the gate promised a mixed draw. */
  public caller: CallerArtId | null = null;
  public active: boolean = false;
  public claimed: boolean = false;
  public radius: number = 2.3;

  private tokenMesh: THREE.Mesh;
  private tokenMat: THREE.MeshBasicMaterial;
  private tokenTex: THREE.CanvasTexture;
  private tokenCanvas: HTMLCanvasElement;

  private beamMat: THREE.MeshBasicMaterial;
  private ringMat: THREE.MeshBasicMaterial;
  private lamp: THREE.PointLight;
  private time: number = 0;

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    this.group.visible = false;

    // The case itself. Small, scuffed, and unmistakably left rather than grown.
    const shell = new THREE.MeshStandardMaterial({ color: 0x3f4438, roughness: 0.85, metalness: 0.35, flatShading: true });
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.62, 1.0), shell);
    box.position.y = 0.31;
    box.castShadow = true;
    this.group.add(box);

    const strap = new THREE.Mesh(
      new THREE.BoxGeometry(1.56, 0.14, 0.22),
      new THREE.MeshStandardMaterial({ color: 0x25231c, roughness: 1.0 })
    );
    strap.position.y = 0.5;
    this.group.add(strap);

    // The mark, hanging over the case. Painted, not modelled: it is the same
    // artwork the gate plaque and the boon cards use, so the player has already
    // learned to read it before they ever see one on the floor.
    this.tokenCanvas = document.createElement('canvas');
    this.tokenCanvas.width = TOKEN_PX;
    this.tokenCanvas.height = TOKEN_PX;
    this.tokenTex = new THREE.CanvasTexture(this.tokenCanvas);
    this.tokenMat = new THREE.MeshBasicMaterial({ map: this.tokenTex, transparent: true, depthWrite: false });
    this.tokenMesh = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 2.0), this.tokenMat);
    this.tokenMesh.position.y = 2.15;
    this.group.add(this.tokenMesh);

    // A column of light, so it is findable from the far side of the street.
    this.beamMat = new THREE.MeshBasicMaterial({
      color: HEX.amber,
      transparent: true,
      opacity: 0.13,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 1.5, 8.0, 12, 1, true), this.beamMat);
    beam.position.y = 4.0;
    this.group.add(beam);

    // And a mark on the ground the size of the trigger, so "stand here" is a
    // shape on the floor rather than something the player has to guess at.
    this.ringMat = new THREE.MeshBasicMaterial({
      color: HEX.amber,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const ring = new THREE.Mesh(new THREE.RingGeometry(this.radius - 0.22, this.radius, 34), this.ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.06;
    this.group.add(ring);

    this.lamp = new THREE.PointLight(HEX.amber, 30, 13, 2);
    this.lamp.position.y = 2.2;
    this.group.add(this.lamp);

    scene.add(this.group);
  }

  public spawn(pos: THREE.Vector3, caller: CallerArtId | null): void {
    this.caller = caller;
    this.position.copy(pos);
    this.group.position.copy(pos);
    this.active = true;
    this.claimed = false;
    this.time = 0;
    this.group.visible = true;

    const tint = new THREE.Color(caller ? CALLERS[caller].color : '#e0bb6a');
    this.beamMat.color.copy(tint);
    this.ringMat.color.copy(tint);
    this.lamp.color.copy(tint);

    const ctx = this.tokenCanvas.getContext('2d')!;
    ctx.clearRect(0, 0, TOKEN_PX, TOKEN_PX);
    const art = caller ? callerToken(caller, TOKEN_PX) : emblemSvg('signal', TOKEN_PX);
    drawSvg(ctx, art, 10, 10, TOKEN_PX - 20, TOKEN_PX - 20, () => {
      this.tokenTex.needsUpdate = true;
    });
    this.tokenTex.needsUpdate = true;
  }

  public update(delta: number): void {
    if (!this.active) return;
    this.time += delta;

    // Turned to the camera every frame rather than once on spawn: the mark is
    // the thing being read, and it is never allowed to go edge-on.
    this.tokenMesh.rotation.y = CAMERA_RIG.facingYaw();
    this.tokenMesh.position.y = 2.15 + Math.sin(this.time * 1.7) * 0.13;

    this.lamp.intensity = 28 + Math.sin(this.time * 3.4) * 5;
    this.beamMat.opacity = 0.11 + Math.sin(this.time * 1.3) * 0.035;
    this.ringMat.opacity = 0.32 + Math.sin(this.time * 2.6) * 0.12;
  }

  /** @returns true exactly once, on the step the player walks into it. */
  public checkPlayerCollision(playerPos: THREE.Vector3): boolean {
    if (!this.active || this.claimed) return false;
    const dx = playerPos.x - this.position.x;
    const dz = playerPos.z - this.position.z;
    if (dx * dx + dz * dz > this.radius * this.radius) return false;
    this.claimed = true;
    return true;
  }

  public deactivate(): void {
    this.active = false;
    this.claimed = false;
    this.group.visible = false;
  }
}
