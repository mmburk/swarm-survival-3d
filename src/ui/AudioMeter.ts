import { AudioManager, type SpaceId } from '../core/AudioManager';

/**
 * THE METER.
 *
 * Renders every sound through a real WebAudio graph offline and measures what
 * came out. It runs faster than real time and needs nobody in the room.
 *
 * It exists because of a specific failure. The whole sound plan was written
 * against arithmetic — node counts, gain values, pan numbers — and arithmetic
 * cannot tell you whether two gunshots sound the same. Rendering can. What it
 * still cannot do is tell you whether they sound *good*, and nothing here
 * pretends otherwise: every number below is a question answered, and the
 * questions it does not ask are the ones that need the ear.
 *
 * One warning, learned the hard way. The obvious measurement — correlate the
 * waveforms of two shots — is the wrong one, and it will lie to you. Two
 * decaying sines of the same frequency at random phases have a mean absolute
 * correlation of 2/π, about 0.64, however different they are; the ear does not
 * hear phase at all. What repetition actually is, to a listener, is the same
 * spectrum under the same envelope. That is what `judge` compares.
 */

const RATE = 44100;

async function render(seconds: number, setup: ((a: AudioManager) => void) | null, fire: (a: AudioManager) => void): Promise<AudioBuffer> {
  const off = new OfflineAudioContext(2, Math.ceil(RATE * seconds), RATE);
  const real = window.AudioContext;
  // The manager builds its own context. Handing it this one is the whole trick
  // and is why nothing in AudioManager had to be opened up for testing.
  (window as any).AudioContext = function () { return off; };
  try {
    const a = new AudioManager();
    a.setVolume(1);
    setup?.(a);
    fire(a);
    return await off.startRendering();
  } finally {
    (window as any).AudioContext = real;
  }
}

const rmsOf = (d: Float32Array, from = 0, to = d.length): number => {
  let s = 0;
  for (let i = from; i < to; i++) s += d[i] * d[i];
  return Math.sqrt(s / Math.max(1, to - from));
};

const peakOf = (d: Float32Array): number => {
  let p = 0;
  for (let i = 0; i < d.length; i++) p = Math.max(p, Math.abs(d[i]));
  return p;
};

const db = (x: number): number => (x <= 1e-9 ? -99 : 20 * Math.log10(x));

/** Twelve log-spaced band energies: the shape of the sound, not its waveform. */
function bands(d: Float32Array, n = 12): Float64Array {
  const N = 4096;
  const step = Math.max(1, Math.floor(d.length / N));
  const x = new Float64Array(N);
  for (let i = 0; i < N; i++) x[i] = d[i * step] || 0;

  const nyq = RATE / step / 2;
  const out = new Float64Array(n);
  for (let b = 0; b < n; b++) {
    const lo = 40 * Math.pow(nyq / 40, b / n);
    const hi = 40 * Math.pow(nyq / 40, (b + 1) / n);
    const k0 = Math.max(1, Math.round((lo * N) / (RATE / step)));
    const k1 = Math.min(N / 2, Math.round((hi * N) / (RATE / step)));
    let e = 0;
    for (let k = k0; k <= k1; k++) {
      let re = 0;
      let im = 0;
      const w = (2 * Math.PI * k) / N;
      // Every other sample: this is a shape, not a spectrogram, and the loop
      // is the whole cost of the meter.
      for (let i = 0; i < N; i += 2) {
        re += x[i] * Math.cos(w * i);
        im -= x[i] * Math.sin(w * i);
      }
      e += re * re + im * im;
    }
    out[b] = Math.sqrt(e / Math.max(1, k1 - k0 + 1));
  }
  return out;
}

/** RMS in 5ms slices: the shape of the sound over time. */
function envelope(d: Float32Array): number[] {
  const hop = Math.round(RATE * 0.005);
  const out: number[] = [];
  for (let i = 0; i + hop <= d.length; i += hop) out.push(rmsOf(d, i, i + hop));
  return out;
}

/** Mean per-bin coefficient of variation across a set of takes, as a percent. */
function spread(takes: ArrayLike<number>[]): number {
  const n = takes[0].length;
  let acc = 0;
  let used = 0;
  for (let b = 0; b < n; b++) {
    let s = 0;
    for (const v of takes) s += v[b];
    const mu = s / takes.length;
    if (mu < 1e-7) continue;
    let sd = 0;
    for (const v of takes) sd += (v[b] - mu) * (v[b] - mu);
    acc += Math.sqrt(sd / takes.length) / mu;
    used++;
  }
  return used ? (acc / used) * 100 : 0;
}

/** How long from the peak until it is 60dB down. */
function decayTime(d: Float32Array): number {
  let pi = 0;
  let p = 0;
  for (let i = 0; i < d.length; i++) {
    const v = Math.abs(d[i]);
    if (v > p) { p = v; pi = i; }
  }
  const floor = p / 1000;
  for (let i = d.length - 1; i > pi; i--) if (Math.abs(d[i]) > floor) return (i - pi) / RATE;
  return 0;
}

export interface MeterRow {
  label: string;
  cols: string[];
}

export interface MeterTable {
  title: string;
  note: string;
  head: string[];
  rows: MeterRow[];
}

const EVENTS: [string, number, (a: AudioManager) => void][] = [
  ['gunshot light', 0.6, (a) => a.playGunshot('light')],
  ['gunshot medium', 0.7, (a) => a.playGunshot('medium')],
  ['gunshot heavy', 1.0, (a) => a.playGunshot('heavy')],
  ['gunshot nail', 0.5, (a) => a.playGunshot('nail')],
  ['impact', 0.6, (a) => a.playImpact({ x: 0, z: 0 })],
  ['death', 0.8, (a) => a.playDeath({ x: 0, z: 0 })],
  ['swing', 0.6, (a) => a.playSwing({ x: 0, z: 0 })],
  ['vocal shambler', 1.0, (a) => a.playVocal('SHAMBLER', { x: 0, z: 0 })],
  ['vocal sprinter', 0.6, (a) => a.playVocal('SPRINTER', { x: 0, z: 0 })],
  ['vocal butcher', 1.0, (a) => a.playVocal('BUTCHER', { x: 0, z: 0 })],
  ['scream', 1.8, (a) => a.playScream({ x: 0, z: 0 })],
  ['explosion', 1.2, (a) => a.playExplosion({ x: 0, z: 0 })],
  ['footstep', 0.4, (a) => a.playFootstep()],
  ['spawn swell', 0.9, (a) => a.playSpawnSwell({ x: 0, z: 0 })],
  ['player hurt', 0.5, (a) => a.playPlayerHurt()],
  ['reload done', 0.4, (a) => a.playReloadDone()],
  ['pickup (ui)', 0.5, (a) => a.playPickup()],
  ['error (ui)', 0.5, (a) => a.playError()]
];

const REPEATS: [string, number, (a: AudioManager) => void][] = [
  ['gunshot medium', 0.5, (a) => a.playGunshot('medium')],
  ['gunshot light', 0.4, (a) => a.playGunshot('light')],
  ['gunshot heavy', 0.7, (a) => a.playGunshot('heavy')],
  ['gunshot nail', 0.4, (a) => a.playGunshot('nail')],
  ['death', 0.5, (a) => a.playDeath({ x: 0, z: 0 })],
  ['vocal shambler', 0.6, (a) => a.playVocal('SHAMBLER', { x: 0, z: 0 })]
];

export async function runMeter(onProgress?: (done: number, total: number) => void): Promise<MeterTable[]> {
  const total = EVENTS.length + REPEATS.length * 6 + 3 + 3;
  let done = 0;
  const step = () => onProgress?.(++done, total);

  // ---- how loud is everything, against everything else -------------------
  const levels: MeterRow[] = [];
  for (const [label, secs, fire] of EVENTS) {
    const d = (await render(secs, null, fire)).getChannelData(0);
    levels.push({ label, cols: [db(peakOf(d)).toFixed(1), db(rmsOf(d)).toFixed(1), decayTime(d).toFixed(2)] });
    step();
  }

  // ---- does it repeat ----------------------------------------------------
  const repeats: MeterRow[] = [];
  for (const [label, secs, fire] of REPEATS) {
    const specs: Float64Array[] = [];
    const envs: number[][] = [];
    for (let i = 0; i < 6; i++) {
      const d = (await render(secs, null, fire)).getChannelData(0);
      specs.push(bands(d));
      envs.push(envelope(d));
      step();
    }
    const len = Math.min(...envs.map((e) => e.length));
    repeats.push({
      label,
      cols: [spread(specs).toFixed(1) + '%', spread(envs.map((e) => e.slice(0, len))).toFixed(1) + '%']
    });
  }

  // ---- is left actually left ---------------------------------------------
  const stereo: MeterRow[] = [];
  for (const [label, x, z] of [['hard left', -14.1, 14.1], ['centre', 0, 0], ['hard right', 14.1, -14.1]] as [string, number, number][]) {
    const buf = await render(0.6, null, (a) => { a.setListener(0, 0); a.playVocal('SPRINTER', { x, z }); });
    const L = db(rmsOf(buf.getChannelData(0)));
    const R = db(rmsOf(buf.getChannelData(1)));
    stereo.push({ label, cols: [L.toFixed(1), R.toFixed(1), (R - L).toFixed(1)] });
    step();
  }

  // ---- does the basement close down --------------------------------------
  const rooms: MeterRow[] = [];
  for (const room of ['STREET', 'UNDERPASS', 'BASEMENT'] as SpaceId[]) {
    const d = (await render(3.0, (a) => a.setSpace(room), (a) => a.playGunshot('heavy'))).getChannelData(0);
    const late = rmsOf(d, Math.floor(RATE * 0.5), Math.floor(RATE * 1.0));
    const front = Math.max(1e-9, rmsOf(d, 0, Math.floor(RATE * 0.05)));
    rooms.push({ label: room, cols: [decayTime(d).toFixed(3), db(late / front).toFixed(1)] });
    step();
  }

  return [
    {
      title: 'Levels',
      note: 'Every sound against every other one, in dBFS. This is the table that says whether a kill is louder than the shot that made it, and whether the interface is shouting over the street.',
      head: ['sound', 'peak', 'rms', 'tail (s)'],
      rows: levels
    },
    {
      title: 'Repetition',
      note: 'How far the spectrum and the envelope move from one firing to the next. Not waveform correlation — two sines at random phase correlate at 0.64 however different they sound, and the ear does not hear phase. Under about 5% is a sample being replayed; the teens are a gun being fired twice.',
      head: ['sound', 'spectrum', 'envelope'],
      rows: repeats
    },
    {
      title: 'Placement',
      note: 'A Sprinter twenty metres out, put at three places across the frame. Left should be louder on the left by the same amount that right is louder on the right, and the centre should be dead level.',
      head: ['where', 'L', 'R', 'balance'],
      rows: stereo
    },
    {
      title: 'Rooms',
      note: 'The same shotgun in all three spaces. "late" is what is still ringing half a second later, against the front of the shot — the basement has to be a long way below the underpass or the rooms are decoration.',
      head: ['room', 'tail (s)', 'late'],
      rows: rooms
    }
  ];
}
