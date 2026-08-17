import * as THREE from 'three';
import { HEX } from '../theme/Palette';
import { ArcadePhysics } from '../physics/ArcadePhysics';
import type { Player } from './Player';

export type StationId = 'RACK' | 'BENCH' | 'RADIO' | 'BOARD' | 'DOOR' | 'DOG';

export interface Station {
  id: StationId;
  position: THREE.Vector3;
  /** How close you have to stand before the prompt appears. */
  radius: number;
  label: string;
  hint: string;
}

interface Furniture {
  x: number;
  z: number;
  radius: number;
}

const HALF_X = 14.5;
const HALF_Z = 12.0;

/**
 * The room is a box with two of its walls missing.
 *
 * The camera looks in over the south-east corner, so an east wall and a south
 * wall would stand directly between it and the floor the player walks on. The
 * old fix was to build them anyway and hold everyone well back from them, which
 * cost about three metres of room on each side. This is the fix every fixed
 * camera isometric game actually uses: those two walls are simply never built.
 * The player still cannot leave — the boundary below is enforced in code, not
 * in concrete — and a low footing runs along each open edge so the floor reads
 * as ending at a wall line rather than being torn off.
 *
 * The consequence to remember: this only works because the rig yaw is pinned at
 * 45 degrees. Swing the camera round and the missing walls are in shot.
 */

/** How far the floor slides under the two walls that are still modelled. */
const FAR_OVERHANG = 2.0;
/** How far it runs past the open edges, to carry the footing. */
const NEAR_LIP = 0.6;

/** Half-extents of the floor the player is actually allowed to stand on. */
const WALK_X = HALF_X - 0.7;
const WALK_Z = HALF_Z - 0.7;

/**
 * ROOK'S MOODS.
 *
 * `STAY` is his default: this is his house, and he is in it. `FOLLOW` is you
 * having asked him to come along, and he holds it until you ask him not to.
 * `GREET` is the few seconds after you come down the stairs, and it always
 * falls back into whichever of the other two he was in when you left.
 */
export type DogMood = 'GREET' | 'FOLLOW' | 'STAY';

/**
 * His bed, in the warm corner by the stove, next to his bowl.
 *
 * This is deliberately across the room from where the player lands coming down
 * the stairs. It used to be two metres from that spot, which meant he was
 * already standing on top of you the moment the room faded in and there was no
 * room left for him to come and meet you in.
 */
const DOG_BED = new THREE.Vector3(-9.2, 0, 8.6);
/** He is stopped by the furniture now, same as you are. */
const DOG_RADIUS = 0.38;
/** He gets up to follow past the first, and sits down again inside the second. */
const DOG_FOLLOW_START = 4.2;
const DOG_FOLLOW_STOP = 2.4;
/** Close enough for the hello to land and the greeting to end. */
const DOG_GREET_REACH = 2.6;

/**
 * THE SHELTER — a boarded-up basement under a hardware store.
 *
 * This is the hub the whole loop returns to: you pick a gun off the rack,
 * spend scrap at the bench, decide how bad you want tonight to be on the
 * radio, pet the dog, and walk up the stairs. Nothing in here is hostile and
 * nothing in here glows.
 */
export class Shelter {
  public group: THREE.Group;
  public active: boolean = false;

  public stations: Station[] = [
    { id: 'RACK',  position: new THREE.Vector3(-10.5, 0, -6.0), radius: 2.6, label: 'Weapon Rack',   hint: 'Choose what you carry tonight' },
    { id: 'BENCH', position: new THREE.Vector3(10.5, 0, -6.0),  radius: 2.6, label: 'Workbench',     hint: 'Spend scrap on permanent work' },
    { id: 'RADIO', position: new THREE.Vector3(-10.5, 0, 4.5),  radius: 2.6, label: 'Radio Set',     hint: 'Listen to how bad it is out there' },
    { id: 'BOARD', position: new THREE.Vector3(10.5, 0, 4.5),   radius: 2.6, label: 'Pin Board',     hint: 'Records, kill tallies, what you know' },
    { id: 'DOOR',  position: new THREE.Vector3(0, 0, -10.0),    radius: 2.8, label: 'Cellar Stairs', hint: 'Go out' },
    // Rook moves, so this position is only a starting point — `stationAt`
    // tracks the dog himself. The hint is rewritten as his mood changes.
    { id: 'DOG',   position: DOG_BED.clone(),                   radius: 2.4, label: 'Rook',          hint: 'Say goodbye to the dog' }
  ];

  private furniture: Furniture[] = [];
  private lamps: Array<{ light: THREE.PointLight; base: number; seed: number }> = [];

  private dog!: THREE.Group;
  private dogTail!: THREE.Mesh;
  private dogTarget: THREE.Vector3 = DOG_BED.clone();
  /** The spot `STAY` holds him to. Always his bed — that is the whole point. */
  private dogAnchor: THREE.Vector3 = DOG_BED.clone();
  private dogMood: DogMood = 'STAY';
  /** What he goes back to once he has finished saying hello. */
  private dogMoodAfterGreet: DogMood = 'STAY';
  private dogIdleTimer: number = 0;
  private dogWagTimer: number = 0;
  private dogStation!: Station;

  private rackGuns: THREE.Group[] = [];
  private benchWheel!: THREE.Mesh;
  private radioDial!: THREE.Mesh;
  private time: number = 0;

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    this.group.visible = false;

    this.buildShell();
    this.buildLighting();
    this.buildWeaponRack();
    this.buildWorkbench();
    this.buildRadioDesk();
    this.buildPinBoard();
    this.buildStairs();
    this.buildLivingSpace();
    this.buildDog();

    this.dogStation = this.stations.find((s) => s.id === 'DOG')!;
    this.syncDogHint();

    scene.add(this.group);
  }

  // ------------------------------------------------------------------ shell

  private concrete(shade = 0x42423a): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({ color: shade, roughness: 0.97, metalness: 0.0, flatShading: true });
  }

  private wood(shade = 0x51402a): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({ color: shade, roughness: 0.95, metalness: 0.0, flatShading: true });
  }

  private metal(shade = 0x4a4d44): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({ color: shade, roughness: 0.62, metalness: 0.65, flatShading: true });
  }

  private buildShell(): void {
    // Poured concrete floor with a painted-out loading stripe.
    const floorCanvas = document.createElement('canvas');
    floorCanvas.width = floorCanvas.height = 256;
    const fx = floorCanvas.getContext('2d')!;
    // Near-neutral detail map: it multiplies the material colour, so keeping
    // it light is what stops the floor rendering as a black hole.
    fx.fillStyle = '#c0c0b6';
    fx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 700; i++) {
      const s = 150 + Math.floor(Math.random() * 50);
      fx.fillStyle = `rgba(${s + 8},${s + 6},${s},0.5)`;
      fx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
    }
    fx.strokeStyle = 'rgba(84,82,70,0.45)';
    fx.lineWidth = 2;
    for (let i = 0; i <= 256; i += 64) {
      fx.beginPath(); fx.moveTo(i, 0); fx.lineTo(i, 256); fx.stroke();
      fx.beginPath(); fx.moveTo(0, i); fx.lineTo(256, i); fx.stroke();
    }
    const floorTex = new THREE.CanvasTexture(floorCanvas);
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(7, 6);

    // The slab is deliberately off-centre: it runs under the north and west
    // walls the way a real floor would, and stops just past the open edges,
    // where there is nothing left to hide the seam behind.
    const floorW = HALF_X * 2 + FAR_OVERHANG + NEAR_LIP;
    const floorD = HALF_Z * 2 + FAR_OVERHANG + NEAR_LIP;
    const floorCX = (NEAR_LIP - FAR_OVERHANG) / 2;
    const floorCZ = (NEAR_LIP - FAR_OVERHANG) / 2;

    const floorGeo = new THREE.PlaneGeometry(floorW, floorD);
    floorGeo.rotateX(-Math.PI / 2);
    const floor = new THREE.Mesh(floorGeo, new THREE.MeshStandardMaterial({
      color: 0x6e6d5f, map: floorTex, roughness: 1.0, metalness: 0.0
    }));
    floor.position.set(floorCX, 0, floorCZ);
    floor.receiveShadow = true;
    this.group.add(floor);

    // Walls — north and west only. The east and south runs are the ones the
    // camera would be looking through, so they do not exist.
    const wallMat = this.concrete(0x57564b);
    const wallH = 7;
    const mkWall = (w: number, d: number, x: number, z: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, wallH, d), wallMat);
      m.position.set(x, wallH / 2, z);
      m.receiveShadow = true;
      this.group.add(m);
      return m;
    };
    mkWall(HALF_X * 2 + 3, 1, 0, -HALF_Z - 1.5);
    mkWall(1, HALF_Z * 2 + 3, -HALF_X - 1.5, 0);

    // What is left of the two that went: a footing about ankle high, sitting on
    // the line the player is stopped at. It draws the edge of the room without
    // ever rising far enough to cover anything, and stops the slab from just
    // ending in mid air.
    const footMat = this.concrete(0x3c3b33);
    const footH = 0.34;
    const mkFooting = (w: number, d: number, x: number, z: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, footH, d), footMat);
      m.position.set(x, footH / 2, z);
      m.receiveShadow = true;
      this.group.add(m);
    };
    mkFooting(0.6, floorD, HALF_X + 0.3, floorCZ);
    mkFooting(floorW, 0.6, floorCX, HALF_Z + 0.3);

    // Exposed ceiling joists. A raked camera looks *through* the ceiling on its
    // way to the floor, so a full grid of these lay across the room as a set of
    // bars. Only the runs against the two far walls are kept: they sit at the
    // top and left edges of the frame, they make the space read as "under
    // something", and their sightline to the lens never crosses the floor the
    // player walks on.
    const joistMat = this.wood(0x3e3020);
    for (const z of [-12.9, -11.5]) {
      const joist = new THREE.Mesh(new THREE.BoxGeometry(HALF_X * 2 + 2, 0.32, 0.42), joistMat);
      joist.position.set(0, 6.6, z);
      this.group.add(joist);
    }
    for (let i = -3; i <= 2; i++) {
      // Stopped short of the walking area entirely: a beam east of where the
      // player can stand would cross them on its way to the camera.
      const stub = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.32, 0.42), joistMat);
      stub.position.set(-HALF_X - 1.1, 6.6, i * 3.0);
      this.group.add(stub);
    }

    // The lamps used to hang off the joists that are no longer there, so they
    // get their own strung cable to hang from.
    for (const z of [-6, 4.5]) {
      const cable = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.05, HALF_X * 2 + 2, 4),
        this.metal(0x25241e)
      );
      cable.rotation.z = Math.PI / 2;
      cable.position.set(0, 6.62, z);
      this.group.add(cable);
    }

    // Boarded-up windows high on the west wall. There used to be a matching set
    // on the east one; with that wall gone they would have been three window
    // frames hanging in the dark.
    for (let i = -1; i <= 1; i++) {
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.5, 2.2), this.concrete(0x25251f));
      frame.position.set(-(HALF_X + 1.0), 5.0, i * 6.0);
      this.group.add(frame);
      for (let b = 0; b < 3; b++) {
        const board = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.34, 2.6), this.wood(0x5a4830));
        board.position.set(-(HALF_X + 0.8), 4.6 + b * 0.48, i * 6.0);
        board.rotation.x = (b - 1) * 0.06;
        this.group.add(board);
      }
    }
  }

  private buildLighting(): void {
    // Four caged work lamps on the joists plus a warm fill. Everything in the
    // shelter is lit by these, which is why it is orange and dim.
    const spots: Array<[number, number, number]> = [
      [-9, 5.6, -6], [9, 5.6, -6], [-9, 5.6, 4.5], [9, 5.6, 4.5]
    ];

    this.lamps = [];
    for (const [x, y, z] of spots) {
      const light = new THREE.PointLight(0xe0a557, 130, 26, 2);
      light.position.set(x, y, z);
      this.group.add(light);
      this.lamps.push({ light, base: 130, seed: Math.random() * 10 });

      const cage = new THREE.Mesh(
        new THREE.SphereGeometry(0.28, 8, 6),
        new THREE.MeshStandardMaterial({ color: 0xffd9a0, emissive: 0x8a6020, emissiveIntensity: 1.0, roughness: 0.4 })
      );
      cage.position.set(x, y, z);
      this.group.add(cage);

      const cord = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.02, 0.9, 4),
        this.metal(0x201f1a)
      );
      cord.position.set(x, y + 0.6, z);
      this.group.add(cord);
    }

    const fill = new THREE.HemisphereLight(0x8a6a42, 0x2a2820, 2.0);
    this.group.add(fill);

    // The stove in the corner, the only other light source.
    const stoveGlow = new THREE.PointLight(0xd2622a, 42, 11, 2);
    stoveGlow.position.set(-11.5, 1.0, 9.0);
    this.group.add(stoveGlow);
    this.lamps.push({ light: stoveGlow, base: 42, seed: 4.2 });
  }

  // --------------------------------------------------------------- stations

  private buildWeaponRack(): void {
    const p = this.stations[0].position;

    const backboard = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3.6, 6.2), this.wood(0x4a3a25));
    backboard.position.set(p.x - 1.5, 2.4, p.z);
    this.group.add(backboard);

    const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.18, 6.0), this.wood(0x584631));
    shelf.position.set(p.x - 0.7, 0.95, p.z);
    shelf.receiveShadow = true;
    this.group.add(shelf);
    // Three overlapping stops rather than one, so the whole length of the
    // backboard is solid. A single circle left the ends open, and the camera
    // now sits east of the rack: anyone who squeezed round the back of it went
    // behind the planks and out of sight.
    for (const dz of [-2.4, 0, 2.4]) {
      this.furniture.push({ x: p.x - 0.9, z: p.z + dz, radius: 1.5 });
    }

    // Five silhouettes on pegs — one per weapon in the armoury.
    const gunmetal = this.metal(0x2c2e26);
    const wood = this.wood(0x4a3220);
    for (let i = 0; i < 5; i++) {
      const g = new THREE.Group();
      g.position.set(p.x - 1.2, 3.4 - i * 0.62, p.z - 2.4 + i * 1.2);
      g.rotation.y = Math.PI / 2;

      const body = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.9 + i * 0.12), gunmetal);
      g.add(body);
      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.18, 0.34), wood);
      stock.position.z = 0.55 + i * 0.06;
      g.add(stock);

      this.rackGuns.push(g);
      this.group.add(g);
    }

    this.addStencil(new THREE.Vector3(p.x - 1.3, 4.6, p.z), 'ARMS', Math.PI / 2);
  }

  private buildWorkbench(): void {
    const p = this.stations[1].position;

    const top = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.22, 5.4), this.wood(0x5c4830));
    top.position.set(p.x + 0.6, 1.05, p.z);
    top.castShadow = true;
    top.receiveShadow = true;
    this.group.add(top);
    this.furniture.push({ x: p.x + 0.7, z: p.z, radius: 1.6 });

    for (const dz of [-2.2, 2.2]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.0, 0.22), this.metal(0x3a3d34));
      leg.position.set(p.x + 0.6, 0.5, p.z + dz);
      this.group.add(leg);
    }

    // Vice, grinder wheel, scattered parts.
    const vice = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.42, 0.6), this.metal(0x5a4030));
    vice.position.set(p.x + 0.4, 1.36, p.z - 1.9);
    this.group.add(vice);

    this.benchWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.16, 14), this.metal(0x6a6a5c));
    this.benchWheel.rotation.z = Math.PI / 2;
    this.benchWheel.position.set(p.x + 0.5, 1.5, p.z + 1.6);
    this.group.add(this.benchWheel);

    for (let i = 0; i < 7; i++) {
      const part = new THREE.Mesh(
        new THREE.BoxGeometry(0.16 + Math.random() * 0.2, 0.12, 0.16 + Math.random() * 0.2),
        this.metal(0x6b6250)
      );
      part.position.set(p.x + 0.2 + Math.random() * 0.8, 1.22, p.z - 1 + Math.random() * 2.6);
      part.rotation.y = Math.random() * Math.PI;
      this.group.add(part);
    }

    // Set back on the open east edge. There is no wall behind it any more, so
    // it doubles as the thing that closes the room off on this side — and it is
    // still on the camera's side of the bench top, which is where it has to be.
    const pegboard = new THREE.Mesh(new THREE.BoxGeometry(0.24, 3.0, 5.0), this.wood(0x453722));
    pegboard.position.set(p.x + 2.7, 3.0, p.z);
    this.group.add(pegboard);

    // Solid, in three overlapping stops along its length. Since the east wall
    // came down the player can reach further this way than the board stands,
    // and behind it is the one place in the room the camera cannot see.
    for (const dz of [-1.7, 0, 1.7]) {
      this.furniture.push({ x: p.x + 2.7, z: p.z + dz, radius: 1.1 });
    }

    // Painted on the pegboard rather than the wall above it, which is gone.
    this.addStencil(new THREE.Vector3(p.x + 2.55, 3.9, p.z), 'BENCH', -Math.PI / 2);
  }

  private buildRadioDesk(): void {
    const p = this.stations[2].position;

    const desk = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.2, 3.4), this.wood(0x4d3d28));
    desk.position.set(p.x - 0.7, 1.0, p.z);
    desk.castShadow = true;
    this.group.add(desk);
    this.furniture.push({ x: p.x - 0.7, z: p.z, radius: 1.4 });

    const set = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.7, 1.5), this.metal(0x4c5140));
    set.position.set(p.x - 0.7, 1.45, p.z);
    this.group.add(set);

    this.radioDial = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.16, 0.08, 12),
      new THREE.MeshStandardMaterial({ color: HEX.amber, emissive: 0x3a2a0a, roughness: 0.5 })
    );
    this.radioDial.rotation.x = Math.PI / 2;
    this.radioDial.position.set(p.x - 0.28, 1.55, p.z - 0.4);
    this.group.add(this.radioDial);

    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 3.2, 4), this.metal(0x6a6d60));
    antenna.position.set(p.x - 0.7, 3.4, p.z + 1.0);
    antenna.rotation.z = 0.16;
    this.group.add(antenna);

    const chair = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.14, 0.7), this.wood(0x53422c));
    chair.position.set(p.x + 0.9, 0.72, p.z);
    this.group.add(chair);

    this.addStencil(new THREE.Vector3(p.x - 1.3, 4.4, p.z), 'COMMS', Math.PI / 2);
  }

  private buildPinBoard(): void {
    const p = this.stations[3].position;

    // Same story as the pegboard: pushed back towards the wall so it never
    // stands between the camera and the floor you read it from.
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.22, 3.2, 4.6), this.wood(0x6b5a3c));
    board.position.set(p.x + 3.1, 3.2, p.z);
    this.group.add(board);

    // Same as the pegboard: stopped off so nobody walks round the back of it
    // into the blind strip along the open edge.
    for (const dz of [-1.5, 0, 1.5]) {
      this.furniture.push({ x: p.x + 3.1, z: p.z + dz, radius: 1.1 });
    }

    // Notes and photographs pinned all over it — on both faces, because the
    // camera passes over this end of the room and sees the board from whichever
    // side the player happens to put it on.
    for (const face of [-1, 1]) {
      for (let i = 0; i < 16; i++) {
        const note = new THREE.Mesh(
          new THREE.PlaneGeometry(0.4 + Math.random() * 0.36, 0.5 + Math.random() * 0.32),
          new THREE.MeshStandardMaterial({
            color: [0xd9d2ba, 0xc7bb96, 0xb9ae8e][i % 3],
            roughness: 1.0,
            side: THREE.DoubleSide
          })
        );
        note.position.set(p.x + 3.1 + face * 0.14, 2.1 + Math.random() * 2.1, p.z - 1.9 + Math.random() * 3.8);
        note.rotation.set(0, face * Math.PI / 2, (Math.random() - 0.5) * 0.3);
        this.group.add(note);
      }

      // Red string between two of them, because of course there is.
      const string = new THREE.Mesh(
        new THREE.CylinderGeometry(0.012, 0.012, 3.0, 3),
        new THREE.MeshStandardMaterial({ color: 0x8e2323, roughness: 1.0 })
      );
      string.position.set(p.x + 3.1 + face * 0.16, 3.2, p.z);
      string.rotation.set(0.4, 0, Math.PI / 2);
      this.group.add(string);
    }

    const crate = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.0, 1.1), this.wood(0x54432c));
    crate.position.set(p.x + 0.4, 0.5, p.z + 1.6);
    this.group.add(crate);
    this.furniture.push({ x: p.x + 0.4, z: p.z + 1.6, radius: 0.9 });

    // Across the top of the board itself and facing back into the room, where
    // you read it from — the camera is over your shoulder for that. It used to
    // be higher up, on an east wall that is no longer built.
    this.addStencil(new THREE.Vector3(p.x + 2.88, 4.4, p.z), 'RECORDS', -Math.PI / 2);
  }

  private buildStairs(): void {
    const p = this.stations[4].position;

    // Concrete steps climbing into the dark. Kept short so they stop before
    // the north wall rather than clipping through it.
    for (let i = 0; i < 4; i++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.34, 0.75), this.concrete(0x4d4d43));
      step.position.set(p.x, 0.17 + i * 0.34, p.z - 0.5 - i * 0.75);
      step.receiveShadow = true;
      this.group.add(step);
    }

    // Steel bulkhead door at the top, cracked open onto daylight.
    const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(5.2, 4.4, 0.4), this.metal(0x3f4239));
    doorFrame.position.set(p.x, 2.4, p.z - 3.5);
    this.group.add(doorFrame);

    const gap = new THREE.Mesh(
      new THREE.PlaneGeometry(1.4, 3.0),
      new THREE.MeshBasicMaterial({ color: 0x8e9384 })
    );
    gap.position.set(p.x + 0.9, 2.3, p.z - 3.28);
    this.group.add(gap);

    const daylight = new THREE.PointLight(0xa8b4a2, 26, 14, 2);
    daylight.position.set(p.x + 0.8, 2.6, p.z - 2.6);
    this.group.add(daylight);

    // Sandbags either side of the stairwell.
    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const bag = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.4, 0.6), this.wood(0x6b6248));
        bag.position.set(p.x + side * 2.9, 0.2 + Math.floor(i / 2) * 0.4, p.z - 0.4 + (i % 2) * 0.65);
        this.group.add(bag);
      }
      this.furniture.push({ x: p.x + side * 2.9, z: p.z, radius: 1.0 });
    }

    // On the room side of the north wall — out at the door frame it was sealed
    // inside the concrete and never drew.
    this.addStencil(new THREE.Vector3(p.x, 5.0, p.z - 2.6), 'OUT', 0);
  }

  /** Table, bunk, stove, shelving — the parts that are just somebody's home. */
  private buildLivingSpace(): void {
    const table = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.2, 2.0), this.wood(0x5c4830));
    table.position.set(0, 1.0, 0.5);
    table.castShadow = true;
    this.group.add(table);
    this.furniture.push({ x: 0, z: 0.5, radius: 1.9 });

    for (const [dx, dz] of [[-1.4, -0.8], [1.4, -0.8], [-1.4, 0.8], [1.4, 0.8]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.0, 0.16), this.wood(0x46351f));
      leg.position.set(dx, 0.5, 0.5 + dz);
      this.group.add(leg);
    }

    // City map with pins, held down by a mug.
    const map = new THREE.Mesh(
      new THREE.PlaneGeometry(2.4, 1.5),
      new THREE.MeshStandardMaterial({ color: 0xbfb391, roughness: 1.0 })
    );
    map.rotation.x = -Math.PI / 2;
    map.position.set(0, 1.11, 0.5);
    this.group.add(map);

    for (let i = 0; i < 6; i++) {
      const pin = new THREE.Mesh(
        new THREE.SphereGeometry(0.06, 6, 5),
        new THREE.MeshStandardMaterial({ color: i < 3 ? 0x8e2323 : 0x4b6b3a, roughness: 0.6 })
      );
      pin.position.set(-0.9 + Math.random() * 1.8, 1.16, 0.0 + Math.random() * 1.0);
      this.group.add(pin);
    }

    const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.11, 0.22, 8), this.concrete(0x8a8470));
    mug.position.set(0.9, 1.22, 0.1);
    this.group.add(mug);

    // Bunk.
    const bunk = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.3, 4.2), this.metal(0x44483d));
    bunk.position.set(-11.5, 0.75, -0.5);
    this.group.add(bunk);
    const mattress = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.3, 4.0), this.wood(0x6a5f45));
    mattress.position.set(-11.5, 1.0, -0.5);
    this.group.add(mattress);
    const blanket = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.16, 2.2), new THREE.MeshStandardMaterial({ color: 0x5d4535, roughness: 1.0 }));
    blanket.position.set(-11.5, 1.16, 0.4);
    this.group.add(blanket);
    this.furniture.push({ x: -11.5, z: -0.5, radius: 1.8 });

    // Wood stove with a flue up through the joists.
    const stove = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.3, 1.2), this.metal(0x33352c));
    stove.position.set(-11.8, 0.65, 9.0);
    this.group.add(stove);
    const flue = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 5.4, 8), this.metal(0x3d3f36));
    flue.position.set(-11.8, 3.9, 9.0);
    this.group.add(flue);
    const embers = new THREE.Mesh(
      new THREE.PlaneGeometry(0.6, 0.45),
      new THREE.MeshBasicMaterial({ color: 0xc2551f })
    );
    embers.position.set(-11.8, 0.6, 8.38);
    this.group.add(embers);
    this.furniture.push({ x: -11.8, z: 9.0, radius: 1.2 });

    // Supply shelving along the south wall.
    for (let s = 0; s < 3; s++) {
      const rack = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.14, 1.0), this.metal(0x4a4d42));
      rack.position.set(5.5, 0.9 + s * 1.1, 10.6);
      this.group.add(rack);

      for (let c = 0; c < 5; c++) {
        const can = new THREE.Mesh(
          new THREE.CylinderGeometry(0.16, 0.16, 0.34, 8),
          this.metal([0x7a6a4a, 0x6b5f52, 0x5f6a52][c % 3])
        );
        can.position.set(4.2 + c * 0.62, 1.14 + s * 1.1, 10.6 + (Math.random() - 0.5) * 0.3);
        this.group.add(can);
      }
    }
    this.furniture.push({ x: 5.5, z: 10.6, radius: 2.0 });

    // Water barrels.
    for (let i = 0; i < 3; i++) {
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.4, 10), this.metal(0x4a5548));
      barrel.position.set(12.0, 0.7, -10.0 + i * 1.4);
      this.group.add(barrel);
      this.furniture.push({ x: 12.0, z: -10.0 + i * 1.4, radius: 0.7 });
    }
  }

  /**
   * Rook. He was somebody's dog before. Now he sleeps by the stove, comes to
   * the bottom of the stairs when he hears you on them, and will not go up.
   *
   * He has two settings and you pick between them by petting him: stay on his
   * bed, or come round the shelter with you. He starts on the bed, because it
   * is his house.
   */
  private buildDog(): void {
    this.dog = new THREE.Group();
    this.dog.position.copy(DOG_BED);

    const fur = new THREE.MeshStandardMaterial({ color: 0x6b5a44, roughness: 0.95, flatShading: true });
    const furDark = new THREE.MeshStandardMaterial({ color: 0x4a3d2c, roughness: 0.95, flatShading: true });

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.42, 1.05), fur);
    body.position.y = 0.58;
    body.castShadow = true;
    this.dog.add(body);

    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.44, 0.4), fur);
    chest.position.set(0, 0.6, -0.42);
    this.dog.add(chest);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.34, 0.42), fur);
    head.position.set(0, 0.86, -0.72);
    this.dog.add(head);

    const snout = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.18, 0.26), furDark);
    snout.position.set(0, 0.79, -0.98);
    this.dog.add(snout);

    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.22, 0.06), furDark);
      ear.position.set(side * 0.13, 1.06, -0.7);
      ear.rotation.z = side * 0.2;
      this.dog.add(ear);
    }

    for (const [dx, dz] of [[-0.17, -0.34], [0.17, -0.34], [-0.17, 0.36], [0.17, 0.36]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.42, 0.14), furDark);
      leg.position.set(dx, 0.21, dz);
      this.dog.add(leg);
    }

    this.dogTail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.44), fur);
    this.dogTail.position.set(0, 0.72, 0.66);
    this.dogTail.rotation.x = -0.5;
    this.dog.add(this.dogTail);

    // His corner: a folded sack he sleeps on and a tin bowl beside it. No
    // collision on either — he is meant to stand on the one and eat from the
    // other, and they are both ankle high.
    const pad = new THREE.Mesh(
      new THREE.BoxGeometry(2.0, 0.12, 1.5),
      new THREE.MeshStandardMaterial({ color: 0x4f4433, roughness: 1.0, flatShading: true })
    );
    pad.position.set(DOG_BED.x, 0.06, DOG_BED.z);
    pad.rotation.y = 0.18;
    pad.receiveShadow = true;
    this.group.add(pad);

    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.2, 0.14, 10), this.metal(0x6a6d5f));
    bowl.position.set(DOG_BED.x + 1.5, 0.07, DOG_BED.z - 0.7);
    this.group.add(bowl);

    this.group.add(this.dog);
  }

  /** Spray-painted lettering on the walls, drawn to a canvas plane. */
  private addStencil(pos: THREE.Vector3, text: string, rotY: number): void {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, 256, 64);
    ctx.fillStyle = 'rgba(214, 198, 158, 0.5)';
    ctx.font = 'bold 44px "Arial Narrow", Impact, sans-serif';
    ctx.textAlign = 'center';
    ctx.letterSpacing = '6px';
    ctx.fillText(text, 128, 46);

    const tex = new THREE.CanvasTexture(canvas);
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(2.6, 0.65),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.7 })
    );
    mesh.position.copy(pos);
    mesh.rotation.y = rotY;
    this.group.add(mesh);
  }

  // ------------------------------------------------------------------ logic

  public activate(): void {
    this.active = true;
    this.group.visible = true;

    // He waited on his bed, and he gets up the moment the door goes. Whatever
    // you last told him to do resumes once he has said hello — the greeting is
    // never skipped, because the old code dropped you into the room two metres
    // from a dog that then walked off without looking at you.
    this.dog.position.copy(DOG_BED);
    this.dogTarget.copy(DOG_BED);
    this.dogMoodAfterGreet = this.dogMood === 'GREET' ? 'STAY' : this.dogMood;
    this.dogMood = 'GREET';
    this.dogIdleTimer = 0;
    this.dogWagTimer = 0;
    this.syncDogHint();
  }

  public deactivate(): void {
    this.active = false;
    this.group.visible = false;
  }

  /**
   * Keeps the player inside the room and out of the furniture. Two of those
   * four lines have no wall standing on them — this is the only thing holding
   * the player in on the east and south sides.
   */
  public constrain(player: Player): void {
    for (const f of this.furniture) {
      ArcadePhysics.resolveSolidObstacle(player.position, player.radius, f);
    }
    player.clampToBounds(-HALF_X, WALK_X, -HALF_Z, WALK_Z);
  }

  /** Nearest station the player is standing in, or null. */
  public stationAt(playerPos: THREE.Vector3): Station | null {
    let best: Station | null = null;
    let bestDist = Infinity;

    for (const s of this.stations) {
      // Rook is the only station that moves, so track him rather than his bowl.
      const at = s.id === 'DOG' ? this.dog.position : s.position;
      const dx = playerPos.x - at.x;
      const dz = playerPos.z - at.z;
      const d2 = dx * dx + dz * dz;
      if (d2 <= s.radius * s.radius && d2 < bestDist) {
        bestDist = d2;
        best = s;
      }
    }
    return best;
  }

  public get dogPosition(): THREE.Vector3 {
    return this.dog.position;
  }

  public get dogMoodNow(): DogMood {
    return this.dogMood;
  }

  /**
   * Petting him is the toggle: it either invites him along or sends him back
   * to his bed. Returns what he settled on so the caller can say so.
   *
   * This used to poke the wander timer, which — because you are inside his
   * "too close to follow" radius when you are close enough to pet him — meant
   * the one thing petting the dog reliably did was make him walk away.
   */
  public petDog(): DogMood {
    this.dogWagTimer = 2.0;
    this.dogMood = this.dogMood === 'FOLLOW' ? 'STAY' : 'FOLLOW';
    this.dogMoodAfterGreet = this.dogMood;
    this.dogAnchor.copy(DOG_BED);
    this.dogIdleTimer = 0;
    this.syncDogHint();
    return this.dogMood;
  }

  private syncDogHint(): void {
    this.dogStation.hint = this.dogMood === 'FOLLOW'
      ? 'Send him back to his bed'
      : 'Have him come round with you';
  }

  public update(delta: number, playerPos?: THREE.Vector3): void {
    if (!this.active) return;
    this.time += delta;

    // Lamp flicker: two out-of-phase sines so it never looks like a loop.
    for (const l of this.lamps) {
      l.light.intensity = l.base * (0.9 + Math.sin(this.time * 7 + l.seed) * 0.05 + Math.sin(this.time * 19 + l.seed * 2) * 0.04);
    }

    this.benchWheel.rotation.x += delta * 0.4;
    this.radioDial.rotation.y += delta * 0.6;

    for (let i = 0; i < this.rackGuns.length; i++) {
      this.rackGuns[i].rotation.z = Math.sin(this.time * 0.8 + i) * 0.012;
    }

    this.updateDog(delta, playerPos);
  }

  /** Picks a standing spot `gap` metres off the player, on the side he is already on. */
  private aimNear(playerPos: THREE.Vector3, gap: number): void {
    const ox = this.dog.position.x - playerPos.x;
    const oz = this.dog.position.z - playerPos.z;
    const len = Math.hypot(ox, oz) || 1;
    this.dogTarget.set(playerPos.x + (ox / len) * gap, 0, playerPos.z + (oz / len) * gap);
  }

  private updateDog(delta: number, playerPos?: THREE.Vector3): void {
    const pos = this.dog.position;
    if (this.dogWagTimer > 0) this.dogWagTimer -= delta;

    if (playerPos) {
      const toPlayer = Math.hypot(playerPos.x - pos.x, playerPos.z - pos.z);

      switch (this.dogMood) {
        case 'GREET':
          this.aimNear(playerPos, 1.4);
          if (toPlayer < DOG_GREET_REACH) {
            this.dogWagTimer = 2.4;
            this.dogMood = this.dogMoodAfterGreet;
            // He hangs about at your feet for a moment before he goes back to
            // whatever he was doing, rather than turning on his heel.
            this.dogTarget.set(pos.x, 0, pos.z);
            this.dogIdleTimer = 3.0;
          }
          break;

        case 'FOLLOW':
          // Two thresholds, not one: he gets up only once you have properly
          // pulled away, and he stops dead once he has caught up. A single
          // threshold in a room this size had him permanently mid-stride.
          if (toPlayer > DOG_FOLLOW_START) {
            this.aimNear(playerPos, 1.8);
          } else if (toPlayer < DOG_FOLLOW_STOP) {
            this.dogTarget.set(pos.x, 0, pos.z);
          }
          break;

        case 'STAY':
          // He holds his bed. The drift is him shifting on it, not wandering
          // off it — two metres is about the size of the dog.
          this.dogIdleTimer -= delta;
          if (this.dogIdleTimer <= 0) {
            this.dogIdleTimer = 4.0 + Math.random() * 5.0;
            this.dogTarget.set(
              this.dogAnchor.x + (Math.random() - 0.5) * 2.0,
              0,
              this.dogAnchor.z + (Math.random() - 0.5) * 2.0
            );
          }
          break;
      }

      this.dogTarget.x = THREE.MathUtils.clamp(this.dogTarget.x, -HALF_X + 2, WALK_X - 1);
      this.dogTarget.z = THREE.MathUtils.clamp(this.dogTarget.z, -HALF_Z + 2, WALK_Z - 1);
    }

    const dx = this.dogTarget.x - pos.x;
    const dz = this.dogTarget.z - pos.z;
    const dist = Math.hypot(dx, dz);
    const moving = dist > 0.35;

    if (moving) {
      const speed = Math.min(4.4, 1.6 + dist * 0.7);
      pos.x += (dx / dist) * speed * delta;
      pos.z += (dz / dist) * speed * delta;
      this.dog.rotation.y = Math.atan2(dx, dz) + Math.PI;
      pos.y = Math.abs(Math.sin(this.time * 12)) * 0.05;
    } else {
      pos.y = 0;
      // Stood still with you nearby, he watches you rather than the wall.
      if (playerPos) {
        const face = Math.atan2(playerPos.x - pos.x, playerPos.z - pos.z) + Math.PI;
        this.dog.rotation.y += THREE.MathUtils.clamp(
          ((face - this.dog.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI,
          -2.5 * delta, 2.5 * delta
        );
      }
    }

    // He is part of the room now: the table, the bunk and the stove stop him
    // the same way they stop you, and he cannot slip behind the boards into
    // the strip along the open edges that the camera cannot see.
    for (const f of this.furniture) {
      ArcadePhysics.resolveSolidObstacle(pos, DOG_RADIUS, f);
    }
    pos.x = THREE.MathUtils.clamp(pos.x, -HALF_X + 0.6, WALK_X);
    pos.z = THREE.MathUtils.clamp(pos.z, -HALF_Z + 0.6, WALK_Z);

    // Hard wag right after a fuss, a working wag while he trots, an idle sway
    // the rest of the time.
    const wag = this.dogWagTimer > 0 ? Math.sin(this.time * 22) * 0.9
      : moving ? Math.sin(this.time * 14) * 0.5
      : Math.sin(this.time * 6) * 0.25;
    this.dogTail.rotation.y = wag;
  }
}
