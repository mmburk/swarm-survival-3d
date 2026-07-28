import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

export type BiomeType = 'NEON_GRID' | 'VOLCANO_RED' | 'TOXIC_WASTELAND';

export class RenderPipeline {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  public composer: EffectComposer;
  public bloomPass: UnrealBloomPass;
  public dirLight: THREE.DirectionalLight;

  constructor(container: HTMLElement) {
    this.scene = new THREE.Scene();
    // Soft Dark Slate Gray Ambient Background
    this.scene.background = new THREE.Color(0x12151e);
    this.scene.fog = new THREE.FogExp2(0x12151e, 0.008);

    this.camera = new THREE.PerspectiveCamera(
      55,
      window.innerWidth / window.innerHeight,
      0.1,
      300
    );
    this.camera.position.set(0, 20, 20);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;

    container.appendChild(this.renderer.domElement);

    // Soft Balanced Sci-Fi Ambient & Directional Lighting
    const hemiLight = new THREE.HemisphereLight(0x223344, 0x111622, 1.2);
    this.scene.add(hemiLight);

    this.dirLight = new THREE.DirectionalLight(0x88ccff, 1.4);
    this.dirLight.position.set(20, 40, 20);
    this.scene.add(this.dirLight);

    const renderPass = new RenderPass(this.scene, this.camera);
    // Subtle Tasteful Bloom Capped at 0.35
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(Math.floor(window.innerWidth * 0.5), Math.floor(window.innerHeight * 0.5)),
      0.35, // Capped bloom strength
      0.4,
      0.85 // Higher threshold to avoid pixel bleeding
    );
    const outputPass = new OutputPass();

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(renderPass);
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(outputPass);

    window.addEventListener('resize', () => this.onWindowResize());
  }

  public setBiome(biome: BiomeType): void {
    if (biome === 'VOLCANO_RED') {
      this.scene.background = new THREE.Color(0x1c1214);
      this.scene.fog = new THREE.FogExp2(0x1c1214, 0.008);
    } else if (biome === 'TOXIC_WASTELAND') {
      this.scene.background = new THREE.Color(0x121c17);
      this.scene.fog = new THREE.FogExp2(0x121c17, 0.008);
    } else {
      this.scene.background = new THREE.Color(0x12151e);
      this.scene.fog = new THREE.FogExp2(0x12151e, 0.008);
    }
  }

  public setBossTheme(active: boolean): void {
    if (active) {
      this.scene.background = new THREE.Color(0x1f0a12);
      this.scene.fog = new THREE.FogExp2(0x1f0a12, 0.01);
    } else {
      this.scene.background = new THREE.Color(0x12151e);
      this.scene.fog = new THREE.FogExp2(0x12151e, 0.008);
    }
  }

  private onWindowResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.composer.setSize(window.innerWidth, window.innerHeight);
    this.bloomPass.setSize(Math.floor(window.innerWidth * 0.5), Math.floor(window.innerHeight * 0.5));
  }

  public render(): void {
    this.composer.render();
  }
}
