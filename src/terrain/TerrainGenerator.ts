import * as THREE from 'three';
import { createNoise2D } from 'simplex-noise';
import { HEX } from '../theme/Palette';

/**
 * Cracked road surface with dirt worn through it. Almost flat — this is a
 * top-down shooter, so height is texture, not terrain.
 */
export class TerrainGenerator {
  public mesh!: THREE.Mesh;
  public material!: THREE.MeshStandardMaterial;
  private noise2D = createNoise2D();

  public width: number = 150;
  public depth: number = 150;
  public segments: number = 64;

  private scene: THREE.Scene;
  private fenceGroup!: THREE.Group;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.generate();
    this.createPerimeterFence();
  }

  public getHeightAt(x: number, z: number): number {
    return this.noise2D(x * 0.028, z * 0.028) * 0.3;
  }

  private createRoadTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // The map is a near-neutral detail layer, not the colour of the road.
    // Material colour supplies the hue and the two are multiplied, so a dark
    // texture here would drag the whole surface to black.
    ctx.fillStyle = '#c2c2ba';
    ctx.fillRect(0, 0, 512, 512);

    // Patchy dirt blown across the tarmac.
    for (let i = 0; i < 90; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const r = 18 + Math.random() * 60;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(150, 128, 92, ${0.14 + Math.random() * 0.2})`);
      g.addColorStop(1, 'rgba(150, 128, 92, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Aggregate speckle so the surface is not a flat wash at close range.
    for (let i = 0; i < 2600; i++) {
      const shade = 150 + Math.floor(Math.random() * 60);
      ctx.fillStyle = `rgba(${shade + 10}, ${shade + 8}, ${shade}, 0.45)`;
      ctx.fillRect(Math.random() * 512, Math.random() * 512, 1.5, 1.5);
    }

    // Cracks: short branching polylines.
    ctx.strokeStyle = 'rgba(52, 50, 42, 0.5)';
    for (let i = 0; i < 26; i++) {
      let x = Math.random() * 512;
      let y = Math.random() * 512;
      let a = Math.random() * Math.PI * 2;
      ctx.lineWidth = 0.8 + Math.random() * 1.6;
      ctx.beginPath();
      ctx.moveTo(x, y);
      const segs = 4 + Math.floor(Math.random() * 6);
      for (let s = 0; s < segs; s++) {
        a += (Math.random() - 0.5) * 1.1;
        x += Math.cos(a) * (10 + Math.random() * 26);
        y += Math.sin(a) * (10 + Math.random() * 26);
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Faded lane marking.
    ctx.fillStyle = 'rgba(235, 228, 196, 0.3)';
    for (let y = 20; y < 512; y += 128) {
      ctx.fillRect(250, y, 10, 62);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(11, 11);
    texture.anisotropy = 4;
    return texture;
  }

  private generate(): void {
    const geometry = new THREE.PlaneGeometry(this.width, this.depth, this.segments, this.segments);
    geometry.rotateX(-Math.PI / 2);

    const posAttr = geometry.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      posAttr.setY(i, this.getHeightAt(posAttr.getX(i), posAttr.getZ(i)));
    }
    geometry.computeVertexNormals();

    this.material = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#6d7052'),
      map: this.createRoadTexture(),
      roughness: 0.96,
      metalness: 0.0
    });

    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.receiveShadow = true;
    this.scene.add(this.mesh);
  }

  /**
   * A ring of leaning chain-link and jersey barriers marking the play area.
   *
   * Instanced: 54 posts and 54 panels used to be 108 individual meshes, which
   * on its own was a quarter of the frame's draw calls for scenery nobody
   * looks at.
   */
  private createPerimeterFence(): void {
    this.fenceGroup = new THREE.Group();

    const count = 54;
    const radius = 60;
    const dummy = new THREE.Object3D();

    const postGeo = new THREE.CylinderGeometry(0.13, 0.13, 3.4, 5);
    const postMat = new THREE.MeshStandardMaterial({ color: HEX.steel, roughness: 0.85, metalness: 0.35 });
    const posts = new THREE.InstancedMesh(postGeo, postMat, count);
    posts.castShadow = true;

    const panelGeo = new THREE.PlaneGeometry(5.4, 3.0);
    const panelMat = new THREE.MeshStandardMaterial({
      color: 0x6a6d63,
      roughness: 0.9,
      metalness: 0.2,
      wireframe: true,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide
    });
    const panels = new THREE.InstancedMesh(panelGeo, panelMat, count);

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const px = Math.cos(angle) * radius;
      const pz = Math.sin(angle) * radius;
      const py = this.getHeightAt(px, pz);

      dummy.scale.set(1, 1, 1);
      dummy.rotation.set(0, 0, (Math.random() - 0.5) * 0.16);
      dummy.position.set(px, py + 1.7, pz);
      dummy.updateMatrix();
      posts.setMatrixAt(i, dummy.matrix);

      const mid = angle + Math.PI / count;
      dummy.rotation.set(0, -mid, 0);
      dummy.position.set(Math.cos(mid) * radius, py + 1.55, Math.sin(mid) * radius);
      dummy.updateMatrix();
      panels.setMatrixAt(i, dummy.matrix);
    }

    posts.instanceMatrix.needsUpdate = true;
    panels.instanceMatrix.needsUpdate = true;

    this.fenceGroup.add(posts);
    this.fenceGroup.add(panels);
    this.scene.add(this.fenceGroup);
  }

  public setGroundColor(color: string | number | THREE.Color): void {
    this.material?.color.set(color);
  }

  public setVisible(visible: boolean): void {
    if (this.mesh) this.mesh.visible = visible;
    if (this.fenceGroup) this.fenceGroup.visible = visible;
  }
}
