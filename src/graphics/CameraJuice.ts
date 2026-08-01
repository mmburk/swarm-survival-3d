import * as THREE from 'three';

export class CameraJuice {
  private trauma: number = 0;
  private camera: THREE.PerspectiveCamera;
  private shakeOffset: THREE.Vector3 = new THREE.Vector3();

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
  }

  public addTrauma(amount: number): void {
    // Trauma accumulates up to 1.0 for heavy impact feedback
    this.trauma = Math.min(1.0, this.trauma + amount);
  }

  public update(delta: number, targetPos: THREE.Vector3): void {
    const camOffsetZ = 18;
    const camOffsetY = 20;

    if (this.trauma > 0.001) {
      // Quadratic decay curve for natural weight feeling
      this.trauma = Math.max(0, this.trauma - delta * 2.2);

      const shake = this.trauma * this.trauma;

      // Positional shake impulse
      this.shakeOffset.set(
        (Math.random() - 0.5) * shake * 1.8,
        (Math.random() - 0.5) * shake * 1.4,
        (Math.random() - 0.5) * shake * 1.8
      );

      // Smooth camera position follow with added shake
      this.camera.position.x = THREE.MathUtils.lerp(this.camera.position.x, targetPos.x, delta * 12) + this.shakeOffset.x;
      this.camera.position.y = THREE.MathUtils.lerp(this.camera.position.y, targetPos.y + camOffsetY, delta * 12) + this.shakeOffset.y;
      this.camera.position.z = THREE.MathUtils.lerp(this.camera.position.z, targetPos.z + camOffsetZ, delta * 12) + this.shakeOffset.z;

      this.camera.lookAt(targetPos.x, targetPos.y + 0.5, targetPos.z);

      // Rotational pitch/roll/yaw jitter impulse
      const rotShake = shake * 0.08;
      this.camera.rotation.z += (Math.random() - 0.5) * rotShake;
      this.camera.rotation.x += (Math.random() - 0.5) * rotShake * 0.5;
    } else {
      this.trauma = 0;
      // Smooth follow when idle
      this.camera.position.x = THREE.MathUtils.lerp(this.camera.position.x, targetPos.x, delta * 8);
      this.camera.position.y = THREE.MathUtils.lerp(this.camera.position.y, targetPos.y + camOffsetY, delta * 8);
      this.camera.position.z = THREE.MathUtils.lerp(this.camera.position.z, targetPos.z + camOffsetZ, delta * 8);
      this.camera.lookAt(targetPos.x, targetPos.y + 0.5, targetPos.z);
    }
  }
}
