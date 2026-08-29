import { AudioManager, type SpaceId } from '../core/AudioManager';
import { runMeter } from './AudioMeter';
import { injectTheme } from '../theme/Palette';

/**
 * THE LISTENING BENCH.
 *
 * Every sound the game makes, on a key, on one page. Opened with `?audio=test`
 * and nothing else in the game links to it.
 *
 * The reason it exists is the tuning loop, not the sounds. Judging a sound
 * means hearing it three or four times in a row with a number changed in
 * between, and the boss roar sits half an hour into a run. Anything that has
 * to be *played to* gets tuned once and then left alone, which is most of why
 * the audio in this project sounds the way it does.
 *
 * Deliberately not part of the engine: no renderer, no save, no menus. It
 * holds an `AudioManager` and nothing else, so a sound that misbehaves here is
 * the sound's fault.
 */

/**
 * Where a positioned sound is put when it is fired from the bench.
 *
 * Moved by the pan slider rather than pinned, because the thing worth hearing
 * about phase 3 is not that a sound has a place — it is whether the place is
 * the right one. Slide it left, press 5, and the Shambler had better be on the
 * left.
 */
const HERE = { x: 0, z: 0 };

interface Row {
  /** The key that fires it, lowercase. */
  key: string;
  label: string;
  /** Where it turns up in the game — the thing a listening pass needs to know. */
  note: string;
  fire: (a: AudioManager) => void;
}

const GROUPS: { title: string; rows: Row[] }[] = [
  {
    title: 'Guns',
    rows: [
      { key: '1', label: 'Gunshot — light', note: 'Stutter, Ranger', fire: (a) => a.playGunshot('light') },
      { key: '2', label: 'Gunshot — medium', note: 'Marksman', fire: (a) => a.playGunshot('medium') },
      { key: '3', label: 'Gunshot — heavy', note: 'Boomstick, Widowmaker', fire: (a) => a.playGunshot('heavy') },
      { key: '4', label: 'Gunshot — nail', note: 'Nailer', fire: (a) => a.playGunshot('nail') },
      { key: 't', label: 'Reload', note: 'R, the magazine coming out', fire: (a) => a.playReload() },
      { key: 'y', label: 'Reload done', note: 'the seat of the fresh one', fire: (a) => a.playReloadDone() },
      { key: 'u', label: 'Dry fire', note: 'the trigger on an empty gun', fire: (a) => a.playDryFire() }
    ]
  },
  {
    title: 'The player',
    rows: [
      { key: 'e', label: 'Dodge', note: 'the roll', fire: (a) => a.playDodge() },
      { key: 'r', label: 'Shove', note: 'F, and the way out of a Clinger', fire: (a) => a.playShove() },
      { key: 'i', label: 'Get up', note: 'off the floor after a knockdown', fire: (a) => a.playGetUp() },
      { key: 'o', label: 'Flare', note: 'Q', fire: (a) => a.playFlare() },
      { key: 'p', label: 'Player hurt', note: 'anything that lands on you', fire: (a) => a.playPlayerHurt() }
    ]
  },
  {
    title: 'The dead',
    rows: [
      { key: 'q', label: 'Impact', note: 'a round finding a body', fire: (a) => a.playImpact(HERE) },
      { key: 'c', label: 'Death', note: 'a body going down', fire: (a) => a.playDeath(HERE) },
      { key: 'w', label: 'Swing', note: 'a wind-up that came up empty', fire: (a) => a.playSwing() },
      { key: 'a', label: 'Swell', note: 'a Burster filling up', fire: (a) => a.playSwell() },
      { key: 's', label: 'Scream', note: 'the Screamer opening the lanes', fire: (a) => a.playScream() },
      { key: 'g', label: 'Explosion', note: 'Burster, Swollen, barrels', fire: (a) => a.playExplosion() },
      { key: 'd', label: 'Boss roar', note: 'the thing at the end of a sector', fire: (a) => a.playBossRoar() },
      { key: 'f', label: 'Slam', note: 'the boss bringing it down', fire: (a) => a.playSlam(HERE) },
      { key: 'v', label: 'Slam wind-up', note: 'the 0.95s before it lands', fire: (a) => a.playSlamWindup(HERE) }
    ]
  },
  {
    title: 'Voices',
    rows: [
      { key: '5', label: 'Shambler', note: 'low and wet', fire: (a) => a.playVocal('SHAMBLER', HERE) },
      { key: '6', label: 'Sprinter', note: 'thin and clipped', fire: (a) => a.playVocal('SPRINTER', HERE) },
      { key: '7', label: 'Butcher', note: 'almost nothing, all underneath', fire: (a) => a.playVocal('BUTCHER', HERE) },
      { key: '8', label: 'Bloater', note: 'a rattle in two passes', fire: (a) => a.playVocal('BLOATER', HERE) },
      { key: '9', label: 'Screamer', note: 'one winding up to the shout', fire: (a) => a.playVocal('SCREAMER', HERE) },
      { key: '0', label: 'Clinger', note: 'the one that wants hold of you', fire: (a) => a.playVocal('CLINGER', HERE) }
    ]
  },
  {
    title: 'The street',
    rows: [
      { key: 'h', label: 'Pickup', note: 'anything taken off the ground', fire: (a) => a.playPickup() },
      { key: 'j', label: 'Scrap', note: 'the pile going up', fire: (a) => a.playScrap() },
      { key: 'k', label: 'Gate open', note: 'the way into the next sector', fire: (a) => a.playGateOpen() },
      { key: 'l', label: 'Sector clear', note: 'the street going quiet', fire: (a) => a.playSectorClear() },
      { key: 'z', label: 'Purchase', note: 'the trader taking scrap', fire: (a) => a.playPurchase() },
      { key: 'x', label: 'Error', note: 'a button that will not do it', fire: (a) => a.playError() },
      { key: 'b', label: 'Footstep', note: 'twice a second, all game', fire: (a) => a.playFootstep() },
      { key: 'n', label: 'Spawn swell', note: 'under the ring, before it comes up', fire: (a) => a.playSpawnSwell(HERE) }
    ]
  }
];

export function mountAudioTestPage(root: HTMLElement): void {
  injectTheme();

  const audio = new AudioManager();
  let bgOn = false;

  const cards = GROUPS.map((g) => `
    <div class="at-group">
      <div class="ll-sub">${g.title}</div>
      ${g.rows.map((r) => `
        <div class="at-row" data-key="${r.key}">
          <div class="at-key">${r.key.toUpperCase()}</div>
          <div style="flex:1;">
            <div class="at-name">${r.label}</div>
            <div class="at-note">${r.note}</div>
          </div>
        </div>
      `).join('')}
    </div>
  `).join('');

  root.innerHTML = `
    <style>
      .at-page {
        min-height: 100vh;
        padding: 34px 30px 60px;
        box-sizing: border-box;
        overflow-y: auto;
      }
      .at-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 22px;
        margin-top: 22px;
      }
      .at-group { display: flex; flex-direction: column; gap: 6px; }
      .at-row {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 8px 10px;
        border: 1px solid var(--char);
        background: rgba(0,0,0,0.24);
        cursor: pointer;
        transition: background 0.1s linear, border-color 0.1s linear;
      }
      .at-row:hover { background: rgba(255,255,255,0.05); }
      .at-row.at-lit { border-color: var(--amber); background: rgba(217,164,65,0.14); }
      .at-key {
        font-family: var(--stencil);
        font-size: 17px;
        letter-spacing: 1.4px;
        color: var(--amber);
        width: 26px;
        text-align: center;
      }
      .at-name { color: var(--bone); font-size: 13px; }
      .at-note { color: var(--steel); font-size: 11px; margin-top: 2px; }
      .at-bar { display: flex; align-items: center; gap: 14px; margin-top: 14px; }
      .at-table { margin-top: 18px; }
      .at-table h3 {
        font-family: var(--stencil);
        font-size: 15px;
        letter-spacing: 1.6px;
        text-transform: uppercase;
        color: var(--amber);
        margin: 0 0 4px;
      }
      .at-table table { border-collapse: collapse; margin-top: 8px; }
      .at-table th, .at-table td {
        padding: 3px 16px 3px 0;
        text-align: right;
        font-size: 12px;
        color: var(--bone);
        font-variant-numeric: tabular-nums;
      }
      .at-table th { color: var(--steel); font-weight: normal; font-size: 10px; letter-spacing: 1.2px; text-transform: uppercase; }
      .at-table td:first-child, .at-table th:first-child { text-align: left; color: var(--ash); }
      .at-slider {
        -webkit-appearance: none;
        appearance: none;
        width: 240px;
        height: 3px;
        background: var(--char);
        outline: none;
        cursor: pointer;
      }
      .at-slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 13px; height: 20px;
        background: var(--amber);
        border: 1px solid rgba(0,0,0,0.5);
      }
      .at-slider::-moz-range-thumb {
        width: 13px; height: 20px; border-radius: 0;
        background: var(--amber);
        border: 1px solid rgba(0,0,0,0.5);
      }
    </style>
    <div class="at-page">
      <div class="ll-title" style="font-size:30px;">Listening bench</div>
      <div class="ll-sub">Every sound in the game, on a key. Nothing here is the game.</div>
      <div class="at-bar">
        <div class="at-key">VOL</div>
        <input id="at-vol" class="at-slider" type="range" min="0" max="100" step="1" value="30" />
        <div id="at-vol-lbl" class="at-key" style="width:52px;">30%</div>
        <button id="at-bg" class="ll-btn-ghost">DRONE: OFF</button>
      </div>
      <div class="at-bar">
        <div class="at-key">POS</div>
        <input id="at-pan" class="at-slider" type="range" min="-30" max="30" step="1" value="0" />
        <div id="at-pan-lbl" class="at-key" style="width:88px;">centre</div>
        <div class="at-note" style="max-width:340px;">
          Where the world sounds are put, in metres across the frame. Everything
          in Guns, The player and most of The street is meant to stay dry and
          centred however far this is dragged.
        </div>
      </div>
      <div class="at-bar">
        <div class="at-key">ROOM</div>
        <button class="ll-btn-ghost at-space" data-space="STREET">STREET</button>
        <button class="ll-btn-ghost at-space" data-space="UNDERPASS">UNDERPASS</button>
        <button class="ll-btn-ghost at-space" data-space="BASEMENT">BASEMENT</button>
      </div>
      <div class="at-bar">
        <div class="at-key">BED</div>
        <input id="at-pressure" class="at-slider" type="range" min="0" max="100" step="1" value="0" />
        <div id="at-pressure-lbl" class="at-key" style="width:52px;">0%</div>
        <div class="at-note" style="max-width:340px;">
          How badly it is going, as the bed hears it. Turn the drone on first —
          this moves the filter, the root and the breath, and does nothing at
          all on its own.
        </div>
      </div>
      <div class="at-bar">
        <button id="at-meter" class="ll-btn-ghost">MEASURE</button>
        <div class="at-note" style="max-width:520px;">
          Renders every sound offline and measures it — levels, repetition,
          placement, rooms. Answers the half of a listening pass that is
          arithmetic, in about a second, and leaves the half that is taste.
        </div>
      </div>
      <div id="at-meter-out"></div>
      <div class="at-grid">${cards}</div>
    </div>
  `;

  const all = new Map<string, Row>();
  for (const g of GROUPS) for (const r of g.rows) all.set(r.key, r);

  const lit = (key: string) => {
    const el = root.querySelector<HTMLElement>(`.at-row[data-key="${key}"]`);
    if (!el) return;
    el.classList.add('at-lit');
    window.setTimeout(() => el.classList.remove('at-lit'), 110);
  };

  const fire = (key: string) => {
    const row = all.get(key);
    if (!row) return;
    row.fire(audio);
    lit(key);
  };

  root.querySelectorAll<HTMLElement>('.at-row').forEach((el) => {
    el.addEventListener('click', () => fire(el.dataset.key!));
  });

  const vol = root.querySelector<HTMLInputElement>('#at-vol')!;
  const volLbl = root.querySelector<HTMLElement>('#at-vol-lbl')!;
  vol.addEventListener('input', () => {
    audio.setVolume(parseInt(vol.value, 10) / 100);
    volLbl.textContent = `${vol.value}%`;
  });

  const pan = root.querySelector<HTMLInputElement>('#at-pan')!;
  const panLbl = root.querySelector<HTMLElement>('#at-pan-lbl')!;
  pan.addEventListener('input', () => {
    // Screen-right on this rig is world +x/-z, so one slider walks the sound
    // straight across the frame.
    const m = parseInt(pan.value, 10);
    HERE.x = m * 0.7071;
    HERE.z = -m * 0.7071;
    panLbl.textContent = m === 0 ? 'centre' : `${Math.abs(m)}m ${m < 0 ? 'left' : 'right'}`;
  });

  const spaces = root.querySelectorAll<HTMLButtonElement>('.at-space');
  const litSpace = (id: string) => {
    spaces.forEach((el) => { el.style.color = el.dataset.space === id ? 'var(--amber)' : ''; });
  };
  spaces.forEach((el) => {
    el.addEventListener('click', () => {
      audio.setSpace(el.dataset.space as SpaceId);
      litSpace(el.dataset.space!);
    });
  });
  litSpace('STREET');

  const pressure = root.querySelector<HTMLInputElement>('#at-pressure')!;
  const pressureLbl = root.querySelector<HTMLElement>('#at-pressure-lbl')!;
  pressure.addEventListener('input', () => {
    audio.setPressure(parseInt(pressure.value, 10) / 100);
    pressureLbl.textContent = `${pressure.value}%`;
  });

  const bg = root.querySelector<HTMLButtonElement>('#at-bg')!;
  bg.addEventListener('click', () => {
    bgOn = !bgOn;
    if (bgOn) audio.startBackgroundMusic();
    else audio.stopBackgroundMusic();
    bg.textContent = `DRONE: ${bgOn ? 'ON' : 'OFF'}`;
  });

  const meterBtn = root.querySelector<HTMLButtonElement>('#at-meter')!;
  const meterOut = root.querySelector<HTMLElement>('#at-meter-out')!;
  meterBtn.addEventListener('click', async () => {
    meterBtn.disabled = true;
    meterOut.innerHTML = '<div class="at-note" style="margin-top:14px;">rendering…</div>';
    try {
      const tables = await runMeter((n, total) => {
        meterOut.innerHTML = `<div class="at-note" style="margin-top:14px;">rendering ${n}/${total}…</div>`;
      });
      meterOut.innerHTML = tables.map((t) => `
        <div class="at-table">
          <h3>${t.title}</h3>
          <div class="at-note" style="max-width:640px;">${t.note}</div>
          <table>
            <tr>${t.head.map((h) => `<th>${h}</th>`).join('')}</tr>
            ${t.rows.map((r) => `<tr><td>${r.label}</td>${r.cols.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}
          </table>
        </div>
      `).join('');
    } finally {
      meterBtn.disabled = false;
    }
  });

  // The breath is the one part of the bed that moves per frame rather than on
  // a ramp, so the bench has to drive it the way the game does.
  let last = performance.now();
  const tick = (now: number) => {
    const delta = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (bgOn) audio.tickBed(delta);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    const k = e.key.toLowerCase();
    // Mute is the game's own key, and it belongs here for the same reason the
    // slider does: a listening pass needs to be able to stop.
    if (k === 'm') {
      audio.toggleMute();
      return;
    }
    if (all.has(k)) {
      e.preventDefault();
      fire(k);
    }
  });
}
