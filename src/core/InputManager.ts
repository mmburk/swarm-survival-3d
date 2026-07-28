import * as THREE from 'three';

export class InputManager {
  public moveVector: THREE.Vector2 = new THREE.Vector2();
  public isMouseDown: boolean = false;
  public isRightMouseDown: boolean = false;
  public justDashed: boolean = false;
  public justFiredUlt: boolean = false;
  public justToggledPause: boolean = false;
  public justRestarted: boolean = false;
  public justMuted: boolean = false;

  // Multi-Weapon Swap System (1, 2, 3 / Wheel)
  public selectedWeaponSlot: number = 1; // 1: Rifle, 2: Shotgun, 3: Grenade
  public justSwappedWeapon: boolean = false;

  public aimPoint: THREE.Vector3 = new THREE.Vector3();
  public onPointerLockExited: (() => void) | null = null;

  private keysPressed: { [key: string]: boolean } = {};
  private raycaster: THREE.Raycaster = new THREE.Raycaster();
  private groundPlane: THREE.Plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.5);
  private mousePos: THREE.Vector2 = new THREE.Vector2();
  private camera: THREE.Camera | null = null;

  constructor() {
    window.addEventListener('keydown', (e) => this.onKeyDown(e));
    window.addEventListener('keyup', (e) => this.onKeyUp(e));
    window.addEventListener('mousedown', (e) => this.onMouseDown(e));
    window.addEventListener('mouseup', (e) => this.onMouseUp(e));
    window.addEventListener('mousemove', (e) => this.onMouseMove(e));
    window.addEventListener('wheel', (e) => this.onWheel(e));
    window.addEventListener('contextmenu', (e) => e.preventDefault());

    document.addEventListener('pointerlockchange', () => {
      if (!document.pointerLockElement && this.onPointerLockExited) {
        this.onPointerLockExited();
      }
    });
  }

  public setCamera(camera: THREE.Camera): void {
    this.camera = camera;
  }

  private onWheel(e: WheelEvent): void {
    if (e.deltaY > 0) {
      this.selectedWeaponSlot = (this.selectedWeaponSlot % 3) + 1;
    } else if (e.deltaY < 0) {
      this.selectedWeaponSlot = this.selectedWeaponSlot === 1 ? 3 : this.selectedWeaponSlot - 1;
    }
    this.justSwappedWeapon = true;
  }

  private onKeyDown(e: KeyboardEvent): void {
    this.keysPressed[e.code] = true;

    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      e.preventDefault();
    }

    if (e.code === 'Digit1') { this.selectedWeaponSlot = 1; this.justSwappedWeapon = true; }
    if (e.code === 'Digit2') { this.selectedWeaponSlot = 2; this.justSwappedWeapon = true; }
    if (e.code === 'Digit3') { this.selectedWeaponSlot = 3; this.justSwappedWeapon = true; }

    if (e.code === 'Space' && !e.repeat) this.justDashed = true;
    if (e.code === 'KeyE' && !e.repeat) this.justFiredUlt = true;
    if ((e.code === 'Escape' || e.code === 'KeyP') && !e.repeat) this.justToggledPause = true;
    if (e.code === 'KeyR' && !e.repeat) this.justRestarted = true;
    if (e.code === 'KeyM' && !e.repeat) this.justMuted = true;
  }

  private onKeyUp(e: KeyboardEvent): void {
    this.keysPressed[e.code] = false;
  }

  private onMouseDown(e: MouseEvent): void {
    if (e.button === 0) this.isMouseDown = true;
    if (e.button === 2) this.isRightMouseDown = true;
  }

  private onMouseUp(e: MouseEvent): void {
    if (e.button === 0) this.isMouseDown = false;
    if (e.button === 2) this.isRightMouseDown = false;
  }

  private onMouseMove(e: MouseEvent): void {
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

    if (this.keysPressed['KeyW'] || this.keysPressed['ArrowUp']) this.moveVector.y -= 1;
    if (this.keysPressed['KeyS'] || this.keysPressed['ArrowDown']) this.moveVector.y += 1;
    if (this.keysPressed['KeyA'] || this.keysPressed['ArrowLeft']) this.moveVector.x -= 1;
    if (this.keysPressed['KeyD'] || this.keysPressed['ArrowRight']) this.moveVector.x += 1;

    if (this.moveVector.lengthSq() > 0) {
      this.moveVector.normalize();
    }
  }

  public getMoveVector(): THREE.Vector2 {
    return this.moveVector;
  }

  public clearFrameState(): void {
    this.justDashed = false;
    this.justFiredUlt = false;
    this.justToggledPause = false;
    this.justRestarted = false;
    this.justMuted = false;
    this.justSwappedWeapon = false;
  }
}
