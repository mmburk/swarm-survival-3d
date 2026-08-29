import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { EnemyType, PROFILES } from '../entities/Enemy';
import type { Enemy } from '../entities/Enemy';
import { HEX } from '../theme/Palette';
import { tint } from './VertexTint';
import { CAMERA_RIG } from './CameraRig';

/**
 * Every zombie on the street, drawn in ten calls.
 *
 * Each one used to be a small scene graph of its own: a group holding a body
 * group, which held the merged torso mesh and two arms, plus two health-bar
 * planes hanging off the top. Three draw calls each while it was upright, five
 * once you had hurt it, and with fifty of them on screen that was 172 of the
 * frame's 236 calls — the zombies cost roughly three times everything else in
 * the game put together. The pool also parked 180 idle copies of that same
 * hierarchy in the scene, so a thousand-odd matrices were being recomposed
 * every frame for bodies that were nowhere.
 *
 * So the meshes are gone from the entities. An `Enemy` is now numbers — where
 * it is, which way it is facing, how far through its shuffle it is — and this
 * writes those numbers into shared instance buffers once a frame.
 */

/** Instance capacity. Matches the enemy pool's hard cap. */
const MAX_ENEMIES = 340;

const SOCKET_COLOR = 0x14120e;
const JAW_COLOR = 0x6b1a1a;

/**
 * The merged, vertex-coloured body for one zombie type.
 *
 * The types share the same box proportions and differ only in the cloth
 * and flesh shades baked into them, which is why there is one of these per
 * type rather than one for all of them: a single per-instance colour cannot
 * move two baked colours independently.
 */
function bodyGeometryFor(type: EnemyType): THREE.BufferGeometry {
  const p = PROFILES[type] ?? PROFILES.SHAMBLER;
  const parts: THREE.BufferGeometry[] = [];

  // A Clinger is crouched over its own knees with its head thrown forward,
  // which is the only shape on the street that reads as *coming for you*
  // rather than *walking at you*. Everything above the legs drops and leans.
  const stoop = type === EnemyType.CLINGER ? 0.26 : 0;
  const lean = type === EnemyType.CLINGER ? -0.16 : 0;

  const leftLeg = new THREE.BoxGeometry(0.21, 0.62, 0.21).translate(-0.17, 0.31, 0.04);
  const rightLeg = new THREE.BoxGeometry(0.21, 0.62, 0.21).translate(0.17, 0.31, 0.04);
  const torso = new THREE.BoxGeometry(0.62, 0.8, 0.42).translate(0, 0.98 - stoop, lean * 0.5);
  parts.push(tint(leftLeg, p.cloth), tint(rightLeg, p.cloth), tint(torso, p.cloth));

  // Exposed ribs through the torn shirt front.
  const wound = new THREE.BoxGeometry(0.3, 0.34, 0.06).translate(0.04, 0.96 - stoop, -0.22 + lean * 0.5);
  // Head lolls to one side; the tilt is baked in.
  const head = new THREE.BoxGeometry(0.36, 0.38, 0.36).rotateZ(0.14).translate(0, 1.55 - stoop, -0.06 + lean);
  parts.push(tint(wound, p.flesh), tint(head, p.flesh));

  const leftSocket = new THREE.BoxGeometry(0.09, 0.07, 0.05).translate(-0.09, 1.59 - stoop, -0.25 + lean);
  const rightSocket = new THREE.BoxGeometry(0.09, 0.07, 0.05).translate(0.09, 1.59 - stoop, -0.25 + lean);
  parts.push(tint(leftSocket, SOCKET_COLOR), tint(rightSocket, SOCKET_COLOR));

  // A Screamer has to be picked out of a crowd, and in a crowd a colour is
  // nothing. What carries is the outline: the jaw is unhinged and hanging,
  // more than twice the drop of anything else on the street.
  //
  // Note what "at fifteen metres" does and does not mean here. The rig is
  // orthographic, so distance changes the size of nothing — a Screamer holding
  // its standoff is exactly as big on screen as one standing on you. What is
  // actually hard about reading it at range is the thirty-three other bodies
  // in between, so the tell has to survive clutter, not shrinking.
  //
  // Measured: at 1080p one world unit is 38.6 pixels, so this jaw is 10 pixels
  // tall against 4 for every other type, hanging 5 pixels lower — and 9 after
  // the Screamer's own 0.92 scale. At 720p that is 7 against 3. It is a real
  // difference and it is not a large one; whether it survives a full street is
  // the one question here that needs an eye.
  const jaw = type === EnemyType.SCREAMER
    ? new THREE.BoxGeometry(0.24, 0.26, 0.14).translate(0, 1.3, -0.21)
    : new THREE.BoxGeometry(0.2, 0.1, 0.12).translate(0, 1.42 - stoop, -0.2 + lean);
  parts.push(tint(jaw, JAW_COLOR));

  // useGroups = false: grouping would keep one draw call per material and
  // defeat the whole point of merging.
  const merged = mergeGeometries(parts, false);
  for (const part of parts) part.dispose();
  return merged;
}

const TYPES: EnemyType[] = [
  EnemyType.SHAMBLER,
  EnemyType.SPRINTER,
  EnemyType.BLOATER,
  EnemyType.BUTCHER,
  EnemyType.BURSTER,
  EnemyType.SCREAMER,
  EnemyType.CLINGER
];

/**
 * Hit flash. Was an emissive add on a per-body material, which instancing has
 * no room for; this multiplies the baked colours instead, which reads the same
 * way at the fifteen-hundredths of a second it is on screen for.
 */
const FLASH = new THREE.Color(2.6, 2.4, 2.2);
/** A Burster's gas building — the tell that it is about to go. */
const HOT = new THREE.Color(2.2, 2.0, 0.8);
/**
 * The marked, all four of them, in one colour.
 *
 * Cold and slightly wrong, and deliberately nowhere near `HOT`: a body about
 * to go off and a body with a rule on it must never be confused at fifteen
 * metres. What kind of wrong it is, the street shows you — four tints on
 * thirty-four bodies would be a palette nobody could read.
 */
const MARKED = new THREE.Color(1.15, 1.4, 1.75);
const PLAIN = new THREE.Color(1, 1, 1);

/** Type to slot in the parallel arrays below, so no lookup allocates. */
const TYPE_SLOT: Record<EnemyType, number> = {
  SHAMBLER: 0,
  SPRINTER: 1,
  BLOATER: 2,
  BUTCHER: 3,
  BURSTER: 4,
  SCREAMER: 5,
  CLINGER: 6
};

export class InstancedEnemies {
  /** One batch per body type, since each carries its own baked colours. */
  private bodies: THREE.InstancedMesh[] = [];
  /** Live instance count per body type, refilled each frame. */
  private counts = new Int32Array(TYPES.length);
  /** Both arms of every zombie, tinted per instance. */
  private arms: THREE.InstancedMesh;
  private hpBack: THREE.InstancedMesh;
  private hpFill: THREE.InstancedMesh;

  /**
   * A stand-in for the hierarchy each zombie used to own. Setting it up and
   * reading the world matrices back out gives exactly the transforms the scene
   * graph produced, without asking the renderer to walk six nodes per body.
   */
  private root = new THREE.Object3D();
  private torso = new THREE.Object3D();
  private leftArm = new THREE.Object3D();
  private rightArm = new THREE.Object3D();

  /**
   * The health strip stands apart from the body it belongs to.
   *
   * It used to hang off the same group, which meant it turned with the zombie:
   * ring sixteen of them round the player and five of the bars came out within
   * a quarter of edge-on -- slivers a pixel wide -- and one faced away
   * outright. Whether you could read how much was left in something depended on
   * which way it happened to be looking. It is a readout, so it faces the
   * camera and nothing else.
   */
  private barRoot = new THREE.Object3D();
  private barBack = new THREE.Object3D();
  private barFill = new THREE.Object3D();

  private tintBuffer = new THREE.Color();

  constructor(scene: THREE.Scene) {
    const bodyMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.95,
      metalness: 0.0,
      flatShading: true
    });

    for (const type of TYPES) {
      const mesh = new THREE.InstancedMesh(bodyGeometryFor(type), bodyMat, MAX_ENEMIES);
      this.prepare(mesh, scene);
      this.bodies[TYPE_SLOT[type]] = mesh;
    }

    // Arms stay their own batch because they animate out of phase with the
    // body — that paw forward is most of what makes the silhouette read as a
    // zombie — and because a flat colour is exactly what an instance tint can
    // carry, so every type shares one geometry here.
    const armMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.95,
      metalness: 0.0,
      flatShading: true
    });
    this.arms = new THREE.InstancedMesh(new THREE.BoxGeometry(0.15, 0.15, 0.7), armMat, MAX_ENEMIES * 2);
    this.prepare(this.arms, scene);

    // Damage readout — a scratched strip, only shown once hurt.
    this.hpBack = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(1.1, 0.1),
      new THREE.MeshBasicMaterial({ color: 0x1a1a14, side: THREE.DoubleSide, transparent: true, opacity: 0.85 }),
      MAX_ENEMIES
    );
    this.prepare(this.hpBack, scene);

    this.hpFill = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(1.06, 0.07),
      new THREE.MeshBasicMaterial({ color: HEX.blood, side: THREE.DoubleSide }),
      MAX_ENEMIES
    );
    this.prepare(this.hpFill, scene);

    // Fixed local transforms, set once. Everything else is per frame.
    this.root.add(this.torso);
    this.torso.add(this.leftArm);
    this.torso.add(this.rightArm);
    this.barRoot.add(this.barBack);
    this.barRoot.add(this.barFill);

    // Base hunch. Overwritten every frame now that the swing leans off it.
    this.torso.rotation.x = -0.22;
    this.leftArm.position.set(-0.38, 1.0, -0.38);
    this.rightArm.position.set(0.38, 1.0, -0.38);

    // Yaw then tilt, which is what YXZ buys: in the default XYZ the tilt drags
    // the yaw round with it and the strip ends up leaning across the screen.
    this.barRoot.rotation.order = 'YXZ';
    // Far side of the plate by a hair, so the fill reads as sitting on it.
    this.barFill.position.z = 0.012;
  }

  private prepare(mesh: THREE.InstancedMesh, scene: THREE.Scene): void {
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.count = 0;
    mesh.visible = false;
    // The batch sits at the origin and its instances are scattered across the
    // whole arena, so its own bounding sphere is meaningless for culling.
    mesh.frustumCulled = false;
    mesh.matrixAutoUpdate = false;
    scene.add(mesh);
  }

  /** Writes one frame's worth of zombies into the instance buffers. */
  public render(enemies: Enemy[]): void {
    let armCount = 0;
    let hpCount = 0;
    this.counts.fill(0);

    // Square to the camera, worked out once: the rig does not move between one
    // zombie and the next.
    this.barRoot.rotation.set(CAMERA_RIG.facingTilt(), CAMERA_RIG.facingYaw(), 0);

    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (!e.active) continue;

      const typeSlot = TYPE_SLOT[e.type] ?? 0;
      const body = this.bodies[typeSlot];
      const slot = this.counts[typeSlot];
      if (slot >= MAX_ENEMIES) continue;

      // Shuffling gait: the whole body rocks, arms paw forward out of phase.
      const gait = e.gait;
      this.root.position.copy(e.position);
      this.root.rotation.set(0, e.yaw, 0);
      this.root.scale.setScalar(e.renderScale);
      this.torso.rotation.z = gait * 0.09;
      this.torso.position.y = Math.abs(gait) * 0.05;

      // The swing, in the only channel that can carry it.
      //
      // Colour is already spoken for — the hit flash, a Burster's gas, a mark
      // — and with nine of them winding up at once a tenth tint would be
      // noise. The arms are the silhouette, so the arms are the tell: drawn
      // back and the body leaning away, then both thrown forward through the
      // player. It reads across a street because it changes the shape.
      const pose = e.swingPose;
      this.torso.rotation.x = -0.22 - pose * 0.3;
      this.leftArm.rotation.x = Math.PI / 2 - 0.2 + gait * 0.12 + pose * 1.05;
      this.rightArm.rotation.x = Math.PI / 2 - 0.1 - gait * 0.12 + pose * 1.05;

      this.root.updateMatrixWorld(true);

      // The body mesh sat at the origin of the body group, so that group's
      // world matrix is the body's world matrix.
      body.setMatrixAt(slot, this.torso.matrixWorld);
      this.counts[typeSlot] = slot + 1;

      const flash = e.flashing ? FLASH : e.hot ? HOT : e.mark ? MARKED : PLAIN;
      body.setColorAt(slot, flash);

      if (armCount + 2 <= MAX_ENEMIES * 2) {
        const p = PROFILES[e.type] ?? PROFILES.SHAMBLER;
        this.tintBuffer.setHex(p.flesh).multiply(flash);
        this.arms.setMatrixAt(armCount, this.leftArm.matrixWorld);
        this.arms.setColorAt(armCount, this.tintBuffer);
        this.arms.setMatrixAt(armCount + 1, this.rightArm.matrixWorld);
        this.arms.setColorAt(armCount + 1, this.tintBuffer);
        armCount += 2;
      }

      if (e.hpVisible && hpCount < MAX_ENEMIES) {
        // Rides above the body and takes its scale — a Butcher gets a Butcher-
        // sized strip — but keeps the camera's heading rather than the body's.
        const s = e.renderScale;
        this.barRoot.position.set(e.position.x, e.position.y + 2.15 * s, e.position.z);
        this.barRoot.scale.setScalar(s);
        this.barFill.scale.x = e.hpRatio;
        this.barFill.position.x = -(1.06 * (1 - e.hpRatio)) / 2;
        this.barRoot.updateMatrixWorld(true);

        this.hpBack.setMatrixAt(hpCount, this.barBack.matrixWorld);
        this.hpFill.setMatrixAt(hpCount, this.barFill.matrixWorld);
        hpCount++;
      }
    }

    for (let t = 0; t < this.bodies.length; t++) {
      this.commit(this.bodies[t], this.counts[t], true);
    }
    this.commit(this.arms, armCount, true);
    this.commit(this.hpBack, hpCount, false);
    this.commit(this.hpFill, hpCount, false);
  }

  private commit(mesh: THREE.InstancedMesh, count: number, colored: boolean): void {
    mesh.count = count;
    mesh.visible = count > 0;
    if (count === 0) return;
    mesh.instanceMatrix.needsUpdate = true;
    if (colored && mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  /** Drops everything off screen — used when the field is torn down. */
  public hideAll(): void {
    for (const mesh of this.bodies) this.commit(mesh, 0, true);
    this.commit(this.arms, 0, true);
    this.commit(this.hpBack, 0, false);
    this.commit(this.hpFill, 0, false);
  }
}
