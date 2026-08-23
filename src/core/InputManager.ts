import * as THREE from 'three';

/**
 * Keyboard + mouse state.
 *
 * `just*` flags are edge-triggered and cleared once per frame by
 * `clearFrameState()`, so consumers can read them from anywhere in the update
 * without worrying about ordering.
 */
export class InputManager {
  public moveVector: THREE.Vector2 = new THREE.Vector2();
  public keys = { w: false, a: false, s: false, d: false };

  public isMouseDown: boolean = false;
  public isRightMouseDown: boolean = false;

  public justDashed: boolean = false;
  public justFiredUlt: boolean = false;
  public justShoved: boolean = false;
  public justReloaded: boolean = false;
  public justInteracted: boolean = false;
  public justToggledPause: boolean = false;
  public justMuted: boolean = false;
  public justToggledCodex: boolean = false;
  /** Left click consumed as a single trigger pull, for non-automatic weapons. */
  public justClicked: boolean = false;

  public aimPoint: THREE.Vector3 = new THREE.Vector3();
  public rawMouseX: number = window.innerWidth / 2;
  public rawMouseY: number = window.innerHeight / 2;

  private keysPressed: { [key: string]: boolean } = {};
  private raycaster: THREE.Raycaster = new THREE.Raycaster();
  private groundPlane: THREE.Plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.5);
  private mousePos: THREE.Vector2 = new THREE.Vector2();
  private lastPauseToggleTime: number = 0;
  private camera: THREE.Camera | null = null;

  constructor() {
    window.addEventListener('keydown', (e) => this.onKeyDown(e));
    window.addEventListener('keyup', (e) => this.onKeyUp(e));
    window.addEventListener('mousedown', (e) => this.onMouseDown(e));
    window.addEventListener('mouseup', (e) => this.onMouseUp(e));
    window.addEventListener('mousemove', (e) => this.onMouseMove(e));
    window.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('blur', () => this.releaseAll());
  }

  public setCamera(camera: THREE.Camera): void {
    this.camera = camera;
  }

  /** Alt-tabbing used to leave the player sprinting into a wall forever. */
  private releaseAll(): void {
    this.keysPressed = {};
    this.keys.w = this.keys.a = this.keys.s = this.keys.d = false;
    this.isMouseDown = false;
    this.isRightMouseDown = false;
    this.moveVector.set(0, 0);
  }

  private onKeyDown(e: KeyboardEvent): void {
    const code = e.code;
    const key = e.key ? e.key.toLowerCase() : '';

    this.keysPressed[code] = true;
    if (key) this.keysPressed[key] = true;

    if (code === 'KeyW' || code === 'ArrowUp') this.keys.w = true;
    if (code === 'KeyA' || code === 'ArrowLeft') this.keys.a = true;
    if (code === 'KeyS' || code === 'ArrowDown') this.keys.s = true;
    if (code === 'KeyD' || code === 'ArrowRight') this.keys.d = true;

    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(code)) {
      e.preventDefault();
    }

    if (e.repeat) return;

    if (code === 'Space') this.justDashed = true;
    if (code === 'KeyE') this.justInteracted = true;
    if (code === 'KeyQ') this.justFiredUlt = true;
    if (code === 'KeyF') this.justShoved = true;
    if (code === 'KeyR') this.justReloaded = true;
    if (code === 'KeyM') this.justMuted = true;

    if (code === 'Tab') {
      e.preventDefault();
      this.justToggledCodex = true;
    }

    if (code === 'Escape' || code === 'KeyP') {
      const now = performance.now();
      if (now - this.lastPauseToggleTime > 250) {
        this.justToggledPause = true;
        this.lastPauseToggleTime = now;
      }
    }
  }

  private onKeyUp(e: KeyboardEvent): void {
    const code = e.code;
    const key = e.key ? e.key.toLowerCase() : '';

    this.keysPressed[code] = false;
    if (key) this.keysPressed[key] = false;

    if (code === 'KeyW' || code === 'ArrowUp') this.keys.w = false;
    if (code === 'KeyA' || code === 'ArrowLeft') this.keys.a = false;
    if (code === 'KeyS' || code === 'ArrowDown') this.keys.s = false;
    if (code === 'KeyD' || code === 'ArrowRight') this.keys.d = false;
  }

  private onMouseDown(e: MouseEvent): void {
    // Clicks that land on menu buttons must not also fire the gun underneath.
    const target = e.target as HTMLElement | null;
    if (target && target !== document.body && target.tagName !== 'CANVAS') return;

    if (e.button === 0) {
      this.isMouseDown = true;
      this.justClicked = true;
    }
    if (e.button === 2) this.isRightMouseDown = true;
  }

  private onMouseUp(e: MouseEvent): void {
    if (e.button === 0) this.isMouseDown = false;
    if (e.button === 2) this.isRightMouseDown = false;
  }

  private onMouseMove(e: MouseEvent): void {
    this.rawMouseX = e.clientX;
    this.rawMouseY = e.clientY;
    this.mousePos.x = (e.clientX / window.innerWidth) * 2 - 1;
    this.mousePos.y = -(e.clientY / window.innerHeight) * 2 + 1;
    this.updateAimRay();
  }

  private updateAimRay(): void {
    if (!this.camera) return;
    this.raycaster.setFromCamera(this.mousePos, this.camera);
    this.raycaster.ray.intersectPlane(this.groundPlane, this.aimPoint);
  }

  public update(): void {
    this.moveVector.set(0, 0);

    if (this.keys.w) this.moveVector.y -= 1;
    if (this.keys.s) this.moveVector.y += 1;
    if (this.keys.a) this.moveVector.x -= 1;
    if (this.keys.d) this.moveVector.x += 1;

    if (this.moveVector.lengthSq() > 0) this.moveVector.normalize();
  }

  public getMoveVector(): THREE.Vector2 {
    return this.moveVector;
  }

  public clearFrameState(): void {
    this.justDashed = false;
    this.justFiredUlt = false;
    this.justShoved = false;
    this.justReloaded = false;
    this.justInteracted = false;
    this.justToggledPause = false;
    this.justMuted = false;
    this.justToggledCodex = false;
    this.justClicked = false;
  }
}
