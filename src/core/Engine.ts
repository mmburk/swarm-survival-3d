import * as THREE from 'three';

import { RenderPipeline, sectorFor } from '../graphics/RenderPipeline';
import { InputManager } from './InputManager';
import { CameraJuice } from '../graphics/CameraJuice';
import { CAMERA_RIG } from '../graphics/CameraRig';
import { TerrainGenerator } from '../terrain/TerrainGenerator';
import { InstancedProps } from '../graphics/InstancedProps';
import { ParticleSystem } from '../graphics/ParticleSystem';
import { InstancedProjectiles } from '../graphics/InstancedProjectiles';
import { InstancedPickups } from '../graphics/InstancedPickups';
import { SpatialHashGrid } from '../utils/SpatialHashGrid';
import { ObjectPool } from '../pooling/ObjectPool';
import { ArcadePhysics } from '../physics/ArcadePhysics';

import { Player } from '../entities/Player';
import { Enemy, EnemyType } from '../entities/Enemy';
import { BossEnemy } from '../entities/BossEnemy';
import { Projectile, ProjectileType } from '../entities/Projectile';
import { Pickup, PickupType } from '../entities/Pickup';
import { Flare } from '../entities/Flare';
import { Shelter, type Station } from '../entities/Shelter';
import { Trader } from '../entities/Trader';
import { SupplyCache } from '../entities/SupplyCache';
import { SignalDrop } from '../entities/SignalDrop';
import type { GateOffer } from './SectorManager';

import { AudioManager } from './AudioManager';
import { SectorManager } from './SectorManager';

import { HUD } from '../ui/HUD';
import { MenuSystem } from '../ui/MenuSystem';
import { BoonModal, generateBoons, applyBoon, CALLERS, type Boon, type Caller } from '../ui/BoonModal';
import { pickFieldWorks } from '../config/FieldWorks';
import { CodexModal } from '../ui/CodexModal';
import { LoadingScreen } from '../ui/LoadingScreen';
import { RadioDialogue } from '../ui/RadioDialogue';
import { pickLine, logProgress, type LastRun, type RadioContext } from '../narrative/RadioLog';
import { pickSignalOffer } from '../narrative/SignalOffers';
import { readyCount, type ProphecyContext, type ProphecyView } from '../narrative/Prophecies';

import { SaveSystem } from '../utils/SaveSystem';
import { HEX } from '../theme/Palette';
import type { WeaponId } from '../config/Weapons';

type Mode = 'TITLE' | 'SHELTER' | 'RUN' | 'DEBRIEF';

const tmpSpawn = new THREE.Vector3();
const tmpDrop = new THREE.Vector3();
const tmpSignal = new THREE.Vector3();
const tmpFrame = new THREE.Vector2();
const tmpDir = new THREE.Vector3();
const tmpAim = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

/** Play area is a circle so the player cannot hide in a fence corner. */
const ARENA_RADIUS = 52;

export class Engine {
  private render!: RenderPipeline;
  private input!: InputManager;
  private cameraJuice!: CameraJuice;
  private terrain!: TerrainGenerator;
  private props!: InstancedProps;
  private particles!: ParticleSystem;
  private instProjectiles!: InstancedProjectiles;
  private instPickups!: InstancedPickups;
  private grid!: SpatialHashGrid<Enemy>;

  private player!: Player;
  private boss!: BossEnemy;

  private enemies!: ObjectPool<Enemy>;
  private bullets!: ObjectPool<Projectile>;
  private drops!: ObjectPool<Pickup>;
  private flares!: ObjectPool<Flare>;

  public audio: AudioManager;
  private hud!: HUD;
  private menus!: MenuSystem;
  private sectors!: SectorManager;
  private trader!: Trader;
  private cache!: SupplyCache;
  private signalDrop!: SignalDrop;
  private shelter!: Shelter;
  private boons!: BoonModal;
  private codex!: CodexModal;
  private loading!: LoadingScreen;
  private radio!: RadioDialogue;

  /**
   * What the last run did, kept for the voice waiting downstairs. Null until
   * the player has been outside once, which is what the opening lines key on.
   */
  private lastRun: LastRun | null = null;

  private mode: Mode = 'TITLE';
  /** True whenever a full-screen surface owns input. */
  private uiPaused: boolean = false;
  private interactLock: number = 0;

  private lastTime: number = 0;
  private frame: number = 0;
  private hitStop: number = 0;

  private runKills: number = 0;
  private runScore: number = 0;
  private runScrap: number = 0;
  private runStart: number = 0;
  private sectorName: string = '';
  /**
   * Who owes the player a favour, held from the gate that promised it until the
   * street it leads to has been cleared. 'ANY' when the gate named nobody.
   */
  private pendingBoon: Caller | 'ANY' | null = null;
  /**
   * Set by a workbench gate. Unlike a signal, this is not handed over at the
   * far end of the next fight: the whole point of a reworked gun is having it
   * for the street you are about to walk into, so the bench is standing there
   * the moment the fade lifts.
   */
  private pendingWorks: boolean = false;
  /** Work already fitted this run, so the bench never offers it twice. */
  private worksFitted: string[] = [];
  private goingHome: boolean = false;

  private streak: number = 0;
  private streakTimer: number = 0;

  private telegraphs: Array<{ pos: THREE.Vector3; type: EnemyType; timer: number }> = [];

  constructor(container: HTMLElement) {
    this.audio = new AudioManager();

    try {
      this.render = new RenderPipeline(container);
      this.input = new InputManager();
      this.input.setCamera(this.render.camera);

      this.cameraJuice = new CameraJuice(this.render.camera);
      this.terrain = new TerrainGenerator(this.render.scene);
      this.props = new InstancedProps(this.render.scene, this.terrain);
      this.particles = new ParticleSystem(this.render.scene);
      this.instProjectiles = new InstancedProjectiles(this.render.scene);
      this.instPickups = new InstancedPickups(this.render.scene);
      this.grid = new SpatialHashGrid<Enemy>(6.0);

      this.player = new Player(this.render.scene, this.input, this.particles, this.audio, this.terrain);
      this.boss = new BossEnemy(this.render.scene, this.particles, this.audio, this.terrain);

      this.enemies = new ObjectPool<Enemy>(
        () => new Enemy(this.render.scene, this.particles, this.audio, this.terrain), 180, 320);
      this.bullets = new ObjectPool<Projectile>(() => new Projectile(this.particles), 260, 460);
      this.drops = new ObjectPool<Pickup>(() => new Pickup(), 140, 260);
      this.flares = new ObjectPool<Flare>(
        () => new Flare(this.render.scene, this.particles, this.audio), 3, 6);

      this.hud = new HUD();
      this.hud.onToggleMute = () => this.audio.toggleMute();

      this.menus = new MenuSystem();
      this.sectors = new SectorManager(this.render.scene);
      this.trader = new Trader(this.render.scene);
      this.cache = new SupplyCache(this.render.scene);
      this.signalDrop = new SignalDrop(this.render.scene);
      this.shelter = new Shelter(this.render.scene);
      this.boons = new BoonModal();
      this.codex = new CodexModal();
      this.loading = new LoadingScreen();
      this.radio = new RadioDialogue();

      this.wirePlayer();
      this.wireSectors();

      this.mode = 'TITLE';
      this.hud.setShelterMode(true);
      this.menus.showTitle(() => this.enterShelter(true));
      this.uiPaused = true;
    } catch (err) {
      console.error('Fatal error while building the game:', err);
    }

    if (import.meta.env?.DEV) {
      (window as unknown as { __engine?: Engine }).__engine = this;
    }

    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  /** Dev-only introspection used when driving the game from the console. */
  public debugState() {
    return {
      mode: this.mode,
      uiPaused: this.uiPaused,
      player: this.player ? [+this.player.position.x.toFixed(2), +this.player.position.z.toFixed(2)] : null,
      station: this.shelter?.active ? this.shelter.stationAt(this.player.position)?.id ?? null : null,
      sector: this.sectors?.current,
      sectorState: this.sectors?.state,
      enemies: this.enemies?.getActiveItems().length,
      remaining: this.sectors?.remainingSpawns(),
      health: this.player?.health,
      kills: this.runKills,
      scrap: this.runScrap,
      bullets: this.bullets?.getActiveItems().length
    };
  }

  /** Dev-only teleport so tests can reach a station without walking. */
  public debugTeleport(x: number, z: number): void {
    this.player.resetPositionAndVelocity(new THREE.Vector3(x, 0, z));
  }

  // ------------------------------------------------------------------ wiring

  private wirePlayer(): void {
    this.player.onTakeDamage = () => {
      this.hud.flashDamage();
      this.cameraJuice.addTrauma(0.3);
    };

    this.player.onGetUp = () => {
      this.cameraJuice.addTrauma(0.7);
      this.hud.showBanner('BACK ON YOUR FEET', 'That was the last one you get for free.', 2.4);
    };

    this.player.onDied = () => {
      if (this.mode === 'RUN') this.endRun(false, 'The street took you');
    };
  }

  private wireSectors(): void {
    this.sectors.onCleared = () => {
      this.audio.playSectorClear();
      this.particles.emitBurst(this.player.position, 22, HEX.smoke, 9, 0.6);
      this.onStreetDone();
    };

    this.sectors.onGateChosen = (offer) => {
      try {
        this.player.isInvulnerable = true;

        if (offer.reward === 'HOME') {
          this.goingHome = true;
          return;
        }

        this.applyReward(offer);
        this.clearField();

        const next = this.sectors.current + 1;
        this.sectors.setup(next);
        // Player first: a trader sector opens its gates inside buildSector, and
        // they are placed relative to where the player is standing.
        this.placePlayerAtSectorStart();
        this.buildSector(next);
      } catch (err) {
        console.error('Error crossing into the next sector:', err);
      }
    };

    this.sectors.onTransitionDone = () => {
      this.player.isInvulnerable = false;
      this.player.damageIFrameTimer = 0;

      if (this.goingHome) {
        this.goingHome = false;
        this.endRun(true, 'You walked back through the door');
        return;
      }

      if (this.pendingWorks) {
        this.pendingWorks = false;
        this.openWorkbench();
      }
    };
  }

  // ------------------------------------------------------------------ shelter

  public enterShelter(firstTime: boolean): void {
    this.menus.hide();
    this.uiPaused = true;

    this.loading.show(firstTime ? 'Going down' : 'Coming home', () => {
      this.mode = 'SHELTER';
      this.clearField();
      this.sectors.reset();

      this.audio.stopBackgroundMusic();
      this.render.applyShelterLighting(this.terrain);
      this.props.setVisible(false);
      this.shelter.activate();

      this.player.resetPositionAndVelocity(new THREE.Vector3(0, 0, 8));
      CAMERA_RIG.useShelter();
      this.cameraJuice.snapTo(this.player.position);

      this.hud.setShelterMode(true);
      this.uiPaused = false;
      this.interactLock = 0.3;
      this.lastTime = performance.now();

      // A beat after the room has faded in, not on top of the fade — the set
      // in the corner should look like it caught up with you, not like it was
      // waiting behind the loading screen.
      window.setTimeout(() => this.deliverRadioLine(), 620);
    }, firstTime ? 900 : 700);
  }

  /**
   * The one thing the band has to say tonight, if it has anything.
   *
   * Silence is a valid outcome and happens often. Nothing here blocks: the
   * player can walk around the shelter while the voice talks, which is the
   * whole reason this is a strip along the bottom and not a modal.
   */
  private deliverRadioLine(): void {
    if (this.mode !== 'SHELTER' || this.radio.isOpen || this.menus.isOpen) return;

    const st = SaveSystem.getStats();
    const last = this.lastRun;

    const ctx: RadioContext = {
      runs: st.runs,
      deaths: st.deaths,
      clears: st.clears,
      bestSector: st.bestSector,
      totalKills: st.totalKills,
      scrap: SaveSystem.getScrap(),
      night: SaveSystem.getNightLevel(),
      last,
      seen: (id) => SaveSystem.hasHeardLine(id),
      heard: (caller) => SaveSystem.heardFrom(caller),
      leanedOn: (caller) => !!last?.callers.includes(caller),
      claimed: (id) => SaveSystem.hasClaimed(id)
    };

    const line = pickLine(ctx);
    if (!line) {
      this.nudgeBoard();
      return;
    }

    SaveSystem.markLineHeard(line.id, line.caller);
    this.audio.playSwell();
    this.radio.show(line, () => {
      this.interactLock = 0.25;
      this.lastTime = performance.now();
      this.nudgeBoard();
    });
  }

  /**
   * Points at the pin board when something on it is finished and unpaid.
   *
   * Deliberately a toast and not a marker on the board itself: the player has
   * to walk over and read which one it was, which is the only moment the list
   * gets read rather than skimmed.
   */
  private nudgeBoard(): void {
    if (this.mode !== 'SHELTER') return;
    const ready = readyCount(this.boardContext());
    if (ready <= 0) return;
    this.hud.showToast(ready === 1
      ? 'Something on the board is finished. Go and take it down.'
      : `${ready} cards on the board are finished.`);
  }

  /** Everything the pin board is allowed to ask about, read fresh each time. */
  private boardContext(): ProphecyContext {
    const st = SaveSystem.getStats();
    return {
      runs: st.runs,
      deaths: st.deaths,
      clears: st.clears,
      bestSector: st.bestSector,
      totalKills: st.totalKills,
      tally: SaveSystem.getTally(),
      metaRanks: SaveSystem.totalMetaRanks(),
      weaponsUnlocked: SaveSystem.unlockedWeaponCount(),
      modsFitted: SaveSystem.fittedModCount(),
      heard: (caller) => SaveSystem.heardFrom(caller),
      logHeard: logProgress((id) => SaveSystem.hasHeardLine(id)).heard,
      claimed: (id) => SaveSystem.hasClaimed(id)
    };
  }

  private claimProphecy(view: ProphecyView): void {
    if (view.state !== 'READY') return;
    SaveSystem.claimProphecy(view.prophecy.id, view.prophecy.reward);
    this.audio.playPurchase();
  }

  private openStation(station: Station): void {
    this.uiPaused = true;
    const close = () => {
      this.uiPaused = false;
      this.interactLock = 0.35;
      this.lastTime = performance.now();
    };

    switch (station.id) {
      case 'RACK':
        this.menus.showWeaponRack((id: WeaponId) => {
          this.player.setWeapon(id, SaveSystem.isModActive(id));
          this.hud.showToast(`Racked: ${this.player.weaponDef.name}`);
          close();
        }, close);
        break;

      case 'BENCH':
        this.menus.showWorkbench(close);
        break;

      case 'RADIO':
        this.menus.showRadio(close);
        break;

      case 'BOARD':
        this.menus.showList({
          context: () => this.boardContext(),
          claim: (view) => this.claimProphecy(view)
        }, close);
        break;

      case 'DOG': {
        // Not a menu — just a small, warm thing, and the one order he takes.
        this.uiPaused = false;
        this.interactLock = 1.2;
        const mood = this.shelter.petDog();
        this.audio.playPickup();
        this.particles.emitBurst(this.shelter.dogPosition, 8, HEX.amber, 3, 0.24);
        this.hud.showToast(mood === 'FOLLOW'
          ? 'Rook leans into it, then falls in at your heel.'
          : 'Rook goes back to his bed. He will be there when you get back.');
        break;
      }

      case 'DOOR':
        this.uiPaused = true;
        this.startRun();
        break;
    }
  }

  // ---------------------------------------------------------------------- run

  private startRun(): void {
    const meta = SaveSystem.getMeta();
    const rank = (key: string) => meta[key as keyof typeof meta] ?? 0;

    this.sectors.setNight(SaveSystem.getNightLevel());

    // Counted here rather than at the door, because his mood can still change
    // right up until the stairs and it is the mood you leave on that matters.
    if (this.shelter.dogMoodNow === 'FOLLOW') SaveSystem.bumpTally('dogRuns');

    this.loading.show(`Sector 01 — ${sectorFor(1).name}`, () => {
      this.mode = 'RUN';
      this.runKills = 0;
      this.runScore = 0;
      this.runScrap = 0;
      this.runStart = performance.now();
      this.streak = 0;
      this.streakTimer = 0;
      this.hitStop = 0;
      this.pendingBoon = null;
      this.pendingWorks = false;
      this.worksFitted.length = 0;
      this.goingHome = false;

      // Everything the doors will offer tonight is dealt off one seeded bag,
      // opened here — including the frequency the set was left on downstairs,
      // which buys the first voice outright.
      this.sectors.deck.beginRun(SaveSystem.getTuned());

      this.shelter.deactivate();
      this.props.setVisible(true);
      this.clearField();

      const weaponId = SaveSystem.getLastWeapon();
      this.player.beginRun({
        weaponId,
        weaponMod: SaveSystem.isModActive(weaponId),
        bonusHealth: rank('plating') * 12,
        bonusSpeed: rank('boots') * 0.55,
        fireRateBonus: rank('steadyHands') * 0.07,
        critBonus: rank('sharpEye') * 0.05,
        pickupBonus: rank('magnet') * 1.6,
        healBonus: rank('fieldMedic') * 0.4,
        extraGetUps: rank('secondWind')
      });

      SaveSystem.recordRunStart();

      this.sectors.setup(1);
      this.placePlayerAtSectorStart();
      this.buildSector(1);

      this.hud.setShelterMode(false);
      this.hud.setWeapon(this.player.weaponDef.name, this.player.weaponDef.model, this.player.weaponDef.alt.name);
      this.audio.startBackgroundMusic();

      this.uiPaused = false;
      this.interactLock = 0.4;
      this.lastTime = performance.now();
    }, 800);
  }

  private placePlayerAtSectorStart(): void {
    this.player.resetPositionAndVelocity(new THREE.Vector3(0, 0, 16));
    CAMERA_RIG.useField();
    this.cameraJuice.snapTo(this.player.position);
  }

  /** Sets up the world for a sector: lighting, boss, trader, optional crate. */
  private buildSector(sector: number): void {
    const info = this.render.applySector(sector, this.terrain);
    this.sectorName = info.name;
    this.props.setVisible(true);

    const night = this.sectors.night;
    const nightLabel = night.level > 0 ? `${night.name} — ×${night.scrapMult.toFixed(1)} scrap` : '';

    if (this.sectors.isBossSector) {
      this.render.applyBossLighting(this.terrain);
      this.boss.spawn(new THREE.Vector3(0, 2.6, -26), night.enemyHealth);
      this.hud.setBossBar(true, this.boss.health, this.boss.maxHealth);
      this.hud.setSector(sector, 'THE CORDON', 'Put the Behemoth down', nightLabel);
      this.hud.showBanner('THE BEHEMOTH', 'It has been growing since the cordon fell.', 3.6);
      this.sectorName = 'The Cordon';
    } else if (this.sectors.isTraderSector) {
      this.trader.activate(SaveSystem.getScrap());
      this.hud.setSector(sector, info.name, 'Trade with Vic, then move on', nightLabel);
      this.hud.showBanner('THE UNDERPASS', 'Vic is still here. Vic is always still here.', 3.2);
      // Nothing to kill here, so the street counts as finished the moment it
      // is built. Anything owed from the last gate still gets handed over
      // first. The player has already been set down at the mouth of the sector
      // by this point, which is what both the drop and the gates frame against.
      this.sectors.state = 'CLEARED';
      this.onStreetDone();
    } else {
      this.hud.setSector(sector, info.name, 'Clear the street', nightLabel);
      this.hud.showBanner(info.name, info.tagline, 3.2);

      // Every third sector hides a chained crate worth taking a risk over.
      if (sector % 3 === 2) {
        const angle = Math.random() * Math.PI * 2;
        this.cache.spawn(
          new THREE.Vector3(Math.cos(angle) * 22, 0, Math.sin(angle) * 22),
          10 + Math.floor(sector * 1.5)
        );
      }
    }
  }

  /**
   * Pays out what the gate's plaque promised. The offer object comes straight
   * from the door the player walked through, so the numbers on the sign and
   * the numbers in the toast are the same numbers.
   */
  private applyReward(offer: GateOffer): void {
    switch (offer.reward) {
      case 'SIGNAL':
        // Not paid at the door. It is paid on the far side of the next fight,
        // by hand, in the street — see onStreetDone.
        this.pendingBoon = offer.caller ?? 'ANY';
        this.hud.showToast(
          offer.caller
            ? `${CALLERS[offer.caller].name} is setting something out for you.`
            : 'Somebody is setting something out for you.'
        );
        break;

      case 'SUPPLIES':
        this.player.maxHealth += 15;
        this.player.heal(55);
        this.hud.showToast('Medical post: +15 max condition, patched up.');
        break;

      case 'SCRAP': {
        const amount = offer.amount || Math.round((45 + this.sectors.current * 12) * this.sectors.night.scrapMult);
        this.runScrap += amount;
        SaveSystem.addScrap(amount);
        this.audio.playScrap();
        this.hud.showToast(`Salvage yard: +${amount} scrap.`);
        break;
      }

      case 'ARSENAL':
        this.player.damageMultiplier *= 1.12;
        this.player.altCooldownMultiplier *= 0.9;
        this.hud.showToast('Arms cache: +12% damage, faster heavy attack.');
        break;

      case 'TRADE':
        this.hud.showToast('Vic is set up one street over.');
        break;

      case 'WORKBENCH':
        // Paid the instant the street loads, not after it is cleared.
        this.pendingWorks = true;
        break;

      default:
        break;
    }
  }

  /** Which survivor the player has leaned on most — biases the next offer. */
  private favouredCaller(): Caller | undefined {
    let best: Caller | undefined;
    let bestCount = 0;
    for (const b of this.player.getActiveBuffList()) {
      if (b.count > bestCount) {
        bestCount = b.count;
        best = b.id as Caller;
      }
    }
    return bestCount >= 2 ? best : undefined;
  }

  // ------------------------------------------------------------- the payoff

  /**
   * The street is finished. What happens next is the shape of the whole loop.
   *
   * If a gate promised somebody's help, that promise is now a case lying in the
   * road, and the way out stays shut until it has been picked up. Opening the
   * gates in the same beat would let a player walk out of the sector leaving
   * the thing they chose it for in the dirt — and would put the choice of a
   * favour and the choice of a door on screen at the same moment, which is two
   * decisions competing for one held breath.
   */
  private onStreetDone(): void {
    if (this.pendingBoon) {
      const host = this.pendingBoon;
      this.pendingBoon = null;
      this.dropSignal(host);
      return;
    }
    this.openTheWayOut();
  }

  private openTheWayOut(): void {
    // After the Behemoth the two gates mean something different, so the boss
    // case has to be decided here.
    if (this.sectors.isBossSector) {
      this.openBossGates();
      this.hud.showBanner('THE ROAD FORKS', 'One way home. One way deeper.', 3.4);
    } else {
      this.sectors.openGates(this.player.position, this.favouredCaller());
      this.hud.setObjective('Street is clear — read the gates, pick one');
      this.hud.showBanner('STREET CLEAR', 'Two ways out. They are signed.', 2.8);
    }
    this.audio.playGateOpen();
  }

  /** Sets the promised case down a few paces up the street from the player. */
  private dropSignal(host: Caller | 'ANY'): void {
    const caller = host === 'ANY' ? null : host;

    // Framed rather than dropped underfoot: far enough up the screen to be a
    // thing you walk to, close enough that it is never a hike.
    CAMERA_RIG.framePoint(0, 2.6, tmpFrame);
    tmpSignal.set(this.player.position.x + tmpFrame.x, 0, this.player.position.z + tmpFrame.y);
    const r = Math.hypot(tmpSignal.x, tmpSignal.z);
    if (r > ARENA_RADIUS - 3) {
      const s = (ARENA_RADIUS - 3) / r;
      tmpSignal.x *= s;
      tmpSignal.z *= s;
    }

    this.signalDrop.spawn(tmpSignal, caller);
    this.audio.playGateOpen();
    this.particles.emitBurst(tmpSignal, 18, HEX.amber, 6, 0.7);

    const who = caller ? CALLERS[caller].name : 'SOMEBODY';
    this.hud.showBanner('STREET CLEAR', `${who} left something in the road.`, 3.0);
    this.hud.setObjective(caller ? `Pick up what ${CALLERS[caller].name} left` : 'Pick up what was left for you');
  }

  /**
   * The player has walked onto it. Voice first, cards second: the favour is
   * being handed over by a person, and the menu is only how it gets chosen.
   */
  private claimSignal(): void {
    const caller = this.signalDrop.caller;
    this.signalDrop.deactivate();

    this.audio.playSwell();
    this.particles.emitBurst(this.player.position, 26, HEX.amber, 8, 0.8);
    this.cameraJuice.addTrauma(0.14);
    this.hud.hidePrompt();

    this.uiPaused = true;
    if (caller) this.radio.show(pickSignalOffer(caller), () => this.offerSignal(caller));
    else this.offerSignal();
  }

  /** `host` is whoever the gate promised; without one the draw is mixed. */
  private offerSignal(host?: Caller): void {
    this.uiPaused = true;
    const offers = generateBoons(this.sectors.current, this.favouredCaller(), host);
    this.boons.show(offers, (boon: Boon) => {
      applyBoon(boon, this.player);
      // Taking it — not being offered it — is what puts a survivor in the run's
      // band, and the fourth one closes it.
      this.sectors.deck.noteBoon(boon.caller);
      this.hud.showToast(`${boon.title} — ${boon.tier.toLowerCase()}`);
      this.audio.playPickup();
      this.uiPaused = false;
      this.lastTime = performance.now();
      // Only now is the street actually over.
      this.openTheWayOut();
    });
  }

  /**
   * Somebody's garage, roller door half up, the vice still tight.
   *
   * Opened the moment the street the gate led to has finished loading, so the
   * gun is reworked before the first shambler is on screen rather than after
   * the fight it was meant to change. Nothing is dropped in the road for this
   * one: the tools do not travel.
   */
  private openWorkbench(): void {
    const works = pickFieldWorks(
      this.player.weaponId,
      this.worksFitted,
      () => this.sectors.deck.random(),
      3
    );

    // Only reachable if a weapon ever runs out of bench work, which the two-per
    // -run cap makes impossible today. Still not worth freezing the game over.
    if (works.length === 0) {
      this.hud.showToast('The bench has been stripped. Nothing here fits your gun.');
      return;
    }

    this.uiPaused = true;
    this.audio.playSwell();
    this.hud.showBanner('THE WORKBENCH', 'Whoever owned these tools is not coming back for them.', 3.0);

    this.boons.showWorks(works, this.player.weaponDef.name, (work) => {
      work.apply(this.player.weapon, this.player);
      this.worksFitted.push(work.id);
      this.hud.showToast(`${work.name} — fitted.`);
      this.audio.playPickup();
      this.particles.emitBurst(this.player.position, 20, HEX.smoke, 7, 0.6);
      this.uiPaused = false;
      this.lastTime = performance.now();
    });
  }

  private endRun(survived: boolean, cause: string): void {
    if (this.mode !== 'RUN') return;
    this.mode = 'DEBRIEF';
    this.uiPaused = true;

    this.audio.stopBackgroundMusic();
    this.sectors.clearFade();
    this.hud.setShelterMode(true);
    this.hud.hidePrompt();

    SaveSystem.recordRunEnd(this.sectors.current, this.runKills, this.runScore, survived);

    // Snapshotted before the field is cleared, because the buff list lives on
    // the player and the player is about to be reset for the shelter.
    this.lastRun = {
      survived,
      sector: this.sectors.current,
      kills: this.runKills,
      callers: this.player.getActiveBuffList()
        .slice()
        .sort((a, b) => b.count - a.count)
        .map((b) => b.id as Caller),
      night: SaveSystem.getNightLevel()
    };

    // Board counters that can only be settled once the run is over.
    if (this.lastRun.callers.length >= 5) SaveSystem.bumpTally('fullBandRuns');
    if (!this.lastRun.callers.includes('QUIET')) SaveSystem.recordCleanDepth(this.lastRun.sector);

    this.menus.showRunEnd({
      survived,
      cause,
      sector: this.sectors.current,
      sectorName: this.sectorName,
      kills: this.runKills,
      scrapEarned: this.runScrap,
      duration: (performance.now() - this.runStart) / 1000,
      weapon: this.player.weaponDef.name,
      seed: this.sectors.deck.seedLabel
    }, () => this.enterShelter(false));
  }

  /** Recycles every transient thing in the world. */
  private clearField(): void {
    this.enemies.recycleAllActive((e) => e.deactivate());
    this.bullets.recycleAllActive((b) => b.deactivate());
    this.drops.recycleAllActive((d) => d.deactivate());
    this.flares.recycleAllActive((f) => f.deactivate());
    this.telegraphs.length = 0;
    this.grid.clear();

    this.boss.deactivate();
    this.trader.deactivate();
    this.cache.deactivate();
    this.signalDrop.deactivate();
    this.instProjectiles.hideAll();
    this.instPickups.hideAll();

    this.hud.setBossBar(false);
    this.hud.setCacheTimer(false);
  }

  // ------------------------------------------------------------------ combat

  private spawnFromEdge(): void {
    if (this.sectors.remainingSpawns() <= 0) return;

    const type = this.sectors.nextSpawnType();
    const p = this.player.position;

    let x = 0;
    let z = 0;
    for (let i = 0; i < 14; i++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = 17 + Math.random() * 16;
      x = p.x + Math.cos(angle) * distance;
      z = p.z + Math.sin(angle) * distance;

      // Keep spawns inside the fence and never right on top of the player.
      if (Math.hypot(x, z) < ARENA_RADIUS - 4 && Math.hypot(x - p.x, z - p.z) > 12) break;
    }

    tmpSpawn.set(x, this.terrain.getHeightAt(x, z), z);
    this.particles.emitTelegraphRing(tmpSpawn, 0.45, HEX.bloodDark);
    this.telegraphs.push({ pos: tmpSpawn.clone(), type, timer: 0.45 });
  }

  private firePrimary(): void {
    if (this.player.primaryCooldown > 0) return;

    const w = this.player.weapon;
    this.player.primaryCooldown = w.cooldown * this.player.fireRateMultiplier;

    const muzzle = this.player.getMuzzlePos().clone();
    tmpDir.copy(this.input.aimPoint).sub(muzzle).setY(0);
    if (tmpDir.lengthSq() === 0) tmpDir.set(0, 0, -1);
    tmpDir.normalize();

    this.player.triggerRecoil();
    this.cameraJuice.addTrauma(w.trauma);

    const kind = this.player.weaponId === 'BOOMSTICK' || this.player.weaponId === 'WIDOWMAKER' ? 'heavy'
      : this.player.weaponId === 'STUTTER' ? 'light'
      : this.player.weaponId === 'HARVESTER' ? 'nail'
      : 'medium';
    this.audio.playGunshot(kind);

    const pierce = w.pierce + this.player.bonusPierce;
    const speed = w.bulletSpeed * this.player.bulletSpeedMultiplier;

    for (let i = 0; i < w.pellets; i++) {
      // Spread the pellets evenly across the cone, then jitter, so a shotgun
      // pattern is consistent instead of occasionally clumping into nothing.
      const spread = w.pellets > 1
        ? (i / (w.pellets - 1) - 0.5) * w.spread + (Math.random() - 0.5) * w.spread * 0.2
        : (Math.random() - 0.5) * w.spread;

      const dir = tmpDir.clone().applyAxisAngle(UP, spread);
      const crit = Math.random() < this.player.critChance;
      const damage = Math.round(w.damage * this.player.damageMultiplier * (crit ? this.player.critMultiplier : 1));

      const p = this.bullets.get(muzzle, dir, speed, ProjectileType.PLAYER_BULLET, damage, {
        pierce,
        range: w.range,
        radius: 0.45
      });
      if (p) p.isCrit = crit;
    }
  }

  private fireAlt(): void {
    if (this.player.altCooldown > 0) return;

    const alt = this.player.weaponDef.alt;
    this.player.altCooldown = alt.cooldown * this.player.altCooldownMultiplier;

    const muzzle = this.player.getMuzzlePos().clone();
    tmpDir.copy(this.input.aimPoint).sub(muzzle).setY(0);
    if (tmpDir.lengthSq() === 0) tmpDir.set(0, 0, -1);
    tmpDir.normalize();

    this.player.triggerRecoil();
    this.cameraJuice.addTrauma(0.34);
    this.audio.playGunshot('heavy');

    const dmg = Math.round(alt.damage * this.player.damageMultiplier);

    switch (alt.kind) {
      case 'GRENADE':
      case 'NAILBOMB':
        this.bullets.get(muzzle, tmpDir, 24, ProjectileType.PLAYER_HEAVY, dmg, {
          blast: alt.radius,
          range: 34,
          radius: 0.75
        });
        break;

      case 'SLUG':
      case 'PIERCE':
        this.bullets.get(muzzle, tmpDir, 70, ProjectileType.PLAYER_BULLET, dmg, {
          pierce: 99,
          range: 60,
          radius: 0.7
        });
        break;

      case 'FANBLADE':
        for (let i = -2; i <= 2; i++) {
          const dir = tmpDir.clone().applyAxisAngle(UP, i * 0.16);
          this.bullets.get(muzzle, dir, 56, ProjectileType.PLAYER_BULLET, dmg, {
            pierce: 3,
            range: 30,
            radius: 0.5
          });
        }
        break;
    }
  }

  private throwFlare(): void {
    if (this.player.adrenaline < this.player.maxAdrenaline) return;
    this.player.adrenaline = 0;

    // Lands between the player and the cursor, capped so it cannot be dropped
    // on the far side of the arena.
    tmpAim.copy(this.input.aimPoint).setY(0).sub(this.player.position);
    tmpAim.y = 0;
    if (tmpAim.length() > 14) tmpAim.setLength(14);

    const landing = this.player.position.clone().add(tmpAim);
    landing.y = this.terrain.getHeightAt(landing.x, landing.z);

    this.flares.get(landing, 16 + this.sectors.current * 2, 260 + this.sectors.current * 30);
    SaveSystem.bumpTally('flaresLit');
    this.cameraJuice.addTrauma(0.2);
    this.hud.showToast('Flare down — it will pull them in before it goes.');
  }

  private onEnemyKilled(enemy: Enemy, hitPos?: THREE.Vector3): void {
    const x = enemy.position.x;
    const z = enemy.position.z;

    this.hitStop = Math.max(this.hitStop, 0.022);
    this.streak++;
    this.streakTimer = 2.4;

    const mult = Math.min(8, 1 + Math.floor(this.streak / 4));
    this.runScore += enemy.scoreValue * mult;
    this.runKills++;
    this.player.addAdrenaline(5.5);

    if (this.streak === 5) this.hud.showStreak('FIVE DOWN');
    else if (this.streak === 12) this.hud.showStreak('TWELVE');
    else if (this.streak === 25) this.hud.showStreak('TWENTY-FIVE');
    else if (this.streak === 50) this.hud.showStreak('FIFTY');

    if (this.player.lifestealChance > 0 && Math.random() < this.player.lifestealChance) {
      this.player.heal(this.player.lifestealAmount);
    }

    // Vasquez's rupture: the corpse harms whatever is standing next to it.
    if (this.player.burstChance > 0 && Math.random() < this.player.burstChance) {
      this.particles.emitBurst(enemy.position, 16, HEX.mossDark, 8, 0.5);
      const near = this.grid.query(enemy.position, 4.5);
      for (const other of near) {
        if (other === enemy || !other.active) continue;
        if (other.takeDamage(45, enemy.position)) this.onEnemyKilled(other);
      }
    }

    if (this.cache.isTriggered && this.cache.addKill()) {
      const reward = Math.round(120 * this.sectors.night.scrapMult);
      this.runScrap += reward;
      SaveSystem.addScrap(reward);
      this.audio.playScrap();
      this.hud.showToast(`Crate open — ${reward} scrap and a dressing.`);
      tmpDrop.set(this.cache.position.x, 0.3, this.cache.position.z + 1.4);
      this.drops.get(tmpDrop, PickupType.BANDAGE, 45);
    }

    this.particles.emitBurst(hitPos ?? enemy.position, 12, HEX.gore, 7, 0.42);

    // Salvage: scrap always, plus the occasional dressing or stim.
    const scrapCount = enemy.scrapValue;
    for (let i = 0; i < scrapCount; i++) {
      tmpDrop.set(x + (Math.random() - 0.5) * 1.1, 0.3, z + (Math.random() - 0.5) * 1.1);
      this.drops.get(tmpDrop, PickupType.SCRAP, 1);
    }

    const medicRank = SaveSystem.getRank('fieldMedic');
    const roll = Math.random();
    if (roll < 0.055 + medicRank * 0.015) {
      tmpDrop.set(x, 0.3, z);
      this.drops.get(tmpDrop, PickupType.BANDAGE, 32);
    } else if (roll < 0.1) {
      tmpDrop.set(x, 0.3, z);
      this.drops.get(tmpDrop, PickupType.STIM, 22);
    }

    enemy.deactivate();
  }

  private onBossKilled(): void {
    this.hud.setBossBar(false);
    this.audio.playSectorClear();
    this.particles.emitExplosion(this.boss.position, 16, HEX.gore);
    this.cameraJuice.addTrauma(0.9);
    this.runScore += 5000;

    const bounty = Math.round(300 * this.sectors.night.scrapMult);
    this.runScrap += bounty;
    SaveSystem.addScrap(bounty);
    SaveSystem.bumpTally('bossKills');

    this.hud.showBanner('THE BEHEMOTH IS DOWN', `+${bounty} scrap. Now choose.`, 4.0);
  }

  /** After the boss, one gate goes home and one goes deeper. */
  private openBossGates(): void {
    this.sectors.openBossGates(this.player.position);
    this.hud.setObjective('One gate banks the run. The other has a voice on it.');
  }

  private resolveCollisions(delta: number): void {
    const active = this.bullets.getActiveItems();

    for (let i = active.length - 1; i >= 0; i--) {
      const b = active[i];
      if (!b || !b.active) continue;

      if (b.type === ProjectileType.ENEMY_BILE) {
        if (ArcadePhysics.checkSphereOverlap(b.position, b.radius, this.player.position, this.player.radius)) {
          this.player.takeDamage(b.damage);
          this.particles.emitBurst(b.position, 8, HEX.mossDark, 5, 0.3);
          b.deactivate();
        }
        continue;
      }

      const isCrit = b.isCrit;
      const heavy = b.type === ProjectileType.PLAYER_HEAVY;

      // Boss first — it is a single large target and cheap to test.
      if (this.boss.active && ArcadePhysics.checkSphereOverlap(b.position, b.radius, this.boss.position, this.boss.radius)) {
        if (heavy) {
          this.detonate(b);
        } else {
          const killed = this.boss.takeDamage(b.damage, b.position);
          this.hud.spawnDamageNumber(b.position, b.damage, isCrit);
          this.hud.setBossBar(true, this.boss.health, this.boss.maxHealth);
          this.audio.playImpact();
          if (killed) this.onBossKilled();
          b.deactivate();
        }
        continue;
      }

      const candidates = this.grid.query(b.position, 3.0);
      for (let j = 0; j < candidates.length; j++) {
        const e = candidates[j];
        if (!e || !e.active || b.hitIds.has(e.id)) continue;
        if (!ArcadePhysics.checkSphereOverlap(b.position, b.radius, e.position, e.radius)) continue;

        if (heavy) {
          this.detonate(b);
          break;
        }

        b.hitIds.add(e.id);
        const killed = e.takeDamage(b.damage, b.position);
        this.hud.spawnDamageNumber(e.position, b.damage, isCrit);

        if (killed) this.onEnemyKilled(e, b.position);

        // A round only survives the hit if it has pierce left.
        if (b.pierceLeft > 0) {
          b.pierceLeft--;
        } else {
          b.deactivate();
          break;
        }
      }
    }

    // Bodies pressing on the player.
    const near = this.grid.query(this.player.position, this.player.radius + 2.6);
    for (const e of near) {
      if (!e.active) continue;

      ArcadePhysics.resolveSoftOverlap(
        e.position, e.velocity, this.player.position, e.radius, this.player.radius, 11.0);

      if (ArcadePhysics.checkSphereOverlap(this.player.position, this.player.radius, e.position, e.radius)) {
        this.player.takeDamage(e.contactDamage);
      }
    }

    if (this.boss.active &&
        ArcadePhysics.checkSphereOverlap(this.player.position, this.player.radius, this.boss.position, this.boss.radius)) {
      this.player.takeDamage(26);
    }

    // Salvage.
    const loot = this.drops.getActiveItems();
    for (let i = loot.length - 1; i >= 0; i--) {
      const p = loot[i];
      if (!p.active) continue;

      p.update(delta, this.player.position, this.player.pickupRadius);
      if (this.player.position.distanceToSquared(p.position) > 1.44) continue;

      if (p.type === PickupType.SCRAP) {
        const scavenger = 1 + SaveSystem.getRank('scavenger') * 0.15;
        const gained = Math.max(1, Math.round(p.value * scavenger * this.sectors.night.scrapMult));
        this.runScrap += gained;
        SaveSystem.addScrap(gained);
        this.audio.playScrap();
      } else if (p.type === PickupType.BANDAGE) {
        this.player.heal(p.value);
      } else if (p.type === PickupType.STIM) {
        this.player.addAdrenaline(p.value);
        this.audio.playPickup();
      }
      p.deactivate();
    }
  }

  /** Heavy ordnance blast: hits everything in radius once. */
  private detonate(b: Projectile): void {
    const centre = b.position.clone();
    const radius = b.blastRadius || 8;

    this.audio.playExplosion();
    this.cameraJuice.addTrauma(0.4);
    this.particles.emitExplosion(centre, radius, 0xd2622a);

    for (const e of this.grid.query(centre, radius)) {
      if (!e.active) continue;
      if (e.takeDamage(b.damage, centre)) this.onEnemyKilled(e, centre);
    }

    if (this.boss.active && ArcadePhysics.checkSphereOverlap(centre, radius, this.boss.position, this.boss.radius)) {
      const killed = this.boss.takeDamage(b.damage, centre);
      this.hud.setBossBar(true, this.boss.health, this.boss.maxHealth);
      if (killed) this.onBossKilled();
    }

    b.deactivate();
  }

  // ------------------------------------------------------------------ frames

  private updateShelter(delta: number): void {
    this.shelter.update(delta, this.player.position);

    if (this.uiPaused) return;

    this.player.update(delta, this.render.camera, true);
    this.shelter.constrain(this.player);
    this.cameraJuice.update(delta, this.player.position);

    if (this.interactLock > 0) this.interactLock -= delta;

    const station = this.shelter.stationAt(this.player.position);
    if (station) {
      this.hud.showPrompt(station.label, station.hint);
      if (this.input.justInteracted && this.interactLock <= 0) {
        this.hud.hidePrompt();
        this.openStation(station);
      }
    } else {
      this.hud.hidePrompt();
    }
  }

  private updateRun(delta: number): void {
    if (this.sectors.isFading) {
      this.sectors.updateTransition(delta);
      this.cameraJuice.update(delta, this.player.position);
      this.particles.update(delta);
      return;
    }

    if (this.uiPaused) return;
    if (this.interactLock > 0) this.interactLock -= delta;

    const active = this.enemies.getActiveItems();

    this.grid.clear();
    for (const e of active) this.grid.insert(e);

    // Spawn telegraphs.
    for (let i = this.telegraphs.length - 1; i >= 0; i--) {
      const t = this.telegraphs[i];
      t.timer -= delta;
      if (t.timer > 0) continue;
      this.enemies.get(t.pos, t.type, this.sectors.difficulty);
      this.particles.emitBurst(t.pos, 8, HEX.dirt, 4, 0.3);
      this.telegraphs.splice(i, 1);
    }

    if (this.sectors.state === 'COMBAT') {
      const pending = active.length + this.telegraphs.length;
      if (this.sectors.remainingSpawns() > 0 && pending < 34) {
        this.sectors.spawnTimer += delta;
        // Trickle normally, but top up fast if the street has gone quiet.
        if (this.sectors.spawnTimer >= 0.85 || pending < 7) {
          this.sectors.spawnTimer = 0;
          const batch = pending < 7 ? 4 : 2;
          for (let i = 0; i < batch; i++) this.spawnFromEdge();
        }
      }
      // Written before the clear check, which swaps in its own objective text.
      this.hud.setObjective(
        this.sectors.isBossSector
          ? 'Put the Behemoth down'
          : `Still moving: ${active.length + this.sectors.remainingSpawns()}`
      );
      this.sectors.checkCleared(active.length, this.boss.active);
    }

    if (this.sectors.state === 'CHOOSING_GATE') {
      this.sectors.checkGateEntry(this.player.position);
    }
    this.sectors.updateGates(delta);

    // What the last gate promised, waiting in the road.
    if (this.signalDrop.active) {
      this.signalDrop.update(delta);
      if (this.signalDrop.checkPlayerCollision(this.player.position)) this.claimSignal();
    }

    // Player.
    this.player.update(delta, this.render.camera, true);

    // Circular arena wall.
    const distFromCentre = Math.hypot(this.player.position.x, this.player.position.z);
    if (distFromCentre > ARENA_RADIUS) {
      const s = ARENA_RADIUS / distFromCentre;
      this.player.position.x *= s;
      this.player.position.z *= s;
      this.player.group.position.copy(this.player.position);
    }

    // Firing.
    const wantsFire = this.player.weaponDef.auto ? this.input.isMouseDown : this.input.justClicked;
    if (wantsFire) this.firePrimary();
    if (this.input.isRightMouseDown) this.fireAlt();
    if (this.input.justShoved) {
      if (!this.player.shove(active)) this.audio.playError();
    }
    if (this.input.justFiredUlt) this.throwFlare();

    // Once the street is nearly empty, whatever is left stops playing keep-away.
    const mopUp = this.sectors.remainingSpawns() === 0 && active.length <= 4;

    // Enemies.
    for (const e of active) {
      if (!e.active) continue;
      e.pressAttack = mopUp;
      e.updateAI(
        delta,
        this.frame,
        this.player.position,
        this.grid,
        (origin, dir) => {
          this.bullets.get(origin, dir, 17, ProjectileType.ENEMY_BILE, 14, { range: 40, radius: 0.5 });
        },
        (burster) => this.burstOpen(burster)
      );
    }

    // Projectiles.
    for (const b of this.bullets.getActiveItems()) b.update(delta);

    // Flares.
    for (const f of this.flares.getActiveItems()) {
      f.update(delta, active, (e) => this.onEnemyKilled(e));
    }

    // Boss.
    if (this.boss.active) {
      this.boss.update(
        delta,
        this.player.position,
        (origin, dir) => {
          this.bullets.get(origin, dir, 15, ProjectileType.ENEMY_BILE, 17, { range: 46, radius: 0.55 });
        },
        (pos) => {
          for (let i = 0; i < 3; i++) this.enemies.get(pos, EnemyType.SPRINTER, this.sectors.difficulty);
        },
        (damage) => this.player.takeDamage(damage)
      );
    }

    // Trader.
    if (this.trader.active) {
      this.trader.update(delta, this.player);
      const offer = this.trader.goodAt(this.player.position);
      if (offer) {
        const affordable = SaveSystem.getScrap() >= offer.good.cost;
        this.hud.showPrompt(
          offer.good.name,
          affordable ? `${offer.good.effect} — ${offer.good.cost} scrap` : `Not enough scrap (${offer.good.cost} needed)`
        );
        if (this.input.justInteracted && this.interactLock <= 0) {
          this.interactLock = 0.4;
          if (affordable && SaveSystem.spendScrap(offer.good.cost)) {
            offer.good.apply(this.player);
            SaveSystem.bumpTally('traderSpend', offer.good.cost);
            this.trader.markSold(offer.index);
            this.trader.refreshTags(SaveSystem.getScrap());
            this.audio.playPurchase();
            this.hud.showToast(`Traded for ${offer.good.name}.`);
          } else {
            this.audio.playError();
            this.hud.showToast('Vic shakes his head. Not enough scrap.');
          }
        }
      } else {
        this.hud.hidePrompt();
      }
    }

    // Supply cache.
    if (this.cache.active) {
      this.cache.update(delta);

      if (!this.cache.isTriggered && !this.cache.isOpen && !this.cache.failed) {
        if (this.player.position.distanceToSquared(this.cache.position) < 9) {
          this.hud.showPrompt('Chained Crate', `Break the lock — ${this.cache.required} kills in ${this.cache.duration}s`);
          if (this.input.justInteracted && this.interactLock <= 0) {
            this.interactLock = 0.4;
            this.cache.trigger();
            this.audio.playGateOpen();
            this.hud.hidePrompt();
            this.hud.showBanner('THE LOCK GIVES', 'And every dead thing on this street heard it.', 2.6);
            // The noise brings company.
            for (let i = 0; i < 6; i++) this.spawnFromEdge();
          }
        } else if (!this.trader.active) {
          this.hud.hidePrompt();
        }
      }

      this.hud.setCacheTimer(this.cache.isTriggered, this.cache.kills, this.cache.required, Math.max(0, this.cache.timeLeft));
      if (this.cache.failed) {
        this.hud.setCacheTimer(false);
        this.hud.showToast('The timer beat you. The crate stays shut.');
        this.cache.deactivate();
      } else if (this.cache.isOpen) {
        this.hud.setCacheTimer(false);
        this.cache.deactivate();
      }
    }

    if (!this.trader.active && !this.cache.active) this.hud.hidePrompt();

    this.resolveCollisions(delta);

    this.instProjectiles.render(this.bullets.getActiveItems(), performance.now() / 1000);
    this.instPickups.render(this.drops.getActiveItems(), performance.now() / 1000);

    this.cameraJuice.update(delta, this.player.position);
    this.render.followSun(this.player.position);
  }

  /** A Burster going off: damages the player and everything near it. */
  private burstOpen(burster: Enemy): void {
    const pos = burster.position.clone();
    this.audio.playExplosion();
    this.cameraJuice.addTrauma(0.45);
    this.particles.emitExplosion(pos, 5.5, 0x9aa84a);

    if (ArcadePhysics.checkSphereOverlap(pos, 5.0, this.player.position, this.player.radius)) {
      this.player.takeDamage(30);
    }

    for (const other of this.grid.query(pos, 5.5)) {
      if (!other.active || other === burster) continue;
      if (other.takeDamage(110, pos)) this.onEnemyKilled(other, pos);
    }
  }

  private update(delta: number): void {
    this.frame++;
    this.input.update();

    if (this.input.justMuted) {
      const on = this.audio.toggleMute();
      this.hud.setMuteState(on);
      this.hud.showToast(on ? 'Sound on' : 'Sound off');
    }

    if (this.hitStop > 0) {
      this.hitStop -= delta;
      this.input.clearFrameState();
      return;
    }

    if (this.streakTimer > 0) {
      this.streakTimer -= delta;
      if (this.streakTimer <= 0) this.streak = 0;
    }

    if (this.mode === 'RUN') {
      if (this.input.justToggledPause && !this.uiPaused) {
        this.uiPaused = true;
        this.menus.showPause(
          () => { this.uiPaused = false; this.lastTime = performance.now(); },
          () => this.endRun(false, 'You turned back')
        );
      }

      if (this.input.justToggledCodex) {
        if (this.codex.isOpen) {
          this.codex.hide();
        } else if (!this.uiPaused) {
          this.uiPaused = true;
          this.codex.show(this.player, {
            sector: this.sectors.current,
            sectorName: this.sectorName,
            kills: this.runKills,
            score: this.runScore,
            scrapEarned: this.runScrap,
            nightName: this.sectors.night.name
          }, () => { this.uiPaused = false; this.lastTime = performance.now(); });
        }
      }

      this.updateRun(delta);
    } else if (this.mode === 'SHELTER') {
      this.updateShelter(delta);
    }

    // HUD. Notices age out everywhere; the rest is combat readout only.
    this.hud.tickNotices(delta);

    if (this.mode === 'RUN') {
      this.hud.update(delta, {
        health: this.player.health,
        maxHealth: this.player.maxHealth,
        stamina: this.player.stamina,
        maxStamina: this.player.maxStamina,
        adrenaline: this.player.adrenaline,
        maxAdrenaline: this.player.maxAdrenaline,
        getUps: this.player.getUpsRemaining,
        maxGetUps: this.player.maxGetUps
      }, SaveSystem.getScrap(), this.runKills, {
        alt: this.player.altCooldown,
        shove: this.player.shoveCooldown,
        flareReady: this.player.adrenaline >= this.player.maxAdrenaline
      });

      this.hud.drawMinimap(
        delta,
        this.player.position,
        this.enemies.getActiveItems(),
        this.sectors.gates.map((g) => g.position),
        this.boss.active ? this.boss.position : null
      );
      this.hud.updateDamageNumbers(delta, this.render.camera);
    }

    this.hud.updateCrosshair(this.input.rawMouseX, this.input.rawMouseY, this.mode === 'RUN' && !this.uiPaused);

    this.particles.update(delta);
    this.input.clearFrameState();
  }

  private loop(now: number): void {
    const raw = (now - this.lastTime) / 1000;
    this.lastTime = now;
    // Clamped so a tab-out does not teleport everything through walls.
    const delta = Math.min(Math.max(raw, 0.001), 0.033);

    try {
      this.update(delta);
    } catch (err) {
      console.warn('Recovered from an error in the update loop:', err);
    }

    try {
      this.render.render();
    } catch (err) {
      console.warn('Recovered from an error while rendering:', err);
    }

    requestAnimationFrame((t) => this.loop(t));
  }
}
