export class AudioManager {
  private ctx: AudioContext | null = null;
  private enabled: boolean = true;
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
        this.masterGain.gain.setValueAtTime(0.3, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);
      }
    } else if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public toggleMute(): boolean {
    this.enabled = !this.enabled;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.enabled ? 0.3 : 0, this.ctx.currentTime);
    }
    return this.enabled;
  }

  public getBeatPulse(): number {
    this.beatTime += 0.033;
    return (Math.sin(this.beatTime * 8.0) * 0.5 + 0.5);
  }

  public setWaveIntensity(wave: number): void {
    if (this.bgFilter && this.bgOsc1 && this.ctx) {
      const cutoff = Math.min(1200, 300 + wave * 150);
      const freq = Math.min(220, 110 + wave * 12);
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
      this.bgGain.gain.setValueAtTime(0.08, this.ctx.currentTime);

      this.bgOsc1 = this.ctx.createOscillator();
      this.bgOsc2 = this.ctx.createOscillator();

      this.bgOsc1.type = 'sawtooth';
      this.bgOsc2.type = 'sine';

      this.bgOsc1.frequency.setValueAtTime(110.0, this.ctx.currentTime);
      this.bgOsc2.frequency.setValueAtTime(55.0, this.ctx.currentTime);

      this.bgFilter = this.ctx.createBiquadFilter();
      this.bgFilter.type = 'lowpass';
      this.bgFilter.frequency.setValueAtTime(350, this.ctx.currentTime);

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

  public playComboKill(comboCount: number): void {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx || !this.masterGain) return;

    const baseFreq = 400;
    const pitchShift = Math.min(1200, baseFreq + comboCount * 65);

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(pitchShift, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(pitchShift * 1.5, this.ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.22, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.08);
  }

  public playLaser(): void {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx || !this.masterGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(950, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(150, this.ctx.currentTime + 0.11);

    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.11);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.11);
  }

  public playPlasmaBlast(): void {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx || !this.masterGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(260, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(35, this.ctx.currentTime + 0.28);

    gain.gain.setValueAtTime(0.38, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.28);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.28);
  }

  public playExplosion(): void {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx || !this.masterGain) return;

    const bufferSize = this.ctx.sampleRate * 0.35;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(900, this.ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.35);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.45, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.35);

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
    osc.frequency.setValueAtTime(180, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(750, this.ctx.currentTime + 0.16);

    gain.gain.setValueAtTime(0.28, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.16);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.16);
  }

  public playPlayerHurt(): void {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx || !this.masterGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(50, this.ctx.currentTime + 0.22);

    gain.gain.setValueAtTime(0.35, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.22);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.22);
  }

  public playShotgunBlast(): void {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx || !this.masterGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(180, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.18);

    gain.gain.setValueAtTime(0.4, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.18);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.18);
  }

  public playBulletImpact(): void {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx || !this.masterGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    const startFreq = 600 + Math.random() * 300;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(startFreq, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.06);

    gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.06);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.06);
  }

  public playPickup(): void {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx || !this.masterGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1046.50, this.ctx.currentTime + 0.1);

    gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.1);
  }

  public playLevelUp(): void {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx || !this.masterGain) return;

    [440, 554.37, 659.25, 880].forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, this.ctx!.currentTime + idx * 0.08);

      gain.gain.setValueAtTime(0.3, this.ctx!.currentTime + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx!.currentTime + idx * 0.08 + 0.35);

      osc.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(this.ctx!.currentTime + idx * 0.08);
      osc.stop(this.ctx!.currentTime + idx * 0.08 + 0.35);
    });
  }

  public playWaveStart(): void {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx || !this.masterGain) return;

    [261.63, 329.63, 392.00, 523.25].forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, this.ctx!.currentTime + idx * 0.08);

      gain.gain.setValueAtTime(0.2, this.ctx!.currentTime + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx!.currentTime + idx * 0.08 + 0.3);

      osc.connect(gain);
      gain.connect(this.masterGain!);

      osc.start(this.ctx!.currentTime + idx * 0.08);
      osc.stop(this.ctx!.currentTime + idx * 0.08 + 0.3);
    });
  }
}
