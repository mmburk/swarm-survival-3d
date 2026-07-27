import * as THREE from 'three';
import { createNoise2D } from 'simplex-noise';

export class TerrainGenerator {
  public mesh!: THREE.Mesh;
  private noise2D = createNoise2D();

  public width: number = 140;
  public depth: number = 140;
  public segments: number = 70;

  private scene: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.generate();
  }

  public getHeightAt(x: number, z: number): number {
    const scale1 = 0.02;
    const scale2 = 0.05;
    const n1 = this.noise2D(x * scale1, z * scale1);
    const n2 = this.noise2D(x * scale2 + 100, z * scale2 + 100);

    const distFromCenter = Math.sqrt(x * x + z * z);
    const centerFlatten = Math.max(0, Math.min(1, (distFromCenter - 15) / 45));

    let height = (n1 * 4.5 + n2 * 1.5) * centerFlatten;

    if (distFromCenter > 55) {
      height += Math.pow((distFromCenter - 55) * 0.4, 1.6);
    }

    return height;
  }

  private generate(): void {
    const geometry = new THREE.PlaneGeometry(
      this.width,
      this.depth,
      this.segments,
      this.segments
    );
    geometry.rotateX(-Math.PI / 2);

    const posAttr = geometry.attributes.position;
    const count = posAttr.count;
    const colors: number[] = [];

    const colorValleys = new THREE.Color('#0a1128');
    const colorPlains = new THREE.Color('#002244');
    const colorLowRidge = new THREE.Color('#005577');
    const colorHighRidge = new THREE.Color('#00ffff');
    const colorPeak = new THREE.Color('#ff00aa');

    for (let i = 0; i < count; i++) {
      const x = posAttr.getX(i);
      const z = posAttr.getZ(i);
      const h = this.getHeightAt(x, z);
      posAttr.setY(i, h);

      const c = new THREE.Color();
      if (h < 0.2) {
        c.lerpColors(colorValleys, colorPlains, (h + 2) / 2.2);
      } else if (h < 2.5) {
        c.lerpColors(colorPlains, colorLowRidge, h / 2.5);
      } else if (h < 5.5) {
        c.lerpColors(colorLowRidge, colorHighRidge, (h - 2.5) / 3.0);
      } else {
        c.lerpColors(colorHighRidge, colorPeak, Math.min(1, (h - 5.5) / 4.0));
      }

      colors.push(c.r, c.g, c.b);
    }

    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      flatShading: true,
      roughness: 0.85,
      metalness: 0.15
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.receiveShadow = true;
    this.mesh.castShadow = true;
    this.scene.add(this.mesh);
  }
}
