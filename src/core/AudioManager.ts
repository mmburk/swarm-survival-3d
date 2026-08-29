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

  private beatTime: number = 0;

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

  public getBeatPulse(): number {
    this.beatTime += 0.033;
    return (Math.sin(this.beatTime * 8.0) * 0.5 + 0.5);
  }

  public setWaveIntensity(wave: number): void {
    if (this.bgFilter && this.bgOsc1 && this.ctx) {
      const cutoff = Math.min(800, 250 + wave * 100);
      const freq = Math.min(180, 90 + wave * 10);
      this.bgFilter.frequency.exponentialRampToValueAtTime(cutoff, this.ctx.currentTime + 1.0);
      this.bgOsc1.frequency.exponentialRampToValueAtTime(freq, this.ctx.currentTime + 1.0);
    }
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

      this.bgOsc1.frequency.setValueAtTime(90.0, this.ctx.currentTime);
      this.bgOsc2.frequency.setValueAtTime(45.0, this.ctx.currentTime);

      this.bgFilter = this.ctx.createBiquadFilter();
      this.bgFilter.type = 'lowpass';
      this.bgFilter.frequency.setValueAtTime(250, this.ctx.currentTime);

      this.bgOsc1.connect(this.bgFilter);
      this.bgOsc2.connect(this.bgFilter);
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
  public playExplosion(): void {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx || !this.masterGain) return;

    const bufferSize = this.ctx.sampleRate * 0.3;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(450, this.ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(30, this.ctx.currentTime + 0.3);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.35, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);

    whiteNoise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    whiteNoise.start();
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
  }): void {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx || !this.masterGain) return;

    const buf = this.getNoise();
    if (!buf) return;

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
    gain.gain.setValueAtTime(vary(opts.volume, VARY_GAIN), t0);
    gain.gain.exponentialRampToValueAtTime(0.0008, t0 + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    // bug.md #11. The buffer is 1.2 seconds of noise and every burst used to
    // read it from the top, so a burst of 0.07 seconds was not "some noise",
    // it was one particular seventieth of a second, over and over. Starting
    // somewhere else in the buffer costs one argument. `loop` is already on,
    // so a late start still has material to run into.
    src.start(t0, Math.random() * Math.max(0, buf.duration - duration));
    src.stop(t0 + duration + 0.02);
  }

  /** Low sine thump layered under a noise burst — gives a shot its weight. */
  private thump(freq: number, endFreq: number, duration: number, volume: number, delay = 0): void {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx || !this.masterGain) return;

    const t0 = this.ctx.currentTime + vary(delay, VARY_DELAY);
    const freqShift = vary(1, VARY_FREQ);
    const dur = vary(duration, VARY_TIME);

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq * freqShift, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq * freqShift), t0 + dur);

    gain.gain.setValueAtTime(vary(volume, VARY_GAIN), t0);
    gain.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  public playGunshot(kind: 'light' | 'medium' | 'heavy' | 'nail'): void {
    switch (kind) {
      case 'light': // machine pistol
        this.noiseBurst({ duration: 0.07, volume: 0.16, startFreq: 3200, endFreq: 600, q: 0.8 });
        this.thump(150, 60, 0.05, 0.1);
        break;
      case 'heavy': // shotgun / bolt rifle
        this.noiseBurst({ duration: 0.26, volume: 0.34, startFreq: 2400, endFreq: 120, q: 0.6 });
        this.thump(110, 32, 0.2, 0.3);
        // Slap-back off the buildings.
        this.noiseBurst({ duration: 0.3, volume: 0.09, startFreq: 900, endFreq: 180, delay: 0.11 });
        break;
      case 'nail': // compressed air
        this.noiseBurst({ duration: 0.1, volume: 0.16, type: 'bandpass', startFreq: 1800, endFreq: 3400, q: 3.5 });
        break;
      default: // carbine
        this.noiseBurst({ duration: 0.13, volume: 0.24, startFreq: 3000, endFreq: 320, q: 0.7 });
        this.thump(140, 45, 0.1, 0.18);
        this.noiseBurst({ duration: 0.22, volume: 0.06, startFreq: 800, endFreq: 200, delay: 0.09 });
        break;
    }
  }

  /** Wet, dull — a round going into a body rather than a ping. */
  public playImpact(): void {
    this.noiseBurst({ duration: 0.06, volume: 0.12, startFreq: 520, endFreq: 140, q: 1.2 });
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
  public playSwing(): void {
    this.noiseBurst({ duration: 0.16, volume: 0.1, type: 'bandpass', startFreq: 620, endFreq: 190, q: 1.1 });
  }

  public playGetUp(): void {
    this.thump(70, 190, 0.5, 0.24);
    this.noiseBurst({ duration: 0.42, volume: 0.1, type: 'bandpass', startFreq: 260, endFreq: 900, q: 2 });
  }

  public playFlare(): void {
    // Strike, then the hiss of burning phosphorus.
    this.noiseBurst({ duration: 0.09, volume: 0.24, startFreq: 4200, endFreq: 900 });
    this.noiseBurst({ duration: 1.1, volume: 0.08, type: 'bandpass', startFreq: 1500, endFreq: 2600, q: 1.1, delay: 0.05 });
  }

  /** Rising gas hiss so a Burster is audible even off-screen. */
  public playSwell(): void {
    this.noiseBurst({ duration: 0.75, volume: 0.13, type: 'bandpass', startFreq: 420, endFreq: 1700, q: 2.2 });
  }

  /**
   * The shout itself. Long, ragged and up top, so it cuts through a street
   * that is already full of gunfire — this is the one sound in the game the
   * player has to hear over their own weapon.
   */
  public playScream(): void {
    this.noiseBurst({ duration: 1.1, volume: 0.3, type: 'bandpass', startFreq: 900, endFreq: 2400, q: 4.5 });
    this.noiseBurst({ duration: 0.9, volume: 0.16, type: 'bandpass', startFreq: 2600, endFreq: 1500, q: 7, delay: 0.08 });
    this.thump(240, 150, 0.7, 0.1);
  }

  public playBossRoar(): void {
    this.thump(85, 38, 1.5, 0.34);
    this.thump(128, 52, 1.3, 0.2, 0.06);
    this.noiseBurst({ duration: 1.3, volume: 0.16, startFreq: 700, endFreq: 130, q: 1.5 });
  }

  public playSlam(): void {
    this.thump(64, 24, 0.55, 0.4);
    this.noiseBurst({ duration: 0.45, volume: 0.26, startFreq: 1400, endFreq: 90 });
  }

  /** Small metallic clink for salvage. */
  public playScrap(): void {
    this.noiseBurst({ duration: 0.09, volume: 0.09, type: 'bandpass', startFreq: 2600, endFreq: 3400, q: 6 });
  }

  public playGateOpen(): void {
    this.noiseBurst({ duration: 0.6, volume: 0.15, type: 'bandpass', startFreq: 300, endFreq: 900, q: 2.5 });
    this.thump(120, 60, 0.5, 0.14);
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
  }
}
