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

  public playLaser(): void {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx || !this.masterGain) return;

    // Soft Arcade Gunfire: Low-pass filtered sine wave + short punch
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(240, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, this.ctx.currentTime + 0.08);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(600, this.ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(80, this.ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.08);
  }

  public playShotgunBlast(): void {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx || !this.masterGain) return;

    // Heavy Bass Shotgun Thump: Sub-bass sine sweep + low noise punch
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(160, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(30, this.ctx.currentTime + 0.14);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(500, this.ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(60, this.ctx.currentTime + 0.14);

    gain.gain.setValueAtTime(0.35, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.14);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.14);
  }

  public playPlasmaBlast(): void {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx || !this.masterGain) return;

    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(200, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(35, this.ctx.currentTime + 0.22);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(450, this.ctx.currentTime);

    gain.gain.setValueAtTime(0.32, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.22);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.22);
  }

  public playBulletImpact(isCrit: boolean = false): void {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx || !this.masterGain) return;

    // Sub-bass impact frequency drop (120Hz -> 30Hz)
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    const startFreq = isCrit ? 180 : 120;
    const endFreq = isCrit ? 45 : 30;
    const duration = isCrit ? 0.08 : 0.05;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(startFreq, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(endFreq, this.ctx.currentTime + duration);

    gain.gain.setValueAtTime(isCrit ? 0.28 : 0.18, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  public playCoinPickup(): void {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx || !this.masterGain) return;

    // Soft, harmonious sine wave chimes (E5 -> G5 chord fade out)
    [659.25, 783.99].forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, this.ctx!.currentTime + idx * 0.05);

      gain.gain.setValueAtTime(0.2, this.ctx!.currentTime + idx * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx!.currentTime + idx * 0.05 + 0.14);

      osc.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(this.ctx!.currentTime + idx * 0.05);
      osc.stop(this.ctx!.currentTime + idx * 0.05 + 0.14);
    });
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

  public playComboKill(comboCount: number): void {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx || !this.masterGain) return;

    const baseFreq = 350;
    const pitchShift = Math.min(800, baseFreq + comboCount * 45);

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(pitchShift, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(pitchShift * 1.3, this.ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.18, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.08);
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

  public playDash(): void {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx || !this.masterGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(450, this.ctx.currentTime + 0.14);

    gain.gain.setValueAtTime(0.22, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.14);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.14);
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

  public playRoomClearFanfare(): void {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx || !this.masterGain) return;

    [261.63, 329.63, 392.00, 523.25].forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, this.ctx!.currentTime + idx * 0.07);

      gain.gain.setValueAtTime(0.22, this.ctx!.currentTime + idx * 0.07);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx!.currentTime + idx * 0.07 + 0.35);

      osc.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(this.ctx!.currentTime + idx * 0.07);
      osc.stop(this.ctx!.currentTime + idx * 0.07 + 0.35);
    });
  }

  public playLevelUp(): void {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx || !this.masterGain) return;

    [440, 554.37, 659.25, 880].forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, this.ctx!.currentTime + idx * 0.07);

      gain.gain.setValueAtTime(0.25, this.ctx!.currentTime + idx * 0.07);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx!.currentTime + idx * 0.07 + 0.35);

      osc.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(this.ctx!.currentTime + idx * 0.07);
      osc.stop(this.ctx!.currentTime + idx * 0.07 + 0.35);
    });
  }

  public playWaveStart(): void {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx || !this.masterGain) return;

    [261.63, 329.63, 392.00, 523.25].forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, this.ctx!.currentTime + idx * 0.07);

      gain.gain.setValueAtTime(0.18, this.ctx!.currentTime + idx * 0.07);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx!.currentTime + idx * 0.07 + 0.3);

      osc.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(this.ctx!.currentTime + idx * 0.07);
      osc.stop(this.ctx!.currentTime + idx * 0.07 + 0.3);
    });
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

    const t0 = this.ctx.currentTime + (opts.delay ?? 0);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = opts.type ?? 'lowpass';
    filter.Q.value = opts.q ?? 1;
    filter.frequency.setValueAtTime(opts.startFreq, t0);
    if (opts.endFreq !== undefined) {
      filter.frequency.exponentialRampToValueAtTime(Math.max(30, opts.endFreq), t0 + opts.duration);
    }

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(opts.volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.0008, t0 + opts.duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    src.start(t0);
    src.stop(t0 + opts.duration + 0.02);
  }

  /** Low sine thump layered under a noise burst — gives a shot its weight. */
  private thump(freq: number, endFreq: number, duration: number, volume: number, delay = 0): void {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx || !this.masterGain) return;

    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t0 + duration);

    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.0008, t0 + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
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
