import * as THREE from 'three';
import { CAMERA_RIG } from '../graphics/CameraRig';
import { HEX } from '../theme/Palette';
import { drawSvg } from '../ui/art/Ink';
import { emblemSvg, type EmblemId } from '../ui/art/Emblems';
import { callerToken, callerSigil, type CallerArtId } from '../ui/art/Portraits';
import { CALLERS } from '../ui/BoonModal';

/**
 * What is down that street.
 *
 * Hades tells you what a door pays before you walk through it — the god's
 * symbol is nailed over the frame, and you pick the boon you want by picking
 * the door. Same contract here: the plaque names the reward, and for a radio
 * contact it names and shows the survivor, so choosing the door is choosing
 * whose help you are about to get.
 */
export type RewardType = 'SIGNAL' | 'SUPPLIES' | 'SCRAP' | 'ARSENAL' | 'TRADE' | 'WORKBENCH' | 'HOME';

interface RewardInfo {
  emblem: EmblemId;
  header: string;
  sub: string;
  paint: string;
  accent: number;
}

/**
 * Sub-lines are kept to about twenty characters on purpose. The plaque is read
 * from across a street, so the lettering has to be enormous relative to the
 * board, and long flavour text at that size only shrinks itself back into being
 * unreadable. Say it short or do not say it.
 */
export const REWARD_INFO: Record<RewardType, RewardInfo> = {
  SIGNAL: {
    emblem: 'signal',
    header: 'RADIO CONTACT',
    sub: 'A voice down there.',
    paint: '#e0bb6a',
    accent: HEX.amber
  },
  SUPPLIES: {
    emblem: 'supplies',
    header: 'MEDICAL POST',
    sub: 'Patch up. Raise the cap.',
    paint: '#ded8c4',
    accent: 0xc6c2b0
  },
  SCRAP: {
    emblem: 'scrap',
    header: 'SALVAGE YARD',
    sub: 'Scrap you get to keep.',
    paint: '#d8a856',
    accent: HEX.brass
  },
  ARSENAL: {
    emblem: 'arsenal',
    header: 'ARMS CACHE',
    sub: 'Something for the gun.',
    paint: '#d1743f',
    accent: HEX.rust
  },
  TRADE: {
    emblem: 'trade',
    header: "VIC'S UNDERPASS",
    sub: 'He is still trading.',
    paint: '#c2ab77',
    accent: 0x9a8256
  },
  // The rarest plaque in the game, and the only one that changes how the gun
  // is played rather than how hard it hits. See RewardDeck for why it turns up
  // when it does — this door is scheduled, never dealt.
  WORKBENCH: {
    emblem: 'works',
    header: 'THE WORKBENCH',
    sub: 'Tools still clamped down.',
    paint: '#b9c5cc',
    accent: 0x7f8a92
  },
  // Only ever painted on the gate that opens after the Behemoth falls.
  HOME: {
    emblem: 'home',
    header: 'THE WAY BACK',
    sub: 'Bank it. End the run.',
    paint: '#cdd4c4',
    accent: 0xa8b4a2
  }
};

const SIGN_W = 896;
const SIGN_H = 400;
/** World size of the board. Wide enough that the header survives the ortho frame. */
const SIGN_PLANE_W = 7.0;
const SIGN_PLANE_H = SIGN_PLANE_W * (SIGN_H / SIGN_W);
/** Top of the lintel: the board is nailed across it and overhangs both posts. */
const LINTEL_TOP = 5.11;

/**
 * How far a gate is allowed to turn away from square-to-camera.
 *
 * Everything that carries the gate's meaning — the plaque, the stencilled
 * sigil, the sheeting — is a flat plane facing the gate's own forward. Turned
 * to face the middle of the arena on a 45-degree rig, one of the two gates
 * ended up almost exactly edge-on and vanished. So the turn towards the middle
 * survives only as a nudge: enough to keep the pair from looking like stickers,
 * never enough to make one of them unreadable.
 */
const MAX_SKEW = 20 * (Math.PI / 180);

/**
 * The way out of a sector: a cut in the fence with a hand-painted plaque
 * nailed above it telling you what is down that street.
 */
export class ExitDoor {
  public group: THREE.Group;
  public position: THREE.Vector3 = new THREE.Vector3();
  public rewardType: RewardType = 'SIGNAL';
  /** Set only on SIGNAL gates — whose voice is waiting on the other side. */
  public caller: CallerArtId | null = null;
  /** Preview of what the gate pays, painted onto the plaque. */
  public rewardValue: string = '';
  public radius: number = 2.6;
  public active: boolean = false;
  public isTriggered: boolean = false;

  private frameLeft: THREE.Mesh;
  private frameRight: THREE.Mesh;
  private lintel: THREE.Mesh;
  private curtain: THREE.Mesh;
  private curtainMat: THREE.MeshBasicMaterial;
  private lamp: THREE.PointLight;
  private sigilMat: THREE.MeshBasicMaterial;
  private sigilTexture: THREE.CanvasTexture;
  private sigilCanvas: HTMLCanvasElement;

  private signMesh!: THREE.Mesh;
  private signCanvas!: HTMLCanvasElement;
  private signTexture!: THREE.CanvasTexture;

  private hoverTime: number = 0;

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    this.group.visible = false;

    const postMat = new THREE.MeshStandardMaterial({ color: 0x4a4438, roughness: 0.9, metalness: 0.35, flatShading: true });
    const postGeo = new THREE.BoxGeometry(0.42, 5.0, 0.42);

    this.frameLeft = new THREE.Mesh(postGeo, postMat);
    this.frameLeft.position.set(-2.25, 2.5, 0);
    this.frameLeft.castShadow = true;
    this.group.add(this.frameLeft);

    this.frameRight = new THREE.Mesh(postGeo, postMat);
    this.frameRight.position.set(2.25, 2.5, 0);
    this.frameRight.castShadow = true;
    this.group.add(this.frameRight);

    this.lintel = new THREE.Mesh(new THREE.BoxGeometry(5.1, 0.42, 0.42), postMat);
    this.lintel.position.set(0, 4.9, 0);
    this.group.add(this.lintel);

    // Hanging plastic sheeting — the dark rectangle you actually walk into.
    this.curtainMat = new THREE.MeshBasicMaterial({
      color: 0x0d0e0b,
      transparent: true,
      opacity: 0.72,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    this.curtain = new THREE.Mesh(new THREE.PlaneGeometry(4.1, 4.6), this.curtainMat);
    this.curtain.position.set(0, 2.3, 0);
    this.group.add(this.curtain);

    // The reward's mark, sprayed straight onto the sheeting. Readable from
    // across the street long before the plaque's text is.
    this.sigilCanvas = document.createElement('canvas');
    this.sigilCanvas.width = 256;
    this.sigilCanvas.height = 256;
    this.sigilTexture = new THREE.CanvasTexture(this.sigilCanvas);
    this.sigilMat = new THREE.MeshBasicMaterial({
      map: this.sigilTexture,
      transparent: true,
      opacity: 0.9,
      depthWrite: false
    });
    const sigil = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), this.sigilMat);
    sigil.position.set(0, 2.6, 0.04);
    this.group.add(sigil);

    // A single hurricane lamp so the gate reads at distance without glowing.
    this.lamp = new THREE.PointLight(0xd9a441, 26, 14, 2);
    this.lamp.position.set(0, 4.5, 0.5);
    this.group.add(this.lamp);

    const lampBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.13, 0.16, 0.34, 6),
      new THREE.MeshStandardMaterial({ color: HEX.amber, emissive: 0x6a4f18, roughness: 0.5 })
    );
    lampBody.position.set(0, 4.5, 0.5);
    this.group.add(lampBody);

    this.buildSign();
    scene.add(this.group);
  }

  private buildSign(): void {
    this.signCanvas = document.createElement('canvas');
    this.signCanvas.width = SIGN_W;
    this.signCanvas.height = SIGN_H;
    this.signTexture = new THREE.CanvasTexture(this.signCanvas);

    const mat = new THREE.MeshStandardMaterial({
      map: this.signTexture,
      roughness: 1.0,
      metalness: 0.0,
      transparent: true
    });
    this.signMesh = new THREE.Mesh(new THREE.PlaneGeometry(SIGN_PLANE_W, SIGN_PLANE_H), mat);
    this.signMesh.position.set(0, LINTEL_TOP + SIGN_PLANE_H / 2, 0.06);
    this.group.add(this.signMesh);
  }

  /**
   * Repaints the plaque. Deliberately rough — it was lettered in a hurry with
   * whatever paint was in the shed — but the art on it is the real signal.
   */
  private paintSign(): void {
    const ctx = this.signCanvas.getContext('2d')!;
    const info = REWARD_INFO[this.rewardType];
    const caller = this.rewardType === 'SIGNAL' ? this.caller : null;
    const header = caller ? CALLERS[caller].name : info.header;
    const sub = caller ? CALLERS[caller].band : info.sub;

    ctx.clearRect(0, 0, SIGN_W, SIGN_H);

    // Plywood board.
    ctx.fillStyle = '#6a5636';
    ctx.fillRect(10, 10, SIGN_W - 20, SIGN_H - 20);
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    for (let i = 0; i < 60; i++) {
      ctx.fillRect(10, 10 + i * 6.6, SIGN_W - 20, 1.6);
    }
    // A wash of the reward's colour, so the board itself is colour-coded.
    ctx.fillStyle = info.paint;
    ctx.globalAlpha = 0.1;
    ctx.fillRect(10, 10, SIGN_W - 20, SIGN_H - 20);
    ctx.globalAlpha = 1;

    ctx.strokeStyle = 'rgba(20,16,10,0.88)';
    ctx.lineWidth = 9;
    ctx.strokeRect(10, 10, SIGN_W - 20, SIGN_H - 20);
    ctx.strokeStyle = info.paint;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 3;
    ctx.strokeRect(26, 26, SIGN_W - 52, SIGN_H - 52);
    ctx.globalAlpha = 1;

    // Nails.
    ctx.fillStyle = '#2a2a24';
    for (const [nx, ny] of [[40, 40], [SIGN_W - 40, 40], [40, SIGN_H - 40], [SIGN_W - 40, SIGN_H - 40]]) {
      ctx.beginPath();
      ctx.arc(nx, ny, 8, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.textAlign = 'left';

    // Hand-lettering does not reflow, it just gets squeezed in — so does this.
    const fit = (text: string, size: number, family: string, limit: number): number => {
      let s = size;
      ctx.font = `${family.replace('%s', String(s))}`;
      while (ctx.measureText(text).width > limit && s > 11) {
        s -= 1;
        ctx.font = family.replace('%s', String(s));
      }
      return s;
    };

    const stencil = 'bold %spx "Arial Narrow", Impact, sans-serif';
    const body = '%spx "Segoe UI", sans-serif';

    // The board arrives on screen about 180 pixels wide, so what the header
    // can be is set by how much of the board's *width* it is allowed to have,
    // not by how much room is left over. Hence the layout: the name takes the
    // full width of the top of the board on its own line, and the mark, the
    // band and the price share the row underneath it. Putting the mark beside
    // the name — which is how this board used to read — cost the lettering a
    // third of its size and made the whole thing unreadable at a run.
    const HEADER_LEFT = 40;
    const HEADER_MAX = SIGN_W - 80;
    const ROW_LEFT = 232;
    const ROW_MAX = SIGN_W - 40 - ROW_LEFT;

    ctx.fillStyle = info.paint;
    fit(header, 150, stencil, HEADER_MAX);
    ctx.fillText(header, HEADER_LEFT, 158);

    ctx.fillStyle = 'rgba(238,232,214,0.82)';
    fit(sub, 50, body, ROW_MAX);
    ctx.fillText(sub, ROW_LEFT, 246);

    if (this.rewardValue) {
      fit(this.rewardValue, 60, stencil, ROW_MAX - 44);
      const w = Math.min(ROW_MAX, ctx.measureText(this.rewardValue).width + 44);
      ctx.fillStyle = 'rgba(16,13,8,0.75)';
      ctx.fillRect(ROW_LEFT, 274, w, 84);
      ctx.strokeStyle = info.paint;
      ctx.lineWidth = 3.5;
      ctx.strokeRect(ROW_LEFT, 274, w, 84);
      ctx.fillStyle = info.paint;
      ctx.fillText(this.rewardValue, ROW_LEFT + 22, 336);
    }

    this.signTexture.needsUpdate = true;

    // A struck mark, never a face: at gate distance a portrait is mud, and the
    // player is meant to recognise whose door this is at a glance.
    // The art rasterises asynchronously the first time; it flags the texture
    // again as it lands.
    const art = caller ? callerToken(caller, 200) : emblemSvg(info.emblem, 200);
    drawSvg(ctx, art, 40, 190, 172, 172, () => {
      this.signTexture.needsUpdate = true;
    });
  }

  /** The mark sprayed on the sheeting: the caller's sigil, or the token. */
  private paintSigil(): void {
    const ctx = this.sigilCanvas.getContext('2d')!;
    const info = REWARD_INFO[this.rewardType];
    ctx.clearRect(0, 0, 256, 256);

    // Sprayed in the caller's own colour, not the reward's, so the stencil on
    // the sheeting and the mark on the plaque agree about whose door this is.
    const svg = this.rewardType === 'SIGNAL' && this.caller
      ? callerSigil(this.caller, 200, CALLERS[this.caller].color)
      : emblemSvg(info.emblem, 200);

    drawSvg(ctx, svg, 28, 28, 200, 200, () => {
      this.sigilTexture.needsUpdate = true;
    });
    this.sigilTexture.needsUpdate = true;
  }

  public activate(
    pos: THREE.Vector3,
    reward: RewardType,
    faceCamera: boolean = true,
    caller: CallerArtId | null = null,
    value: string = ''
  ): void {
    this.rewardType = reward;
    this.caller = reward === 'SIGNAL' ? caller : null;
    this.rewardValue = value;
    this.position.copy(pos);
    this.group.position.copy(pos);
    this.hoverTime = 0;
    this.active = true;
    this.isTriggered = false;
    this.group.visible = true;

    // The camera looks down on the board at the rig's rake, which squashes
    // everything vertical by cos(rake): a plaque painted at 2.24:1 lands on
    // screen at nearly 3:1 and the lettering loses a fifth of its height for
    // nothing. Stretched back out here, so the board reads as it was painted.
    const cosRake = Math.sqrt(Math.max(0.05, 1 - CAMERA_RIG.pitchSin * CAMERA_RIG.pitchSin));
    this.signMesh.scale.y = 1 / cosRake;
    this.signMesh.position.y = LINTEL_TOP + SIGN_PLANE_H / (2 * cosRake);

    // Square to the camera first, then leaned a little towards the middle of
    // the street. A gate you cannot read is a gate you cannot choose.
    if (faceCamera) {
      const camYaw = CAMERA_RIG.facingYaw();
      let skew = Math.atan2(-pos.x, -pos.z) - camYaw;
      while (skew > Math.PI) skew -= Math.PI * 2;
      while (skew < -Math.PI) skew += Math.PI * 2;
      this.group.rotation.y = camYaw + THREE.MathUtils.clamp(skew, -MAX_SKEW, MAX_SKEW);
    }

    const info = REWARD_INFO[reward];
    this.lamp.color.setHex(this.caller ? new THREE.Color(CALLERS[this.caller].color).getHex() : info.accent);
    this.paintSign();
    this.paintSigil();
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
    this.sigilMat.opacity = 0.78 + Math.sin(this.hoverTime * 2.2) * 0.12;
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
