import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import type { TerrainGenerator } from '../terrain/TerrainGenerator';

export interface Sector {
  id: number;
  name: string;
  tagline: string;
  groundColor: THREE.Color;
  keyLight: THREE.Color;
  skyColor: THREE.Color;
  fogColor: THREE.Color;
  fogDensity: number;
  keyIntensity: number;
  hemiIntensity: number;
  ambientIntensity: number;
}

/**
 * Five districts of one dead city. All of them are overcast, dusty or smoke
 * filled — the only saturated light in the game comes from fire.
 */
/**
 * Light intensities look high for a "dark" game, and they have to be: three's
 * Lambert BRDF divides irradiance by PI, and the ground material multiplies
 * its colour by a detail map on top of that. The values below were tuned by
 * measuring rendered frame luminance, not by eye — mid-frame lands around
 * 90-120/255, which is moody but still readable.
 */
export const SECTORS: Record<number, Sector> = {
  1: {
    id: 1,
    name: 'Willow Creek',
    tagline: 'Suburban cul-de-sac. Doors still open, cars still in the drives.',
    groundColor: new THREE.Color('#6d7052'),
    keyLight: new THREE.Color('#c8c9b4'),
    skyColor: new THREE.Color('#5c6157'),
    fogColor: new THREE.Color('#5c6157'),
    fogDensity: 0.0105,
    keyIntensity: 3.2,
    hemiIntensity: 1.7,
    ambientIntensity: 1.7
  },
  2: {
    id: 2,
    name: 'Mile 40 Truck Stop',
    tagline: 'Diesel, dust and a queue of cars that never moved again.',
    groundColor: new THREE.Color('#7a6b4a'),
    keyLight: new THREE.Color('#d3b483'),
    skyColor: new THREE.Color('#6b5c46'),
    fogColor: new THREE.Color('#6b5c46'),
    fogDensity: 0.0135,
    keyIntensity: 3.4,
    hemiIntensity: 1.6,
    ambientIntensity: 1.65
  },
  3: {
    id: 3,
    name: 'The Underpass',
    tagline: 'Somebody strung lamps down here. Somebody is still trading.',
    groundColor: new THREE.Color('#6b6c5a'),
    keyLight: new THREE.Color('#c69a58'),
    skyColor: new THREE.Color('#3a382f'),
    fogColor: new THREE.Color('#3a382f'),
    fogDensity: 0.014,
    keyIntensity: 3.0,
    hemiIntensity: 1.7,
    ambientIntensity: 1.95
  },
  4: {
    id: 4,
    name: 'St. Brigid Hospital',
    tagline: 'Triage tents, chained doors, and whatever came out of the wards.',
    groundColor: new THREE.Color('#616e56'),
    keyLight: new THREE.Color('#a9bd9a'),
    skyColor: new THREE.Color('#404a3c'),
    fogColor: new THREE.Color('#404a3c'),
    fogDensity: 0.0155,
    keyIntensity: 2.9,
    hemiIntensity: 1.6,
    ambientIntensity: 1.6
  },
  5: {
    id: 5,
    name: 'Downtown Cordon',
    tagline: 'The army made their stand here. You can see how that went.',
    groundColor: new THREE.Color('#665443'),
    keyLight: new THREE.Color('#c98d63'),
    skyColor: new THREE.Color('#4a382e'),
    fogColor: new THREE.Color('#4a382e'),
    fogDensity: 0.018,
    keyIntensity: 3.0,
    hemiIntensity: 1.5,
    ambientIntensity: 1.55
  }
};

export function sectorFor(room: number): Sector {
  let key = room % 5;
  if (key === 0) key = 5;
  return SECTORS[key] ?? SECTORS[1];
}

/** Warm, low interior lighting for the shelter — no daylight underground. */
const SHELTER_LIGHT = {
  key: new THREE.Color('#e0b070'),
  sky: new THREE.Color('#241f18'),
  fogDensity: 0.011,
  keyIntensity: 2.4,
  hemiIntensity: 2.0,
  ambientIntensity: 2.9
};

export class RenderPipeline {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  public composer: EffectComposer;
  public bloomPass: UnrealBloomPass;
  public dirLight: THREE.DirectionalLight;
  public hemiLight: THREE.HemisphereLight;
  public ambientLight: THREE.AmbientLight;
  public fog: THREE.FogExp2;

  public currentSectorId: number = 1;

  private bgColor: THREE.Color = new THREE.Color();
  private fogColor: THREE.Color = new THREE.Color();

  constructor(container: HTMLElement) {
    this.scene = new THREE.Scene();

    const start = SECTORS[1];
    this.bgColor.copy(start.skyColor);
    this.fogColor.copy(start.fogColor);
    this.scene.background = this.bgColor;
    this.fog = new THREE.FogExp2(this.fogColor.getHex(), start.fogDensity);
    this.scene.fog = this.fog;

    this.camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.1, 260);
    this.camera.position.set(0, 20, 18);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    // Shadow maps were configured on the light but never switched on here, so
    // nothing in the world actually cast one.
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.appendChild(this.renderer.domElement);

    this.ambientLight = new THREE.AmbientLight(0xb9bcae, start.ambientIntensity);
    this.scene.add(this.ambientLight);

    this.hemiLight = new THREE.HemisphereLight(start.keyLight, new THREE.Color('#2a2b20'), start.hemiIntensity);
    this.scene.add(this.hemiLight);

    this.dirLight = new THREE.DirectionalLight(start.keyLight, start.keyIntensity);
    this.dirLight.position.set(26, 46, 18);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.set(1024, 1024);
    this.dirLight.shadow.camera.near = 1;
    this.dirLight.shadow.camera.far = 140;
    this.dirLight.shadow.camera.left = -55;
    this.dirLight.shadow.camera.right = 55;
    this.dirLight.shadow.camera.top = 55;
    this.dirLight.shadow.camera.bottom = -55;
    this.dirLight.shadow.bias = -0.0012;
    this.scene.add(this.dirLight);
    this.scene.add(this.dirLight.target);

    const renderPass = new RenderPass(this.scene, this.camera);
    // Just enough bloom to let muzzle flash and fire read as hot. Anything
    // stronger and the whole thing starts looking like neon again.
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(Math.floor(window.innerWidth * 0.5), Math.floor(window.innerHeight * 0.5)),
      0.16,
      0.55,
      0.92
    );
    const outputPass = new OutputPass();

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(renderPass);
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(outputPass);

    window.addEventListener('resize', () => this.onWindowResize());
  }

  public applySector(room: number, terrain?: TerrainGenerator): Sector {
    const sector = sectorFor(room);
    this.currentSectorId = sector.id;

    this.bgColor.copy(sector.skyColor);
    this.fogColor.copy(sector.fogColor);
    this.scene.background = this.bgColor;
    this.fog.color.copy(this.fogColor);
    this.fog.density = sector.fogDensity;

    this.dirLight.color.copy(sector.keyLight);
    this.dirLight.intensity = sector.keyIntensity;
    this.hemiLight.color.copy(sector.keyLight);
    this.hemiLight.intensity = sector.hemiIntensity;
    this.ambientLight.intensity = sector.ambientIntensity;

    terrain?.setGroundColor(sector.groundColor);
    terrain?.setVisible(true);

    return sector;
  }

  /** Underground shelter: warm lamps, tight fog, terrain hidden. */
  public applyShelterLighting(terrain?: TerrainGenerator): void {
    this.bgColor.copy(SHELTER_LIGHT.sky);
    this.fogColor.copy(SHELTER_LIGHT.sky);
    this.scene.background = this.bgColor;
    this.fog.color.copy(this.fogColor);
    this.fog.density = SHELTER_LIGHT.fogDensity;

    this.dirLight.color.copy(SHELTER_LIGHT.key);
    this.dirLight.intensity = SHELTER_LIGHT.keyIntensity;
    this.hemiLight.color.copy(SHELTER_LIGHT.key);
    this.hemiLight.intensity = SHELTER_LIGHT.hemiIntensity;
    this.ambientLight.intensity = SHELTER_LIGHT.ambientIntensity;

    terrain?.setVisible(false);
  }

  /** Boss arena: red dust and a hard, low sun. */
  public applyBossLighting(terrain?: TerrainGenerator): void {
    this.applySector(5, terrain);
    this.fog.density = 0.022;
    this.dirLight.intensity = 3.3;
    this.ambientLight.intensity = 1.85;
  }

  public setBloomEnabled(enabled: boolean): void {
    this.bloomPass.enabled = enabled;
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
