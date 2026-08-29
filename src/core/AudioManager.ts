import * as THREE from 'three';
import { CAMERA_RIG } from '../graphics/CameraRig';

/** Where a world sound is. Only the ground plane matters — the rig is fixed. */
export interface SoundAt {
  x: number;
  z: number;
}

/**
 * How far a sound has to be before it is half of itself.
 *
 * The curve is `1 / (1 + (d/HALF)^2)`, which is an inverse square with the
 * singularity taken out. At ten metres a body is at a quarter, at thirty-four
 * — about the far corner of the frame — it is at eight per cent.
 *
 * Eight per cent and not zero, on purpose. A sprinter coming in from outside
 * the frame is the sound this whole phase exists for: half of the pressure in
 * this game is hearing something before the camera shows it to you. What gets
 * cut is only what has fallen under `AUDIBLE_FLOOR`, and that is a node-count
 * decision rather than a mix one.
 */
const DISTANCE_HALF = 10;
const AUDIBLE_FLOOR = 0.02;

/**
 * The rooms, as three numbers each.
 *
 * The light rule has a sound rule beside it now. A boarded-up basement and an
 * open street were coming out of the speakers identically, which is the one
 * thing a game about walking from one kind of place to another cannot afford.
 *
 * `decay` is how long the tail runs, `tone` how much of the top survives it
 * (a bright room is a hard room), `predelay` the gap before the first
 * reflection comes back — which is the whole difference between a close wall
 * and a far one. All three are guesses; the ear sets them.
 */
export type SpaceId = 'STREET' | 'UNDERPASS' | 'BASEMENT';

const SPACES: Record<SpaceId, { decay: number; tone: number; predelay: number }> = {
  // Open ground. Something comes back, but late and thin.
  STREET: { decay: 0.9, tone: 0.65, predelay: 0.012 },
  // Under the bridge. Long, dark, and the wall is a way off.
  UNDERPASS: { decay: 1.8, tone: 0.3, predelay: 0.035 },
  // The shelter. Small, close, and dead — boards eat everything.
  BASEMENT: { decay: 0.35, tone: 0.22, predelay: 0.004 }
};

/**
 * How much of each kind of sound is allowed into the room.
 *
 * Not one number for everything, because the interface is the thing that gives
 * it away: a menu click with a tail on it makes a game sound cheap faster than
 * any amount of bad synthesis. Guns take the most — a report is mostly what
 * the street did with it — bodies take some, and anything the player pressed a
 * button to hear takes none at all.
 */
const WET_GUN = 0.38;
const WET_BLAST = 0.5;
const WET_BODY = 0.2;
const WET_VOICE = 0.28;
const WET_STEP = 0.15;

/** Scratch for the world-to-screen trip, so panning allocates nothing. */
const tmpPan = new THREE.Vector2();

/**
 * How far a single firing is allowed to drift from the written number.
 *
 * The point is not that anyone notices the drift — it is that nobody notices
 * the repetition. The Ranger puts out 8.7 rounds a second and every one of
 * them used to be the same sample played twice, which the ear reads as one
 * long buzz rather than as gunfire.
 *
 * These four are guesses and the first listening pass is what sets them. Too
 * much and the gun stops having a character; too little and it is the buzz
 * again.
 */
const VARY_FREQ = 0.06;
const VARY_GAIN = 0.08;
const VARY_TIME = 0.04;

/**
 * The slap-back gets a wider band than the rest. A reflection off the far side
 * of a street is the one number here with a real-world reason to move — you
 * are not standing in the same place twice — and 6% of 0.11 seconds is under
 * seven milliseconds, which is nothing.
 */
const VARY_DELAY = 0.15;

/** One number, jittered. `amount` is a fraction: 0.06 means ±6%. */
function vary(value: number, amount: number): number {
  return value * (1 + (Math.random() * 2 - 1) * amount);
}

export class AudioManager {
  private ctx: AudioContext | null = null;
  private enabled: boolean = true;
  public masterVolume: number = 0.3;
  private masterGain: GainNode | null = null;
  private bgGain: GainNode | null = null;
  private bgOsc1: OscillatorNode | null = null;
  private bgOsc2: OscillatorNode | null = null;
  private bgFilter: BiquadFilterNode | null = null;
  /** The second layer's own level, breathing under `getBeatPulse`. */
  private bgPulse: GainNode | null = null;

  private beatTime: number = 0;
  private beatRate: number = 0.55;

  /** The bed's root note. Long Night takes it down a fifth. See `setBedRoot`. */
  private bedRoot: number = 90;

  /** The room. One convolver, three buffers, swapped when the place changes. */
  private convolver: ConvolverNode | null = null;
  private wetGain: GainNode | null = null;
  private space: SpaceId = 'STREET';
  private irCache: Partial<Record<SpaceId, AudioBuffer>> = {};

  /** Where the ears are. Driven from the player every frame. */
  private listenerX: number = 0;
  private listenerZ: number = 0;

  constructor() {
    // AudioContext initialized on user interaction
  }

  private initCtx(): void {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(this.enabled ? this.masterVolume : 0, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);

        // One room for the whole game, sitting beside the dry path rather than
        // in it. A sound decides how much of itself to send; nothing is forced
        // through it, which is what keeps the interface out of the room.
        if (this.ctx.createConvolver) {
          this.convolver = this.ctx.createConvolver();
          this.wetGain = this.ctx.createGain();
          this.wetGain.gain.setValueAtTime(1, this.ctx.currentTime);
          this.convolver.connect(this.wetGain);
          this.wetGain.connect(this.masterGain);
          this.applySpace();
        }
      }
    } else if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setVolume(vol: number): void {
    this.masterVolume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx && this.enabled) {
      this.masterGain.gain.setValueAtTime(this.masterVolume, this.ctx.currentTime);
    }
  }

  public getVolume(): number {
    return this.masterVolume;
  }

  public toggleMute(): boolean {
    this.enabled = !this.enabled;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.enabled ? this.masterVolume : 0, this.ctx.currentTime);
    }
    return this.enabled;
  }

  public isMuted(): boolean {
    return !this.enabled;
  }

  /**
   * A slow swell between 0 and 1, running at whatever rate the pressure set.
   *
   * Written years before anything asked for it and never called. What asks for
   * it now is the bed's own second layer — the pulse is the bed breathing, and
   * the rate of the breath is the fight.
   */
  public getBeatPulse(delta: number = 0.033): number {
    this.beatTime += delta * this.beatRate;
    return Math.sin(this.beatTime * 2.6) * 0.5 + 0.5;
  }

  /**
   * What the bed is doing, driven by the fight rather than by a clock.
   *
   * This existed and was never called: the adaptive layer was designed, built
   * and then left disconnected, which is a thing worth naming rather than
   * quietly fixing. `pressure` is 0 to 1 and means the whole state of the
   * street at once — how many of them are up, and how little of the player is
   * left — because two dials that both mean "it is going badly" is one dial
   * with extra steps.
   *
   * Everything ramps over a second. A bed that snaps is a bed you hear, and
   * this one is meant to be noticed only when it stops.
   */
  public setPressure(pressure: number): void {
    if (!this.ctx || !this.bgFilter || !this.bgOsc1 || !this.bgOsc2 || !this.bgGain) return;

    const p = Math.max(0, Math.min(1, pressure));
    const t = this.ctx.currentTime + 1.0;

    // Opening the filter is the whole trick: same two oscillators, more of
    // them audible. It reads as the room getting closer rather than as music
    // arriving, which is what keeps this from being a soundtrack.
    this.bgFilter.frequency.exponentialRampToValueAtTime(250 + p * 550, t);
    this.bgOsc1.frequency.exponentialRampToValueAtTime(this.bedRoot * (1 + p * 0.16), t);
    this.bgOsc2.frequency.exponentialRampToValueAtTime(this.bedRoot * 0.5 * (1 + p * 0.09), t);
    this.bgGain.gain.exponentialRampToValueAtTime(0.045 + p * 0.055, t);

    // A pulse you feel before you count. Slow when it is quiet, and never fast
    // enough to be a rhythm — a rhythm is a promise the rest of the game does
    // not keep.
    this.beatRate = 0.55 + p * 1.15;
  }

  /**
   * The breath. Called every frame; everything else about the bed moves on a
   * one-second ramp and this is the one part that is allowed to be immediate,
   * because it is slow enough already.
   */
  public tickBed(delta: number): void {
    if (!this.ctx || !this.bgPulse) return;
    this.bgPulse.gain.setValueAtTime(0.3 + this.getBeatPulse(delta) * 0.7, this.ctx.currentTime);
  }

  /**
   * Drops the whole bed a fifth for the Long Night.
   *
   * The difficulty is a thing the player chooses at the board and then has no
   * way to hear. This is the cheapest possible way to say it back to them, and
   * it says it continuously rather than once.
   */
  public setBedRoot(hz: number): void {
    this.bedRoot = hz;
    if (!this.ctx || !this.bgOsc1 || !this.bgOsc2) return;
    const t = this.ctx.currentTime + 1.4;
    this.bgOsc1.frequency.exponentialRampToValueAtTime(hz, t);
    this.bgOsc2.frequency.exponentialRampToValueAtTime(hz * 0.5, t);
  }

  public startBackgroundMusic(): void {
    if (!this.enabled || this.bgOsc1) return;
    this.initCtx();
    if (!this.ctx || !this.masterGain) return;

    try {
      this.bgGain = this.ctx.createGain();
      this.bgGain.gain.setValueAtTime(0.06, this.ctx.currentTime);

      this.bgOsc1 = this.ctx.createOscillator();
      this.bgOsc2 = this.ctx.createOscillator();

      this.bgOsc1.type = 'sine';
      this.bgOsc2.type = 'triangle';

      this.bgOsc1.frequency.setValueAtTime(this.bedRoot, this.ctx.currentTime);
      this.bgOsc2.frequency.setValueAtTime(this.bedRoot * 0.5, this.ctx.currentTime);

      this.bgFilter = this.ctx.createBiquadFilter();
      this.bgFilter.type = 'lowpass';
      this.bgFilter.frequency.setValueAtTime(250, this.ctx.currentTime);

      this.bgPulse = this.ctx.createGain();
      this.bgPulse.gain.setValueAtTime(0.5, this.ctx.currentTime);
      this.bgPulse.connect(this.bgFilter);

      this.bgOsc1.connect(this.bgFilter);
      this.bgOsc2.connect(this.bgPulse);
      this.bgFilter.connect(this.bgGain);
      this.bgGain.connect(this.masterGain);

      this.bgOsc1.start();
      this.bgOsc2.start();
    } catch {
      // Audio context policy fallback
    }
  }
  public playPickup(): void {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx || !this.masterGain) return;

    [523.25, 659.25].forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, this.ctx!.currentTime + idx * 0.04);

      gain.gain.setValueAtTime(0.2, this.ctx!.currentTime + idx * 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx!.currentTime + idx * 0.04 + 0.12);

      osc.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(this.ctx!.currentTime + idx * 0.04);
      osc.stop(this.ctx!.currentTime + idx * 0.04 + 0.12);
    });
  }
  /**
   * Rebuilt on the primitives. It used to fill a fresh 0.3-second buffer with
   * random numbers on every blast — its own noise, its own allocation, and no
   * share in anything phase 1 did. Now it is a burst, the weight under it, and
   * the street answering a beat later.
   */
  public playExplosion(at?: SoundAt): void {
    this.noiseBurst({ duration: 0.32, volume: 0.35, startFreq: 900, endFreq: 45, q: 0.7, at, wet: WET_BLAST });
    this.thump(70, 26, 0.4, 0.34, 0, at, WET_BLAST);
    this.noiseBurst({ duration: 0.5, volume: 0.1, startFreq: 500, endFreq: 120, delay: 0.13, at, wet: WET_BLAST });
  }

  public playPlayerHurt(): void {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx || !this.masterGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.18);

    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.18);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.18);
  }
  public playPurchase(): void {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx || !this.masterGain) return;

    [523.25, 659.25, 783.99, 1046.50].forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, this.ctx!.currentTime + idx * 0.05);

      gain.gain.setValueAtTime(0.2, this.ctx!.currentTime + idx * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx!.currentTime + idx * 0.05 + 0.22);

      osc.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(this.ctx!.currentTime + idx * 0.05);
      osc.stop(this.ctx!.currentTime + idx * 0.05 + 0.22);
    });
  }

  public playError(): void {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx || !this.masterGain) return;

    [160, 120].forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, this.ctx!.currentTime + idx * 0.08);

      gain.gain.setValueAtTime(0.18, this.ctx!.currentTime + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx!.currentTime + idx * 0.08 + 0.08);

      osc.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(this.ctx!.currentTime + idx * 0.08);
      osc.stop(this.ctx!.currentTime + idx * 0.08 + 0.08);
    });
  }

  // =========================================================================
  // Gritty layer.
  //
  // The original palette was all clean sine chirps, which is most of why the
  // game sounded like an arcade cabinet. Real firearms and wet impacts are
  // filtered noise, so everything below is built from a shared noise buffer
  // instead.
  // =========================================================================

  /**
   * A room, made rather than loaded.
   *
   * Noise under an exponential decay is the oldest trick there is for this and
   * it holds up: what a tail actually is, to the ear, is a density falling off
   * at a rate. `tone` runs a one-pole low-pass along the way, so a dark room's
   * tail loses its top as it goes rather than starting dull — which is what a
   * tail does, because the high end is what a wall takes first.
   *
   * Fifteen lines and no files. The project has never shipped an audio asset
   * and this was not the place to start.
   */
  private buildIR(id: SpaceId): AudioBuffer | null {
    if (!this.ctx) return null;
    const cached = this.irCache[id];
    if (cached) return cached;

    const { decay, tone, predelay } = SPACES[id];
    const rate = this.ctx.sampleRate;
    const len = Math.max(1, Math.floor(rate * (decay + predelay)));
    const buf = this.ctx.createBuffer(2, len, rate);
    const gap = Math.floor(rate * predelay);

    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      let last = 0;
      for (let i = gap; i < len; i++) {
        const t = (i - gap) / (len - gap);
        // Two channels of independent noise is what makes a tail wide.
        const white = Math.random() * 2 - 1;
        last = last + tone * (white - last);
        data[i] = last * Math.pow(1 - t, 2.6);
      }
    }

    this.irCache[id] = buf;
    return buf;
  }

  private applySpace(): void {
    if (!this.convolver) return;
    const ir = this.buildIR(this.space);
    if (ir) this.convolver.buffer = ir;
  }

  /**
   * Which room the game is standing in. Called when the place changes, not
   * every frame — swapping a convolver's buffer is not free.
   */
  public setSpace(id: SpaceId): void {
    if (id === this.space) return;
    this.space = id;
    this.applySpace();
  }

  /** The player's position, in world units. Called once a frame. */
  public setListener(x: number, z: number): void {
    this.listenerX = x;
    this.listenerZ = z;
  }

  /**
   * Where a sound sits in the frame, and how much of it survives the walk.
   *
   * The rig is pinned at 45 degrees, so a sound's stereo position is its
   * offset from the player rotated onto the screen axes — the same trip the
   * minimap makes, through the same singleton, which is what stops the two
   * from ever disagreeing about which way is left. Normalising by half the
   * frame width means the edges of the pan are the edges of the screen: a body
   * hard left in the picture is hard left in the mix.
   */
  private place(at?: SoundAt): { pan: number; gain: number } {
    if (!at) return { pan: 0, gain: 1 };

    const dx = at.x - this.listenerX;
    const dz = at.z - this.listenerZ;
    CAMERA_RIG.toScreen(dx, dz, tmpPan);

    const half = Math.max(1, CAMERA_RIG.halfFrameWidth());
    const d = Math.hypot(dx, dz);

    return {
      pan: Math.max(-1, Math.min(1, tmpPan.x / half)),
      gain: 1 / (1 + (d / DISTANCE_HALF) * (d / DISTANCE_HALF))
    };
  }

  private noiseBuffer: AudioBuffer | null = null;

  private getNoise(): AudioBuffer | null {
    if (!this.ctx) return null;
    if (this.noiseBuffer) return this.noiseBuffer;

    const len = Math.floor(this.ctx.sampleRate * 1.2);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.noiseBuffer = buf;
    return buf;
  }

  /** One shaped burst of noise. The workhorse for everything percussive. */
  private noiseBurst(opts: {
    duration: number;
    volume: number;
    type?: BiquadFilterType;
    startFreq: number;
    endFreq?: number;
    q?: number;
    delay?: number;
    /** Where in the world it happened. Omitted means "at the ears". */
    at?: SoundAt;
    /**
     * How much of this goes into the room, 0 to 1. Zero by default, because
     * the sound that most needs no room is the interface, and a default that
     * has to be switched off is a default that gets left on.
     */
    wet?: number;
  }): void {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx || !this.masterGain) return;

    const buf = this.getNoise();
    if (!buf) return;

    const { pan, gain: reach } = this.place(opts.at);
    if (reach < AUDIBLE_FLOOR) return;

    // A delay of zero stays zero however it is jittered, which is what keeps
    // the shot itself on the trigger and moves only the layers behind it.
    const t0 = this.ctx.currentTime + vary(opts.delay ?? 0, VARY_DELAY);

    // One factor for both ends of the sweep: the filter is meant to travel the
    // same shape every time, just not from quite the same place. Two
    // independent rolls would change the character of the gun, not the take.
    const freqShift = vary(1, VARY_FREQ);
    const duration = vary(opts.duration, VARY_TIME);

    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = opts.type ?? 'lowpass';
    filter.Q.value = opts.q ?? 1;
    filter.frequency.setValueAtTime(opts.startFreq * freqShift, t0);
    if (opts.endFreq !== undefined) {
      filter.frequency.exponentialRampToValueAtTime(Math.max(30, opts.endFreq * freqShift), t0 + duration);
    }

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vary(opts.volume, VARY_GAIN) * reach, t0);
    gain.gain.exponentialRampToValueAtTime(0.0008, t0 + duration);

    src.connect(filter);
    filter.connect(gain);
    this.toOutput(gain, opts.at ? pan : null, opts.wet ?? 0);

    // bug.md #11. The buffer is 1.2 seconds of noise and every burst used to
    // read it from the top, so a burst of 0.07 seconds was not "some noise",
    // it was one particular seventieth of a second, over and over. Starting
    // somewhere else in the buffer costs one argument. `loop` is already on,
    // so a late start still has material to run into.
    src.start(t0, Math.random() * Math.max(0, buf.duration - duration));
    src.stop(t0 + duration + 0.02);
  }

  /** Low sine thump layered under a noise burst — gives a shot its weight. */
  private thump(freq: number, endFreq: number, duration: number, volume: number, delay = 0, at?: SoundAt, wet = 0): void {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx || !this.masterGain) return;

    const { pan, gain: reach } = this.place(at);
    if (reach < AUDIBLE_FLOOR) return;

    const t0 = this.ctx.currentTime + vary(delay, VARY_DELAY);
    const freqShift = vary(1, VARY_FREQ);
    const dur = vary(duration, VARY_TIME);

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq * freqShift, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq * freqShift), t0 + dur);

    gain.gain.setValueAtTime(vary(volume, VARY_GAIN) * reach, t0);
    gain.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);

    osc.connect(gain);
    this.toOutput(gain, at ? pan : null, wet);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  /**
   * Last hop to the master bus, through a panner if the sound has a place.
   *
   * Built per firing rather than pooled. A `StereoPannerNode` is cheap and
   * disconnects itself once nothing upstream is running; the sounds that would
   * make the count matter — thirty-four bodies talking — are capped where they
   * are made, not here.
   *
   * A null pan skips the node outright rather than passing zero: the player's
   * own gun, their boots and every interface sound belong dead centre and dry,
   * and a game where the menu click swings across the stereo field sounds
   * broken rather than spacious.
   */
  private toOutput(from: AudioNode, pan: number | null, wet: number = 0): void {
    if (!this.ctx || !this.masterGain) return;

    if (pan === null || !this.ctx.createStereoPanner) {
      from.connect(this.masterGain);
    } else {
      const panner = this.ctx.createStereoPanner();
      panner.pan.setValueAtTime(pan, this.ctx.currentTime);
      from.connect(panner);
      panner.connect(this.masterGain);
    }

    // The send is taken before the panner on purpose: a room does not have a
    // left and a right, it has a shape, and a tail that swings with its source
    // reads as a stereo effect rather than as a place.
    if (wet > 0 && this.convolver) {
      const send = this.ctx.createGain();
      send.gain.setValueAtTime(wet, this.ctx.currentTime);
      from.connect(send);
      send.connect(this.convolver);
    }
  }

  public playGunshot(kind: 'light' | 'medium' | 'heavy' | 'nail'): void {
    switch (kind) {
      case 'light': // machine pistol
        this.noiseBurst({ duration: 0.07, volume: 0.16, startFreq: 3200, endFreq: 600, q: 0.8, wet: WET_GUN });
        this.thump(150, 60, 0.05, 0.1);
        break;
      case 'heavy': // shotgun / bolt rifle
        this.noiseBurst({ duration: 0.26, volume: 0.34, startFreq: 2400, endFreq: 120, q: 0.6, wet: WET_GUN });
        this.thump(110, 32, 0.2, 0.3);
        // Slap-back off the buildings. It keeps its own hand-built delay as
        // well as the room: the room says where you are standing, this says
        // how wide the street is, and those are not the same statement.
        this.noiseBurst({ duration: 0.3, volume: 0.09, startFreq: 900, endFreq: 180, delay: 0.11, wet: WET_GUN });
        break;
      case 'nail': // compressed air
        this.noiseBurst({ duration: 0.1, volume: 0.16, type: 'bandpass', startFreq: 1800, endFreq: 3400, q: 3.5, wet: WET_GUN * 0.5 });
        break;
      default: // carbine
        this.noiseBurst({ duration: 0.13, volume: 0.24, startFreq: 3000, endFreq: 320, q: 0.7, wet: WET_GUN });
        this.thump(140, 45, 0.1, 0.18);
        this.noiseBurst({ duration: 0.22, volume: 0.06, startFreq: 800, endFreq: 200, delay: 0.09, wet: WET_GUN });
        break;
    }
  }

  /** Wet, dull — a round going into a body rather than a ping. */
  public playImpact(at?: SoundAt): void {
    this.noiseBurst({ duration: 0.06, volume: 0.12, startFreq: 520, endFreq: 140, q: 1.2, at, wet: WET_BODY });
  }

  /**
   * A body going down. Not an impact — the impact already played, and playing
   * it louder is how a kill stops meaning anything.
   *
   * A short wet crack and then the weight arriving on the road. Chain kills
   * have had their bite drawn in hit-stop since the beginning and never had it
   * in the mix; four of these in a second is what a good shot sounds like.
   */
  public playDeath(at?: SoundAt): void {
    this.noiseBurst({ duration: 0.09, volume: 0.14, startFreq: 700, endFreq: 110, q: 1.4, at, wet: WET_BODY });
    this.thump(96, 40, 0.24, 0.17, 0.03, at, WET_BODY);
  }

  public playDodge(): void {
    this.noiseBurst({ duration: 0.22, volume: 0.13, type: 'bandpass', startFreq: 700, endFreq: 220, q: 1.4 });
  }

  public playShove(): void {
    this.noiseBurst({ duration: 0.17, volume: 0.22, startFreq: 1100, endFreq: 160 });
    this.thump(90, 34, 0.16, 0.2);
  }

  /** Magazine out: a catch, then the box dropping away. */
  public playReload(): void {
    this.noiseBurst({ duration: 0.05, volume: 0.13, type: 'bandpass', startFreq: 2100, endFreq: 1400, q: 5 });
    this.noiseBurst({ duration: 0.08, volume: 0.1, type: 'bandpass', startFreq: 900, endFreq: 420, q: 3, delay: 0.09 });
  }

  /** Fresh one home and the action closed — the sound you are listening for. */
  public playReloadDone(): void {
    this.noiseBurst({ duration: 0.07, volume: 0.15, type: 'bandpass', startFreq: 1200, endFreq: 2600, q: 4 });
    this.thump(180, 90, 0.06, 0.09, 0.05);
  }

  /** Hammer on an empty chamber. */
  public playDryFire(): void {
    this.noiseBurst({ duration: 0.035, volume: 0.11, type: 'bandpass', startFreq: 3000, endFreq: 1800, q: 7 });
  }

  /**
   * A swing that went past you. Air and cloth, no impact — the whole point is
   * that it sounds like nothing happening.
   */
  public playSwing(at?: SoundAt): void {
    this.noiseBurst({ duration: 0.16, volume: 0.1, type: 'bandpass', startFreq: 620, endFreq: 190, q: 1.1, at, wet: WET_BODY });
  }

  public playGetUp(): void {
    this.thump(70, 190, 0.5, 0.24);
    this.noiseBurst({ duration: 0.42, volume: 0.1, type: 'bandpass', startFreq: 260, endFreq: 900, q: 2 });
  }

  public playFlare(): void {
    // Strike, then the hiss of burning phosphorus.
    this.noiseBurst({ duration: 0.09, volume: 0.24, startFreq: 4200, endFreq: 900, wet: WET_BODY });
    this.noiseBurst({ duration: 1.1, volume: 0.08, type: 'bandpass', startFreq: 1500, endFreq: 2600, q: 1.1, delay: 0.05, wet: WET_BODY });
  }

  /** Rising gas hiss so a Burster is audible even off-screen. */
  public playSwell(at?: SoundAt): void {
    this.noiseBurst({ duration: 0.75, volume: 0.13, type: 'bandpass', startFreq: 420, endFreq: 1700, q: 2.2, at, wet: WET_BODY });
  }

  /**
   * The shout itself. Long, ragged and up top, so it cuts through a street
   * that is already full of gunfire — this is the one sound in the game the
   * player has to hear over their own weapon.
   */
  public playScream(at?: SoundAt): void {
    this.noiseBurst({ duration: 1.1, volume: 0.3, type: 'bandpass', startFreq: 900, endFreq: 2400, q: 4.5, at, wet: WET_VOICE * 1.6 });
    this.noiseBurst({ duration: 0.9, volume: 0.16, type: 'bandpass', startFreq: 2600, endFreq: 1500, q: 7, delay: 0.08, at, wet: WET_VOICE });
    this.thump(240, 150, 0.7, 0.1, 0, at, WET_VOICE);
  }

  public playBossRoar(at?: SoundAt): void {
    this.thump(85, 38, 1.5, 0.34, 0, at, WET_VOICE);
    this.thump(128, 52, 1.3, 0.2, 0.06, at, WET_VOICE);
    this.noiseBurst({ duration: 1.3, volume: 0.16, startFreq: 700, endFreq: 130, q: 1.5, at, wet: WET_VOICE });
  }

  /**
   * The wind-up on the slam, not the slam. A telegraph nobody can hear is half
   * a telegraph — the ring on the ground says it to whoever happens to be
   * looking down at the right patch of road.
   */
  public playSlamWindup(at?: SoundAt): void {
    this.noiseBurst({ duration: 0.85, volume: 0.1, type: 'bandpass', startFreq: 90, endFreq: 260, q: 3.2, at, wet: WET_BODY });
    this.thump(46, 78, 0.8, 0.16, 0, at, WET_BODY);
  }

  public playSlam(at?: SoundAt): void {
    this.thump(64, 24, 0.55, 0.4, 0, at, WET_BLAST);
    this.noiseBurst({ duration: 0.45, volume: 0.26, startFreq: 1400, endFreq: 90, at, wet: WET_BLAST });
  }

  /** Small metallic clink for salvage. */
  public playScrap(at?: SoundAt): void {
    this.noiseBurst({ duration: 0.09, volume: 0.09, type: 'bandpass', startFreq: 2600, endFreq: 3400, q: 6, at });
  }

  public playGateOpen(): void {
    this.noiseBurst({ duration: 0.6, volume: 0.15, type: 'bandpass', startFreq: 300, endFreq: 900, q: 2.5 });
    this.thump(120, 60, 0.5, 0.14);
  }

  /**
   * A body making the noise it makes.
   *
   * Seven characters rather than seven sounds — the same two primitives, with
   * the register and the length carrying who it is. Low and wet is a Shambler,
   * thin and clipped is a Sprinter, almost nothing at all is a Butcher, which
   * is the point of a Butcher: the biggest thing on the street is the quietest
   * until it is on you.
   *
   * Who is allowed to make it is not decided here. Thirty-four of these at
   * once is mud, so the street picks four (`Engine.updateVocals`) and the rest
   * keep it to themselves.
   */
  public playVocal(type: string, at?: SoundAt): void {
    switch (type) {
      case 'SPRINTER':
        this.noiseBurst({ duration: 0.18, volume: 0.1, type: 'bandpass', startFreq: 950, endFreq: 1450, q: 5, at, wet: WET_VOICE });
        break;
      case 'BUTCHER':
        // Barely there, and all of it underneath the mix.
        this.thump(58, 44, 0.55, 0.09, 0, at, WET_VOICE);
        break;
      case 'BLOATER':
      case 'BURSTER':
        // A rattle: two short passes rather than one long one.
        this.noiseBurst({ duration: 0.14, volume: 0.07, type: 'bandpass', startFreq: 340, endFreq: 260, q: 4, at, wet: WET_VOICE });
        this.noiseBurst({ duration: 0.2, volume: 0.06, type: 'bandpass', startFreq: 300, endFreq: 190, q: 4, delay: 0.17, at, wet: WET_VOICE });
        break;
      case 'SCREAMER':
        // Not the shout — the sound of one winding up to it.
        this.noiseBurst({ duration: 0.3, volume: 0.07, type: 'bandpass', startFreq: 700, endFreq: 1100, q: 6, at, wet: WET_VOICE });
        break;
      case 'CLINGER':
        this.noiseBurst({ duration: 0.22, volume: 0.07, type: 'bandpass', startFreq: 520, endFreq: 760, q: 5, at, wet: WET_VOICE });
        break;
      default: // SHAMBLER, and anything new that has not asked for its own
        this.noiseBurst({ duration: 0.42, volume: 0.08, type: 'bandpass', startFreq: 300, endFreq: 170, q: 2.6, at, wet: WET_VOICE });
        this.thump(84, 62, 0.34, 0.06, 0.02, at, WET_VOICE);
        break;
    }
  }

  /**
   * A boot on the road. Two of these a second for the whole game, so it is the
   * one sound here that has to be nearly nothing — the game is called the long
   * walk home and the walk had no sound at all.
   */
  public playFootstep(): void {
    this.noiseBurst({ duration: 0.055, volume: 0.045, type: 'bandpass', startFreq: 420, endFreq: 210, q: 1.8, wet: WET_STEP });
  }

  /**
   * The half-second of ground opening before something comes out of it. Under
   * the mix rather than in it: a swell you feel and then look for.
   */
  public playSpawnSwell(at?: SoundAt): void {
    this.thump(38, 62, 0.45, 0.13, 0, at, WET_BODY);
    this.noiseBurst({ duration: 0.4, volume: 0.05, type: 'bandpass', startFreq: 120, endFreq: 300, q: 3, at, wet: WET_BODY });
  }

  /** Two low notes — relief, not a fanfare. */
  public playSectorClear(): void {
    this.thump(160, 158, 0.7, 0.16);
    this.thump(120, 118, 1.0, 0.14, 0.22);
  }

  public stopBackgroundMusic(): void {
    try {
      this.bgOsc1?.stop();
      this.bgOsc2?.stop();
    } catch {
      // Already stopped.
    }
    this.bgOsc1 = null;
    this.bgOsc2 = null;
    this.bgGain = null;
    this.bgFilter = null;
    this.bgPulse = null;
  }
}
