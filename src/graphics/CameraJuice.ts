import * as THREE from 'three';

export class CameraJuice {
  private trauma: number = 0;
  private camera: THREE.PerspectiveCamera;
  private shakeOffset: THREE.Vector3 = new THREE.Vector3();

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
  }

  public addTrauma(amount: number): void {
    // Clamp max trauma and limit shake duration window to under 150ms
    this.trauma = Math.min(0.5, this.trauma + amount * 0.5);
  }

  public update(delta: number, targetPos: THREE.Vector3): void {
    if (this.trauma > 0.001) {
      // Rapid decay to ensure camera shake completes under 150ms
      this.trauma = Math.max(0, this.trauma - delta * 4.5);

      const shake = this.trauma * this.trauma;
      this.shakeOffset.set(
        (Math.random() - 0.5) * shake * 1.2,
        (Math.random() - 0.5) * shake * 0.8,
        (Math.random() - 0.5) * shake * 1.2
      );

      this.camera.position.set(
        targetPos.x + this.shakeOffset.x,
        targetPos.y + 24 + this.shakeOffset.y,
        targetPos.z + 20 + this.shakeOffset.z
      );
    } else {
      this.trauma = 0;
      // Static smooth follow without matrix recalculation overhead
      this.camera.position.x = THREE.MathUtils.lerp(this.camera.position.x, targetPos.x, delta * 8);
      this.camera.position.y = THREE.MathUtils.lerp(this.camera.position.y, targetPos.y + 24, delta * 8);
      this.camera.position.z = THREE.MathUtils.lerp(this.camera.position.z, targetPos.z + 20, delta * 8);
    }

    this.camera.lookAt(targetPos.x, targetPos.y + 0.5, targetPos.z);
  }
}
