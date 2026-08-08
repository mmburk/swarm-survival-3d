import * as THREE from 'three';
import { CAMERA_RIG } from './CameraRig';

export class CameraJuice {
  private trauma: number = 0;
  private camera: THREE.OrthographicCamera;

  constructor(camera: THREE.OrthographicCamera) {
    this.camera = camera;
  }

  public addTrauma(amount: number): void {
    // Trauma accumulates up to 1.0 for heavy impact feedback
    this.trauma = Math.min(1.0, this.trauma + amount);
  }

  /** Drops the camera straight onto its mark, with no easing. */
  public snapTo(targetPos: THREE.Vector3): void {
    const o = CAMERA_RIG.offset;
    this.trauma = 0;
    this.camera.position.set(targetPos.x + o.x, targetPos.y + o.y, targetPos.z + o.z);
    this.camera.lookAt(targetPos.x, targetPos.y + CAMERA_RIG.lookHeight, targetPos.z);
  }

  public update(delta: number, targetPos: THREE.Vector3): void {
    const camOffsetX = CAMERA_RIG.offset.x;
    const camOffsetY = CAMERA_RIG.offset.y;
    const camOffsetZ = CAMERA_RIG.offset.z;
    const lookHeight = CAMERA_RIG.lookHeight;

    if (this.trauma > 0.001) {
      // Quadratic decay curve for natural weight feeling
      this.trauma = Math.max(0, this.trauma - delta * 2.2);

      const shake = this.trauma * this.trauma;

      // Smooth camera position follow, on its mark before the kick is added
      this.camera.position.x = THREE.MathUtils.lerp(this.camera.position.x, targetPos.x + camOffsetX, delta * 12);
      this.camera.position.y = THREE.MathUtils.lerp(this.camera.position.y, targetPos.y + camOffsetY, delta * 12);
      this.camera.position.z = THREE.MathUtils.lerp(this.camera.position.z, targetPos.z + camOffsetZ, delta * 12);

      this.camera.lookAt(targetPos.x, targetPos.y + lookHeight, targetPos.z);

      // The kick rides the camera's own axes rather than the world's. Under an
      // orthographic projection a world-Y jolt would slide the whole ground
      // plane sideways instead of nudging the frame, because there is no
      // perspective to sell it as the lens moving.
      // 1.8 is the same fraction of the frame the old perspective shake moved:
      // it threw the camera 1.8 world units about a view that was 26 units
      // tall, and the orthographic frame is 28.
      this.camera.translateX((Math.random() - 0.5) * shake * 1.9);
      this.camera.translateY((Math.random() - 0.5) * shake * 1.9);

      // Roll only. Pitch jitter reads as the floor swimming when nothing
      // tapers with distance.
      this.camera.rotation.z += (Math.random() - 0.5) * shake * 0.08;
    } else {
      this.trauma = 0;
      // Smooth follow when idle
      this.camera.position.x = THREE.MathUtils.lerp(this.camera.position.x, targetPos.x + camOffsetX, delta * 8);
      this.camera.position.y = THREE.MathUtils.lerp(this.camera.position.y, targetPos.y + camOffsetY, delta * 8);
      this.camera.position.z = THREE.MathUtils.lerp(this.camera.position.z, targetPos.z + camOffsetZ, delta * 8);
      this.camera.lookAt(targetPos.x, targetPos.y + lookHeight, targetPos.z);
    }
  }
}
