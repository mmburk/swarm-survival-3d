import * as THREE from 'three';
import { VirtualJoystick } from '../ui/VirtualJoystick';

export class InputManager {
  private keys: { [key: string]: boolean } = {};
  public mousePos: THREE.Vector2 = new THREE.Vector2();
  public aimPoint: THREE.Vector3 = new THREE.Vector3();
  public isMouseDown: boolean = false;
  public isRightMouseDown: boolean = false;
  public justDashed: boolean = false;
  public justFiredUlt: boolean = false;

  private raycaster: THREE.Raycaster = new THREE.Raycaster();
  private groundPlane: THREE.Plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.5);
  private camera: THREE.PerspectiveCamera | null = null;
  private virtualJoystick: VirtualJoystick;

  constructor() {
    this.virtualJoystick = new VirtualJoystick();

    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (e.code === 'Space') {
        this.justDashed = true;
      }
      if (e.code === 'KeyE') {
        this.justFiredUlt = true;
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });

    window.addEventListener('mousemove', (e) => {
      this.mousePos.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.mousePos.y = -(e.clientY / window.innerHeight) * 2 + 1;
    });

    window.addEventListener('mousedown', (e) => {
      if (e.button === 0) this.isMouseDown = true;
      if (e.button === 2) this.isRightMouseDown = true;
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.isMouseDown = false;
      if (e.button === 2) this.isRightMouseDown = false;
    });

    window.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  public setCamera(camera: THREE.PerspectiveCamera): void {
    this.camera = camera;
  }

  public update(): void {
    if (this.camera) {
      this.raycaster.setFromCamera(this.mousePos, this.camera);
      this.raycaster.ray.intersectPlane(this.groundPlane, this.aimPoint);
      this.aimPoint.y = 1.5;
    }
  }

  public getMoveVector(): { x: number; y: number } {
    let x = 0;
    let y = 0;

    if (this.keys['KeyW'] || this.keys['ArrowUp']) y -= 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) y += 1;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) x -= 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) x += 1;

    if (this.virtualJoystick.active) {
      x += this.virtualJoystick.moveVector.x;
      y += this.virtualJoystick.moveVector.y;
    }

    const len = Math.sqrt(x * x + y * y);
    if (len > 1.0) {
      x /= len;
      y /= len;
    }

    return { x, y };
  }

  public clearFrameState(): void {
    this.justDashed = false;
    this.justFiredUlt = false;
  }
}
