import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import type { TerrainGenerator } from '../terrain/TerrainGenerator';
import { CAMERA_RIG } from './CameraRig';

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

/**
 * Direction and distance of the key light, relative to whatever it follows.
 * Swung round to the far side of the rig on purpose: with the camera looking in
 * from the south-east, a sun over the same shoulder would drop every shadow
 * behind the thing casting it, where nobody can see it. From here they fall
 * down and to the left of the screen, which is where an isometric game wants
 * them — they read as the contact point that orthographic projection otherwise
 * gives you no depth cue for.
 */
const SUN_OFFSET = new THREE.Vector3(-10, 46, -28);
/** Half-width of the shadow frustum, in world units. */
const SHADOW_EXTENT = 46;

/**
 * Fog densities below are authored against the old raked camera, which could
 * only see about 39 units down the field. The isometric rake is flatter and
 * reaches 55, and FogExp2 squares the distance, so leaving them alone turned
 * the top of the frame to soup -- the boss arena went from half hidden to
 * three quarters. Scaling here rather than in the tables keeps the sectors
 * readable relative to each other, which is what those numbers are really for.
 */
const FOG_RANGE_SCALE = 39 / 55;

export class RenderPipeline {
  public scene: THREE.Scene;
  public camera: THREE.OrthographicCamera;
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
    this.fog = new THREE.FogExp2(this.fogColor.getHex(), start.fogDensity * FOG_RANGE_SCALE);
    this.scene.fog = this.fog;

    // Orthographic, not perspective: nothing tapers with distance, so a runner
    // at the top of the frame is exactly the size of the one about to reach
    // you. That is the whole point of the isometric look, and it is also what
    // makes the arena readable when a dozen of them are strung out across it.
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 260);
    this.camera.position.copy(CAMERA_RIG.offset);
    this.camera.lookAt(0, 0, 0);
    this.applyCameraFrame();

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
    this.dirLight.position.copy(SUN_OFFSET);
    this.dirLight.castShadow = true;
    // 2048, not 1024: the flatter isometric rake sees roughly half again as far
    // down the field as the old raked camera did, so the frustum below had to
    // grow with it. Same map size would have meant coarser texels than before.
    this.dirLight.shadow.mapSize.set(2048, 2048);
    this.dirLight.shadow.camera.near = 1;
    this.dirLight.shadow.camera.far = 120;
    // The frustum covers a little more than the camera can see and then
    // follows the player, instead of trying to blanket the whole 110-unit
    // arena. Same map, roughly 1.6x the texel density, and the shadow pass
    // only has to consider what is actually near the action.
    this.dirLight.shadow.camera.left = -SHADOW_EXTENT;
    this.dirLight.shadow.camera.right = SHADOW_EXTENT;
    this.dirLight.shadow.camera.top = SHADOW_EXTENT;
    this.dirLight.shadow.camera.bottom = -SHADOW_EXTENT;
    this.dirLight.shadow.bias = -0.0012;
    this.dirLight.shadow.camera.updateProjectionMatrix();
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
    this.setFogDensity(sector.fogDensity);

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
    this.setFogDensity(SHELTER_LIGHT.fogDensity);

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
    this.setFogDensity(0.022);
    this.dirLight.intensity = 3.3;
    this.ambientLight.intensity = 1.85;
  }

  /**
   * Keeps the sun (and therefore the shadow frustum) centred on the player.
   * Snapped to whole units so the shadow texels do not swim as you walk.
   */
  public followSun(target: THREE.Vector3): void {
    const x = Math.round(target.x);
    const z = Math.round(target.z);
    this.dirLight.position.set(x + SUN_OFFSET.x, SUN_OFFSET.y, z + SUN_OFFSET.z);
    this.dirLight.target.position.set(x, 0, z);
    this.dirLight.target.updateMatrixWorld();
  }

  public setBloomEnabled(enabled: boolean): void {
    this.bloomPass.enabled = enabled;
  }

  /** Applies an authored density through the camera-range compensation. */
  private setFogDensity(density: number): void {
    this.fog.density = density * FOG_RANGE_SCALE;
  }

  /**
   * Sizes the orthographic box from the rig's view height. An ortho camera has
   * no field of view to widen, so the frame is stated directly in world units:
   * whatever the window shape, you always see the same number of metres from
   * the top of the screen to the bottom.
   */
  public applyCameraFrame(): void {
    const halfH = CAMERA_RIG.viewHeight / 2;
    const halfW = halfH * (window.innerWidth / window.innerHeight);
    this.camera.top = halfH;
    this.camera.bottom = -halfH;
    this.camera.left = -halfW;
    this.camera.right = halfW;
    this.camera.updateProjectionMatrix();
  }

  private onWindowResize(): void {
    this.applyCameraFrame();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.composer.setSize(window.innerWidth, window.innerHeight);
    this.bloomPass.setSize(Math.floor(window.innerWidth * 0.5), Math.floor(window.innerHeight * 0.5));
  }

  public render(): void {
    this.composer.render();
  }
}
