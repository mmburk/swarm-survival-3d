import * as THREE from 'three';

const DEG = Math.PI / 180;

/**
 * Where the chase camera sits relative to whatever it is following, expressed
 * the way an isometric game actually thinks about it: a pitch, a yaw and a
 * distance rather than three hand-picked numbers.
 *
 * The rig is dimetric. Yaw is pinned at 45 degrees so the world reads as the
 * classic diamond, and pitch stays inside the 30-35.26 degree band — 35.26 is
 * the true-isometric angle, 30 is the one that gives clean 2:1 stepping, and
 * anything steeper than that starts looking like a top-down twin-stick game
 * instead. The projection itself is orthographic (see RenderPipeline), so
 * distance changes nothing about how big anything looks; it only decides how
 * far back the near plane and the fog start counting from.
 *
 * Both the player's own smoothing pass and CameraJuice read from here, so the
 * two can never disagree about the angle. Yaw is derived back out of the offset
 * rather than stored separately, which is what keeps screen-space input, the
 * minimap and the camera from ever drifting apart.
 */
export const CAMERA_RIG = {
  offset: new THREE.Vector3(),
  lookHeight: 0.5,
  /** Height of the orthographic frame at the play plane, in world units. */
  viewHeight: 28,
  /** Cached sin/cos of the camera yaw, for turning input into world motion. */
  yawSin: 0,
  yawCos: 1,

  set(x: number, y: number, z: number, lookHeight: number): void {
    this.offset.set(x, y, z);
    this.lookHeight = lookHeight;
    const flat = Math.hypot(x, z);
    this.yawSin = flat > 1e-4 ? x / flat : 0;
    this.yawCos = flat > 1e-4 ? z / flat : 1;
  },

  /**
   * Places the rig by angle. Pitch is measured up from the ground plane, yaw
   * clockwise from straight down the z axis.
   */
  setAngles(pitchDeg: number, yawDeg: number, distance: number, lookHeight: number): void {
    const flat = Math.cos(pitchDeg * DEG) * distance;
    this.set(
      Math.sin(yawDeg * DEG) * flat,
      Math.sin(pitchDeg * DEG) * distance,
      Math.cos(yawDeg * DEG) * flat,
      lookHeight
    );
  },

  /** Open ground. */
  useField(): void {
    this.setAngles(33, 45, 30, 0.5);
  },

  /**
   * The shelter. A shade steeper than the field: it is a room with things
   * standing in it, and the extra rake keeps the far wall and the joists from
   * eating the top of the frame.
   */
  useShelter(): void {
    this.setAngles(38, 45, 30, 0.9);
  },

  /**
   * Rotates a screen-space input vector into world space, so "up" on the stick
   * is always away from the camera no matter which way the rig is swung.
   */
  toWorld(x: number, z: number, out: THREE.Vector2): THREE.Vector2 {
    return out.set(x * this.yawCos + z * this.yawSin, -x * this.yawSin + z * this.yawCos);
  },

  /**
   * The reverse trip: a world-space offset flattened onto the screen axes.
   * x comes out as screen right, y as screen *down*, which is what canvas
   * overlays like the minimap want.
   */
  toScreen(x: number, z: number, out: THREE.Vector2): THREE.Vector2 {
    return out.set(x * this.yawCos - z * this.yawSin, x * this.yawSin + z * this.yawCos);
  }
};

CAMERA_RIG.useField();
