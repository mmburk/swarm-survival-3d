import { injectTheme, CSS } from '../theme/Palette';
import { SaveSystem, FPS_CAPS } from '../utils/SaveSystem';
import { META_DEFS, NIGHT_TIERS } from '../config/Progression';
import { WEAPONS, WEAPON_ORDER, resolveWeaponStats, type WeaponId } from '../config/Weapons';
import { ANIMALS, ANIMAL_ORDER, type AnimalId } from '../config/Animals';
import { MARKS, MARK_ORDER } from '../config/Marks';
import { CALLERS } from './BoonModal';
import { emblemSvg, emblemChip } from './art/Emblems';
import { callerPortrait, callerSigil, type CallerArtId } from './art/Portraits';
import { weaponPlate, weaponThumb } from './art/Weapons2D';
import { animalMark } from './art/Animals';
import { heardLines, logProgress } from '../narrative/RadioLog';
import { readBoard, type ProphecyContext, type ProphecyView } from '../narrative/Prophecies';
import { ALL_CALLERS } from '../core/RewardDeck';

/**
 * How the pin board reaches the save without the menu owning any of it: the
 * engine hands over a way to read the current state and a way to take a
 * finished card down. The menu re-reads through `context` after every claim,
 * so what is on screen can never lag behind what was paid out.
 */
export interface BoardBinding {
  context: () => ProphecyContext;
  claim: (view: ProphecyView) => void;
}

export interface RunSummary {
  survived: boolean;
  sector: number;
  sectorName: string;
  kills: number;
  /** Everything picked up tonight, before the door takes its cut. */
  scrapCarried: number;
  /** What actually reached the workbench. Equal to the carry only on a walk-back. */
  scrapBanked: number;
  scrapLost: number;
  duration: number;
  weapon: string;
  cause: string;
  /** The number the night's doors were dealt from. Flavour, and a talking point. */
  seed: string;
}

/**
 * Every full-screen surface: the title card, the four shelter stations, the
 * pause card and the run debrief. All of them share the same pinned-paper
 * treatment from the theme.
 */
export class MenuSystem {
  private root: HTMLElement;
  private open: boolean = false;

  /** Weapon currently highlighted on the rack, not yet confirmed. */
  private previewWeapon: WeaponId;
  /** Animal currently being read about in the pens. */
  private previewAnimal: AnimalId = 'ROOK';

  /**
   * Told by the engine that the display settings moved. The menu writes to the
   * save and then says so; what a frame ceiling actually means is the loop's
   * business, not this card's.
   */
  public onDisplayChange: (() => void) | null = null;

  constructor() {
    injectTheme();

    this.previewWeapon = SaveSystem.getLastWeapon();

    this.root = document.createElement('div');
    this.root.id = 'menus';
    this.root.style.cssText = `
      position: absolute; inset: 0;
      z-index: 1000;
      display: none;
      justify-content: center;
      align-items: center;
      font-family: var(--body);
      color: var(--bone);
      background: rgba(8, 9, 6, 0.82);
      user-select: none;
    `;
    document.body.appendChild(this.root);

    this.injectMenuStyles();
  }

  public get isOpen(): boolean {
    return this.open;
  }

  public hide(): void {
    this.root.style.display = 'none';
    this.root.innerHTML = '';
    this.open = false;
  }

  private present(html: string): void {
    this.root.innerHTML = html;
    this.root.style.display = 'flex';
    this.open = true;
  }

  private injectMenuStyles(): void {
    const style = document.createElement('style');
    style.textContent = `
      .mn-shell {
        position: relative;
        width: 880px;
        max-width: 94vw;
        max-height: 92vh;
        overflow-y: auto;
        padding: 30px 34px 28px;
        animation: llFadeUp 0.22s ease-out;
      }
      .mn-head {
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
        gap: 20px;
        padding-bottom: 14px;
        border-bottom: 1px solid var(--char);
      }
      .mn-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 16px;
        padding: 13px 15px;
        background: rgba(0,0,0,0.24);
        border: 1px solid var(--char);
        border-left: 3px solid var(--steel);
      }
      .mn-row.locked { opacity: 0.55; }
      .mn-name {
        font-family: var(--stencil);
        font-size: 18px;
        letter-spacing: 2px;
        color: var(--paper);
      }
      .mn-note { font-size: 12px; color: var(--ash); margin-top: 3px; }
      .mn-pip {
        display: inline-block;
        width: 15px; height: 5px;
        margin-right: 3px;
        background: var(--char);
      }
      .mn-pip.on { background: var(--amber); }

      .wpn-grid {
        display: grid;
        grid-template-columns: 258px 1fr;
        gap: 18px;
        margin-top: 18px;
      }
      .wpn-item {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 9px 11px;
        border: 1px solid var(--char);
        border-left: 3px solid transparent;
        background: rgba(0,0,0,0.22);
        cursor: pointer;
        transition: border-color 0.12s linear, background 0.12s linear, transform 0.12s ease-out;
      }
      .wpn-item:hover { background: rgba(255,255,255,0.05); transform: translateX(2px); }
      .wpn-item.active {
        border-left-color: var(--rust);
        background: rgba(168,85,43,0.14);
      }
      .wpn-item.locked .wpn-thumb { opacity: 0.4; }
      .wpn-item.locked .mn-name { color: var(--ash); }
      .wpn-thumb { flex: 0 0 auto; transition: opacity 0.12s linear; }

      /* The plate the gun hangs on: pegboard, one lamp, a long shadow. */
      .wpn-plate {
        position: relative;
        padding: 10px 14px 4px;
        background:
          radial-gradient(120% 90% at 22% 0%, rgba(217,164,65,0.13) 0%, rgba(217,164,65,0) 62%),
          linear-gradient(180deg, rgba(38,41,30,0.9), rgba(15,17,11,0.94));
        border: 1px solid var(--char);
        border-top-color: #3b3f31;
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.04);
        overflow: hidden;
      }
      /* Pegboard holes, cheap and convincing at this size. */
      .wpn-plate::before {
        content: '';
        position: absolute; inset: 0;
        background-image: radial-gradient(circle, rgba(0,0,0,0.5) 1.2px, transparent 1.4px);
        background-size: 16px 16px;
        opacity: 0.5;
        pointer-events: none;
      }
      .wpn-plate > * { position: relative; }
      .wpn-plate.locked { filter: grayscale(0.6) brightness(0.7); }
      .wpn-stamp {
        position: absolute;
        top: 10px; right: 12px;
        font-family: var(--stencil);
        font-size: 12px;
        letter-spacing: 3px;
        color: var(--blood);
        border: 2px solid var(--blood);
        padding: 3px 9px;
        transform: rotate(-7deg);
        opacity: 0.85;
      }

      .stat-line { display: flex; align-items: center; gap: 10px; margin-top: 7px; }
      .stat-key {
        width: 62px;
        font-size: 10px;
        letter-spacing: 1.6px;
        text-transform: uppercase;
        color: var(--ash);
      }
      .stat-track {
        position: relative;
        flex: 1;
        height: 9px;
        background: rgba(0,0,0,0.5);
        border: 1px solid var(--char);
      }
      /* Ten notches, so the bar reads as a measurement rather than a glow. */
      .stat-track::after {
        content: '';
        position: absolute; inset: 0;
        background-image: repeating-linear-gradient(90deg, transparent 0 10%, rgba(0,0,0,0.65) 10%, rgba(0,0,0,0.65) calc(10% + 1px));
        pointer-events: none;
      }
      .stat-val { height: 100%; background: linear-gradient(90deg, #7d5a2c, #c98d3c); }
      .stat-num {
        width: 34px;
        text-align: right;
        font-family: var(--stencil);
        font-size: 13px;
        color: var(--bone);
      }

      .tier-item {
        padding: 12px 15px;
        border: 1px solid var(--char);
        border-left: 3px solid transparent;
        background: rgba(0,0,0,0.22);
        cursor: pointer;
      }
      .tier-item.active { border-left-color: var(--blood); background: rgba(142,35,35,0.12); }
      .tier-item:hover { background: rgba(255,255,255,0.04); }

      /* The dial: six positions, one of them "leave it scanning". */
      .tune-row {
        display: grid;
        grid-template-columns: repeat(6, 1fr);
        gap: 7px;
        margin-top: 12px;
      }
      .tune-chip {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        padding: 10px 4px 9px;
        border: 1px solid var(--char);
        background: rgba(0,0,0,0.24);
        cursor: pointer;
        text-align: center;
        transition: background 0.12s linear, border-color 0.12s linear;
      }
      .tune-chip:hover { background: rgba(255,255,255,0.05); }
      .tune-chip .tune-name {
        font-size: 9px;
        letter-spacing: 1.4px;
        text-transform: uppercase;
        color: var(--ash);
        line-height: 1.2;
      }
      .tune-chip.active { background: rgba(255,255,255,0.06); }
      .tune-chip.active .tune-name { color: var(--paper); }

      /* The frame ceiling dial. Reads as a row of switch positions. */
      .opt-row {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 7px;
        margin-top: 12px;
      }
      .opt-chip {
        padding: 10px 6px 9px;
        border: 1px solid var(--char);
        background: rgba(0,0,0,0.24);
        cursor: pointer;
        text-align: center;
        transition: background 0.12s linear, border-color 0.12s linear;
      }
      .opt-chip:hover { background: rgba(255,255,255,0.05); }
      .opt-chip .opt-num {
        font-family: var(--stencil);
        font-size: 21px;
        letter-spacing: 1.6px;
        color: var(--ash);
        line-height: 1.1;
      }
      .opt-chip .opt-note {
        font-size: 9px;
        letter-spacing: 1.4px;
        text-transform: uppercase;
        color: var(--steel);
        margin-top: 3px;
      }
      .opt-chip.active {
        border-color: var(--amber);
        background: rgba(217,164,65,0.12);
      }
      .opt-chip.active .opt-num { color: var(--amber); }
      .opt-chip.active .opt-note { color: var(--bone); }

      .mn-scrap {
        font-family: var(--stencil);
        font-size: 24px;
        letter-spacing: 2px;
        color: var(--amber);
      }
    `;
    document.head.appendChild(style);
  }

  private scrapHeader(): string {
    return `
      <div style="display:flex; align-items:center; gap:11px;">
        ${emblemSvg('scrap', 38)}
        <div style="text-align:right;">
          <div class="ll-sub" style="margin:0;">Scrap on hand</div>
          <div class="mn-scrap">${SaveSystem.getScrap()}</div>
        </div>
      </div>
    `;
  }

  // ------------------------------------------------------------------ title

  public showTitle(onEnter: () => void): void {
    const st = SaveSystem.getStats();

    this.present(`
      <div class="ll-panel ll-pinned mn-shell" style="width:620px; text-align:center; padding-top:34px;">
        <!-- the person you actually are, before any of the rest of it -->
        <div style="display:flex; align-items:center; gap:22px; text-align:left;">
          <div style="flex:0 0 auto;">
            ${callerPortrait('PLAYER', 132)}
          </div>
          <div>
            <div class="ll-sub" style="margin:0;">A roguelite of the long walk home</div>
            <div class="ll-title" style="font-size:54px; margin-top:6px;">LAST LIGHT</div>
            <div class="ll-sub">Sector by sector. Night after night.</div>
          </div>
        </div>

        <div class="ll-rule"></div>

        <div style="display:flex; justify-content:center; gap:10px; flex-wrap:wrap;">
          <div class="ll-tag scrap">${emblemChip('scrap', SaveSystem.getScrap(), 15)}</div>
          <div class="ll-tag">RUNS ${st.runs}</div>
          <div class="ll-tag">DEEPEST SECTOR ${String(st.bestSector).padStart(2, '0')}</div>
          <div class="ll-tag">PUT DOWN ${st.totalKills}</div>
        </div>

        <div style="display:flex; gap:10px; margin-top:26px;">
          <button id="btn-enter" class="ll-btn" style="flex:1;">Go Down To The Shelter</button>
          <button id="btn-settings" class="ll-btn-ghost" style="flex:0 0 auto; padding:0 18px;">SETTINGS</button>
        </div>

        <div style="margin-top:20px; font-size:11.5px; line-height:1.9; color:var(--ash); letter-spacing:0.6px;">
          <b style="color:var(--bone)">WASD</b> move &nbsp;·&nbsp;
          <b style="color:var(--bone)">MOUSE</b> aim &nbsp;·&nbsp;
          <b style="color:var(--bone)">LMB</b> fire &nbsp;·&nbsp;
          <b style="color:var(--bone)">RMB</b> heavy<br>
          <b style="color:var(--bone)">SPACE</b> roll &nbsp;·&nbsp;
          <b style="color:var(--bone)">R</b> reload &nbsp;·&nbsp;
          <b style="color:var(--bone)">F</b> shove &nbsp;·&nbsp;
          <b style="color:var(--bone)">Q</b> flare &nbsp;·&nbsp;
          <b style="color:var(--bone)">E</b> use &nbsp;·&nbsp;
          <b style="color:var(--bone)">TAB</b> run sheet
        </div>
      </div>
    `);

    document.getElementById('btn-enter')!.addEventListener('click', () => {
      this.hide();
      onEnter();
    });

    document.getElementById('btn-settings')!.addEventListener('click', () => {
      this.showSettings(() => this.showTitle(onEnter));
    });
  }

  // --------------------------------------------------------------- settings

  /**
   * The one card that is not about the run: what the machine is asked to do.
   *
   * A ceiling above the display's own refresh does nothing — the browser hands
   * out frames at the panel's rate and no setting here can invent more. The
   * lower positions are the useful ones: they buy back heat, battery and fan
   * noise on a laptop that would otherwise render 144 frames of the same
   * street.
   */
  public showSettings(onBack: () => void): void {
    const s = SaveSystem.getSettings();

    const chips = FPS_CAPS.map((cap) => {
      const active = s.fpsCap === cap;
      return `
        <div class="opt-chip ${active ? 'active' : ''}" data-fps="${cap}">
          <div class="opt-num">${cap === 0 ? '∞' : cap}</div>
          <div class="opt-note">${cap === 0 ? 'Display' : 'fps'}</div>
        </div>
      `;
    }).join('');

    this.present(`
      <div class="ll-panel ll-pinned mn-shell" style="width:640px;">
        <div class="mn-head">
          <div>
            <div class="ll-title" style="font-size:30px;">Settings</div>
            <div class="ll-sub">How hard the machine works to keep the lights on.</div>
          </div>
        </div>

        <div class="ll-sub" style="margin:18px 0 0;">Frame ceiling</div>
        <div style="font-size:12px; color:var(--ash); margin-top:6px; line-height:1.6;">
          The loop will not run faster than this. <b style="color:var(--bone)">Display</b> leaves it
          alone and takes every frame the screen offers — the way it has always worked. A ceiling
          above your screen's refresh rate changes nothing; a lower one runs cooler and quieter, and
          the game keeps real time either way.
        </div>
        <div class="opt-row">${chips}</div>

        <div class="ll-rule"></div>

        <div class="mn-row">
          <div style="flex:1;">
            <div class="mn-name" style="font-size:16px;">Frame counter</div>
            <div class="mn-note">A small readout at the top of the screen. Turns amber under 50, red under 30.</div>
          </div>
          <button id="btn-fps-toggle" class="ll-btn-ghost">${s.showFps ? 'SHOWN' : 'HIDDEN'}</button>
        </div>

        <button id="btn-back" class="ll-btn" style="margin-top:20px;">Back</button>
      </div>
    `);

    this.root.querySelectorAll<HTMLElement>('[data-fps]').forEach((el) => {
      el.addEventListener('click', () => {
        SaveSystem.setFpsCap(parseInt(el.dataset.fps!, 10));
        this.onDisplayChange?.();
        this.showSettings(onBack);
      });
    });

    document.getElementById('btn-fps-toggle')!.addEventListener('click', () => {
      SaveSystem.setShowFps(!SaveSystem.getSettings().showFps);
      this.onDisplayChange?.();
      this.showSettings(onBack);
    });

    document.getElementById('btn-back')!.addEventListener('click', () => {
      onBack();
    });
  }

  // ------------------------------------------------------------ weapon rack

  public showWeaponRack(onConfirm: (id: WeaponId) => void, onClose: () => void): void {
    this.previewWeapon = SaveSystem.getLastWeapon();
    this.renderWeaponRack(onConfirm, onClose);
  }

  private renderWeaponRack(onConfirm: (id: WeaponId) => void, onClose: () => void): void {
    const list = WEAPON_ORDER.map((id) => {
      const def = WEAPONS[id];
      const unlocked = SaveSystem.isWeaponUnlocked(id);
      const active = id === this.previewWeapon;
      const fitted = unlocked && SaveSystem.isModActive(id);
      return `
        <div class="wpn-item ${active ? 'active' : ''} ${unlocked ? '' : 'locked'}" data-wpn="${id}">
          <div class="wpn-thumb">${weaponThumb(id, 74, active ? CSS.rust : unlocked ? CSS.ash : CSS.steel)}</div>
          <div style="min-width:0; flex:1;">
            <div class="mn-name" style="font-size:15px;">${def.name}</div>
            <div class="mn-note" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
              ${unlocked ? def.model : `Locked`}
            </div>
            ${
              unlocked
                ? fitted ? `<div class="mn-note" style="color:var(--rust); margin-top:2px;">MOD FITTED</div>` : ''
                : `<div style="margin-top:3px;">${emblemChip('scrap', def.unlockCost, 14)}</div>`
            }
          </div>
        </div>
      `;
    }).join('');

    const def = WEAPONS[this.previewWeapon];
    const unlocked = SaveSystem.isWeaponUnlocked(this.previewWeapon);
    const modUnlocked = SaveSystem.isModUnlocked(def.mod.id);
    const modOn = SaveSystem.isModActive(this.previewWeapon);
    const stats = resolveWeaponStats(this.previewWeapon, modOn);
    const scrap = SaveSystem.getScrap();

    const bar = (label: string, value: number) => `
      <div class="stat-line">
        <div class="stat-key">${label}</div>
        <div class="stat-track"><div class="stat-val" style="width:${Math.round(Math.min(1, value) * 100)}%"></div></div>
        <div class="stat-num">${Math.round(Math.min(1, value) * 10)}</div>
      </div>
    `;

    const r = def.readout;
    const shotsPerSecond = (1 / stats.cooldown).toFixed(1);

    // What the gun costs in attention rather than in scrap. Measured per
    // second of held trigger, because that is what actually calls a Screamer
    // — a single loud shell is cheaper than a quiet gun you never stop firing.
    const noiseLabel = (w: typeof stats) => {
      const perSecond = w.noise / w.cooldown;
      return perSecond < 1 ? 'Silent'
        : perSecond < 4 ? 'Quiet'
        : perSecond < 7 ? 'Loud'
        : 'Deafening';
    };

    this.present(`
      <div class="ll-panel ll-pinned mn-shell ll-scroll" style="width:940px;">
        <div class="mn-head">
          <div>
            <div class="ll-title" style="font-size:30px;">Weapon Rack</div>
            <div class="ll-sub">One goes with you. The rest stay on the wall.</div>
          </div>
          ${this.scrapHeader()}
        </div>

        <div class="wpn-grid">
          <div style="display:flex; flex-direction:column; gap:7px;">${list}</div>

          <div style="display:flex; flex-direction:column;">
            <div class="wpn-plate ${unlocked ? '' : 'locked'}">
              ${unlocked ? '' : `<div class="wpn-stamp">NOT YOURS</div>`}
              ${modOn ? `<div class="wpn-stamp" style="color:var(--rust); border-color:var(--rust);">MODIFIED</div>` : ''}
              ${weaponPlate(this.previewWeapon, 560, !unlocked)}
            </div>

            <div style="display:flex; justify-content:space-between; align-items:baseline; margin-top:12px;">
              <div class="ll-title" style="font-size:26px;">${def.name}</div>
              <div class="ll-sub" style="margin:0;">${def.model}</div>
            </div>

            <div style="font-size:13.5px; line-height:1.6; color:var(--bone); margin-top:8px;">${def.desc}</div>
            <div style="font-size:12px; font-style:italic; color:var(--ash); margin-top:8px;">${def.flavor}</div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:0 22px; margin-top:14px;">
              ${bar('Power', r.power)}
              ${bar('Cadence', r.speed)}
              ${bar('Reach', r.reach)}
              ${bar('Control', r.control)}
            </div>

            <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:13px;">
              <div class="ll-tag">${stats.damage} dmg${stats.pellets > 1 ? ` × ${stats.pellets}` : ''}</div>
              <div class="ll-tag">${shotsPerSecond} / sec</div>
              <div class="ll-tag">${Math.round(stats.range)}m</div>
              <div class="ll-tag">${stats.magazine} loaded &nbsp;·&nbsp; ${stats.reload.toFixed(1)}s</div>
              <div class="ll-tag">${noiseLabel(stats)} on the street</div>
              ${stats.pierce > 0 ? `<div class="ll-tag">pierces ${stats.pierce}</div>` : ''}
            </div>

            <div style="margin-top:16px; padding:12px 14px; background:rgba(0,0,0,0.26); border:1px solid var(--char); display:flex; gap:13px; align-items:flex-start;">
              ${emblemSvg('arsenal', 40)}
              <div style="flex:1;">
                <div class="ll-sub" style="margin:0;">Heavy attack — right mouse</div>
                <div class="mn-name" style="font-size:16px; margin-top:3px;">${def.alt.name}</div>
                <div class="mn-note">${def.alt.desc} &nbsp;·&nbsp; ${def.alt.cooldown.toFixed(1)}s between uses</div>
              </div>
            </div>

            <div style="margin-top:12px; padding:12px 14px; background:rgba(0,0,0,0.26); border:1px solid ${modOn ? CSS.rust : CSS.char};">
              <div style="display:flex; justify-content:space-between; align-items:center; gap:14px;">
                <div style="flex:1;">
                  <div class="mn-name" style="font-size:15px;">${def.mod.name}</div>
                  <div class="mn-note">${def.mod.desc}</div>
                </div>
                ${
                  !unlocked
                    ? `<div class="ll-tag">rack it first</div>`
                    : modUnlocked
                      ? `<button id="btn-mod-toggle" class="ll-btn-ghost">${modOn ? 'FITTED' : 'NOT FITTED'}</button>`
                      : `<button id="btn-mod-buy" class="ll-btn-ghost" ${scrap < def.mod.cost ? 'disabled' : ''}>
                           ${emblemChip('scrap', def.mod.cost, 14, scrap < def.mod.cost ? CSS.blood : undefined)}
                         </button>`
                }
              </div>
            </div>

            <div style="display:flex; gap:10px; margin-top:18px;">
              ${
                unlocked
                  ? `<button id="btn-take" class="ll-btn">Take ${def.name}</button>`
                  : `<button id="btn-unlock" class="ll-btn" ${scrap < def.unlockCost ? 'disabled' : ''}>
                       Buy it off the wall — ${def.unlockCost} scrap
                     </button>`
              }
              <button id="btn-close" class="ll-btn-ghost" style="white-space:nowrap;">BACK</button>
            </div>
          </div>
        </div>
      </div>
    `);

    this.root.querySelectorAll<HTMLElement>('.wpn-item').forEach((el) => {
      el.addEventListener('click', () => {
        this.previewWeapon = el.dataset.wpn as WeaponId;
        this.renderWeaponRack(onConfirm, onClose);
      });
    });

    document.getElementById('btn-close')!.addEventListener('click', () => {
      this.hide();
      onClose();
    });

    document.getElementById('btn-take')?.addEventListener('click', () => {
      SaveSystem.setLastWeapon(this.previewWeapon);
      this.hide();
      onConfirm(this.previewWeapon);
    });

    document.getElementById('btn-unlock')?.addEventListener('click', () => {
      if (SaveSystem.unlockWeapon(this.previewWeapon)) {
        this.renderWeaponRack(onConfirm, onClose);
      }
    });

    document.getElementById('btn-mod-buy')?.addEventListener('click', () => {
      if (SaveSystem.unlockMod(this.previewWeapon)) {
        this.renderWeaponRack(onConfirm, onClose);
      }
    });

    document.getElementById('btn-mod-toggle')?.addEventListener('click', () => {
      SaveSystem.toggleMod(this.previewWeapon);
      this.renderWeaponRack(onConfirm, onClose);
    });
  }

  // -------------------------------------------------------------- workbench

  public showWorkbench(onClose: () => void): void {
    const scrap = SaveSystem.getScrap();
    const meta = SaveSystem.getMeta();

    const rows = META_DEFS.map((d) => {
      const rank = meta[d.key] ?? 0;
      const maxed = rank >= d.maxRank;
      const cost = d.cost(rank);
      const pips = Array.from({ length: d.maxRank })
        .map((_, i) => `<span class="mn-pip ${i < rank ? 'on' : ''}"></span>`)
        .join('');

      return `
        <div class="mn-row" style="border-left-color:${maxed ? CSS.amber : CSS.steel};">
          <div style="flex:1;">
            <div class="mn-name" style="font-size:16px;">${d.name}</div>
            <div class="mn-note">${rank === 0 ? d.desc(1) + ' at rank 1' : d.desc(rank)}</div>
            <div style="margin-top:7px;">${pips}</div>
          </div>
          <button class="ll-btn-ghost" data-meta="${d.key}" ${maxed || scrap < cost ? 'disabled' : ''}>
            ${maxed ? 'DONE' : emblemChip('scrap', cost, 15, scrap < cost ? CSS.blood : undefined)}
          </button>
        </div>
      `;
    }).join('');

    this.present(`
      <div class="ll-panel ll-pinned mn-shell" style="width:720px;">
        <div class="mn-head">
          <div>
            <div class="ll-title" style="font-size:30px;">Workbench</div>
            <div class="ll-sub">Work that stays done, even when you don't come back.</div>
          </div>
          ${this.scrapHeader()}
        </div>

        <div style="display:flex; flex-direction:column; gap:9px; margin-top:18px;">${rows}</div>

        <button id="btn-close" class="ll-btn" style="margin-top:20px;">Back To The Shelter</button>
      </div>
    `);

    this.root.querySelectorAll<HTMLElement>('[data-meta]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.meta as (typeof META_DEFS)[number]['key'];
        if (SaveSystem.buyMetaRank(key)) this.showWorkbench(onClose);
      });
    });

    document.getElementById('btn-close')!.addEventListener('click', () => {
      this.hide();
      onClose();
    });
  }

  // ------------------------------------------------------------------- pens

  /**
   * The pens card. Same contract as the weapon rack — one goes with you and
   * the rest stay behind — with the difference that the rest are alive, which
   * is why "nobody tonight" is a button on this card and not on that one.
   *
   * `onPick` fires on every change rather than only on close, because the
   * shelter has a pen in the corner and whatever is chosen has to be standing
   * in it by the time the card comes down.
   */
  public showPens(onPick: (id: AnimalId | null) => void, onClose: () => void): void {
    this.previewAnimal = SaveSystem.getAtHeel() ?? ANIMAL_ORDER[0];
    this.renderPens(onPick, onClose);
  }

  private renderPens(onPick: (id: AnimalId | null) => void, onClose: () => void): void {
    const atHeel = SaveSystem.getAtHeel();
    const scrap = SaveSystem.getScrap();

    const list = ANIMAL_ORDER.map((id) => {
      const a = ANIMALS[id];
      const owned = SaveSystem.isPenned(id);
      const active = id === this.previewAnimal;
      return `
        <div class="wpn-item ${active ? 'active' : ''} ${owned ? '' : 'locked'}" data-pen="${id}">
          <div class="wpn-thumb">${animalMark(id, 46, active ? CSS.rust : owned ? CSS.bone : CSS.steel)}</div>
          <div style="min-width:0; flex:1;">
            <div class="mn-name" style="font-size:15px;">${a.name}</div>
            <div class="mn-note" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
              ${owned ? a.roleName : 'Still in the yard'}
            </div>
            ${
              owned
                ? atHeel === id ? `<div class="mn-note" style="color:var(--rust); margin-top:2px;">COMING WITH YOU</div>` : ''
                : `<div style="margin-top:3px;">${emblemChip('scrap', a.cost, 14, scrap < a.cost ? CSS.blood : undefined)}</div>`
            }
          </div>
        </div>
      `;
    }).join('');

    const a = ANIMALS[this.previewAnimal];
    const owned = SaveSystem.isPenned(this.previewAnimal);
    const chosen = atHeel === this.previewAnimal;

    const bar = (label: string, value: number) => `
      <div class="stat-line">
        <div class="stat-key">${label}</div>
        <div class="stat-track"><div class="stat-val" style="width:${Math.round(Math.min(1, value) * 100)}%"></div></div>
        <div class="stat-num">${Math.round(Math.min(1, value) * 10)}</div>
      </div>
    `;

    // Two of the seven do no damage at all, and the card has to say so rather
    // than draw them an empty bar and let the player wonder what broke.
    const fights = a.strike.damage > 0;

    this.present(`
      <div class="ll-panel ll-pinned mn-shell ll-scroll" style="width:900px;">
        <div class="mn-head">
          <div>
            <div class="ll-title" style="font-size:30px;">The Pens</div>
            <div class="ll-sub">One of them comes with you. They all get fed either way.</div>
          </div>
          ${this.scrapHeader()}
        </div>

        <div class="wpn-grid">
          <div style="display:flex; flex-direction:column; gap:7px;">
            ${list}
            <!-- Not given the active class: on this list active means "the one
                 you are reading about", and the choice itself is carried by the
                 tag, the same way it is on the animals. -->
            <div class="wpn-item" data-pen="" style="margin-top:4px;">
              <div class="wpn-thumb" style="width:46px; height:46px;"></div>
              <div style="flex:1;">
                <div class="mn-name" style="font-size:15px;">Nobody</div>
                <div class="mn-note">Go out on your own</div>
                ${atHeel === null ? `<div class="mn-note" style="color:var(--rust); margin-top:2px;">NOBODY TONIGHT</div>` : ''}
              </div>
            </div>
          </div>

          <div style="display:flex; flex-direction:column;">
            <div class="wpn-plate ${owned ? '' : 'locked'}" style="display:flex; justify-content:center; padding:22px;">
              ${owned ? '' : `<div class="wpn-stamp">NOT FED YET</div>`}
              ${chosen ? `<div class="wpn-stamp" style="color:${CSS.rust}; border-color:${CSS.rust};">AT YOUR HEEL</div>` : ''}
              ${animalMark(this.previewAnimal, 210, owned ? CSS.bone : CSS.steel)}
            </div>

            <div style="display:flex; justify-content:space-between; align-items:baseline; margin-top:12px;">
              <div class="ll-title" style="font-size:26px;">${a.name}</div>
              <div class="ll-sub" style="margin:0;">${a.species}</div>
            </div>

            <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:10px;">
              <div class="ll-tag" style="color:var(--rust); border-color:var(--rust);">${a.roleName}</div>
              ${fights ? `<div class="ll-tag">${a.strike.damage} a hit</div>` : `<div class="ll-tag">Never fights</div>`}
              ${fights ? `<div class="ll-tag">every ${a.strike.cooldown.toFixed(1)}s</div>` : ''}
              ${a.flies ? `<div class="ll-tag">Off the ground</div>` : ''}
            </div>

            <div style="font-size:13.5px; line-height:1.6; color:var(--bone); margin-top:10px;">${a.desc}</div>
            <div style="font-size:12px; font-style:italic; color:var(--ash); margin-top:8px;">${a.flavor}</div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:0 22px; margin-top:14px;">
              ${bar('Grit', a.grit / 320)}
              ${bar('Pace', a.speed / 15)}
              ${bar('Bite', a.strike.damage / 75)}
              ${bar('Range', a.leash / 20)}
            </div>

            <div style="font-size:12px; color:var(--ash); margin-top:14px; line-height:1.6;">
              Nothing out of the pens dies out there. Enough contact with the dead and it goes
              down in the road — and it is back on its feet the moment the street is clear.
            </div>

            <div style="display:flex; gap:10px; margin-top:18px;">
              ${
                !owned
                  ? `<button id="btn-pen-buy" class="ll-btn" ${scrap < a.cost ? 'disabled' : ''}>
                       Feed ${a.name} — ${a.cost} scrap
                     </button>`
                  : chosen
                    ? `<button id="btn-pen-drop" class="ll-btn-ghost" style="flex:1;">Leave ${a.name} here tonight</button>`
                    : `<button id="btn-pen-take" class="ll-btn">Take ${a.name}</button>`
              }
              <button id="btn-close" class="ll-btn-ghost" style="white-space:nowrap;">BACK</button>
            </div>
          </div>
        </div>
      </div>
    `);

    this.root.querySelectorAll<HTMLElement>('[data-pen]').forEach((el) => {
      el.addEventListener('click', () => {
        const id = el.dataset.pen as AnimalId | '';
        if (!id) {
          // The "nobody" row is a choice, not a preview.
          SaveSystem.setAtHeel(null);
          onPick(null);
        } else {
          this.previewAnimal = id;
        }
        this.renderPens(onPick, onClose);
      });
    });

    document.getElementById('btn-pen-buy')?.addEventListener('click', () => {
      if (!SaveSystem.takeIn(this.previewAnimal)) return;
      // Anything you have just fed is obviously the thing you came in for.
      SaveSystem.setAtHeel(this.previewAnimal);
      onPick(this.previewAnimal);
      this.renderPens(onPick, onClose);
    });

    document.getElementById('btn-pen-take')?.addEventListener('click', () => {
      SaveSystem.setAtHeel(this.previewAnimal);
      onPick(this.previewAnimal);
      this.renderPens(onPick, onClose);
    });

    document.getElementById('btn-pen-drop')?.addEventListener('click', () => {
      SaveSystem.setAtHeel(null);
      onPick(null);
      this.renderPens(onPick, onClose);
    });

    document.getElementById('btn-close')!.addEventListener('click', () => {
      this.hide();
      onClose();
    });
  }

  // ------------------------------------------------------------------ radio

  public showRadio(onClose: () => void): void {
    const current = SaveSystem.getNightLevel();
    const prog = logProgress((id) => SaveSystem.hasHeardLine(id));
    const tuned = SaveSystem.getTuned();

    // A survivor nobody has ever heard from cannot be tuned to — the dial only
    // holds the frequencies the player has actually found.
    const tuning = [
      ...ALL_CALLERS.map((id) => {
        const c = CALLERS[id];
        const known = SaveSystem.heardFrom(id) > 0;
        return `
          <div class="tune-chip ${tuned === id ? 'active' : ''}" data-tune="${id}"
               style="${tuned === id ? `border-color:${c.color};` : ''} ${known ? '' : 'opacity:0.4;'}">
            ${callerSigil(id, 26, known ? c.color : CSS.steel)}
            <div class="tune-name">${known ? c.name : 'STATIC'}</div>
          </div>
        `;
      }),
      `<div class="tune-chip ${tuned === null ? 'active' : ''}" data-tune="">
         ${emblemSvg('signal', 26)}
         <div class="tune-name">Scanning</div>
       </div>`
    ].join('');

    const rows = NIGHT_TIERS.map((t) => `
      <div class="tier-item ${t.level === current ? 'active' : ''}" data-night="${t.level}">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:16px;">
          <div style="flex:1;">
            <div class="mn-name" style="font-size:17px;">${t.level}. ${t.name}</div>
            <div class="mn-note">${t.desc}</div>
          </div>
          <div style="text-align:right; white-space:nowrap;">
            <div class="ll-tag scrap">${emblemChip('scrap', `×${t.scrapMult.toFixed(1)}`, 14)}</div>
            <div class="mn-note" style="margin-top:5px;">
              +${Math.round((t.enemyHealth - 1) * 100)}% health · +${Math.round((t.enemyCount - 1) * 100)}% numbers
            </div>
          </div>
        </div>
      </div>
    `).join('');

    this.present(`
      <div class="ll-panel ll-pinned mn-shell" style="width:700px;">
        <div class="mn-head">
          <div>
            <div class="ll-title" style="font-size:30px;">Radio Set</div>
            <div class="ll-sub">The band tells you how much is moving tonight. You choose when to go.</div>
          </div>
          ${this.scrapHeader()}
        </div>

        <div style="display:flex; flex-direction:column; gap:8px; margin-top:18px;">${rows}</div>

        <div style="font-size:12px; color:var(--ash); margin-top:14px; line-height:1.6;">
          Harder nights make everything out there tougher, faster and more numerous — and multiply
          every piece of scrap you bring home. Set it and forget it; it applies to every run until
          you change it.
        </div>

        <div class="ll-rule"></div>

        <div class="ll-sub" style="margin:0;">Leave the dial somewhere</div>
        <div style="font-size:12px; color:var(--ash); margin-top:6px; line-height:1.6;">
          Whoever the set is left on is the first voice you find on a gate out there. After that the
          band deals itself — and once four of them have handed you something, the rest go quiet for
          the night.
        </div>

        <div class="tune-row">${tuning}</div>

        <div style="display:flex; gap:10px; margin-top:18px;">
          <button id="btn-close" class="ll-btn" style="flex:1;">Switch It Off</button>
          <button id="btn-log" class="ll-btn-ghost" style="flex:0 0 auto; padding:0 18px;">
            Transcript · ${prog.heard}/${prog.total}
          </button>
        </div>
      </div>
    `);

    this.root.querySelectorAll<HTMLElement>('[data-night]').forEach((el) => {
      el.addEventListener('click', () => {
        SaveSystem.setNightLevel(parseInt(el.dataset.night!, 10));
        this.showRadio(onClose);
      });
    });

    this.root.querySelectorAll<HTMLElement>('[data-tune]').forEach((el) => {
      el.addEventListener('click', () => {
        const id = el.dataset.tune as CallerArtId | '';
        // A voice the player has never heard is a frequency they do not have.
        if (id && SaveSystem.heardFrom(id) === 0) return;
        SaveSystem.setTuned(id === '' ? null : id);
        this.showRadio(onClose);
      });
    });

    document.getElementById('btn-log')!.addEventListener('click', () => {
      this.showTranscript(onClose);
    });

    document.getElementById('btn-close')!.addEventListener('click', () => {
      this.hide();
      onClose();
    });
  }

  /**
   * Everything the band has said so far, in the order it was written rather
   * than the order it was heard — the log reads as one continuous account that
   * happens to have gaps in it, and the gaps are the point.
   */
  private showTranscript(onClose: () => void): void {
    const seen = (id: string) => SaveSystem.hasHeardLine(id);
    const lines = heardLines(seen);
    const prog = logProgress(seen);

    const entries = lines.length === 0
      ? `<div class="mn-note" style="padding:26px 0; text-align:center;">
           Nothing logged. Nobody talks to a handset that has not been anywhere.
         </div>`
      : lines.map((l) => {
          const c = CALLERS[l.caller];
          const body = l.text.map((p) => `<p style="margin:0 0 7px;">${p}</p>`).join('');
          return `
            <div style="display:flex; gap:12px; padding:13px 0; border-bottom:1px solid var(--char);">
              <div style="flex:0 0 auto; padding-top:2px;">${callerSigil(l.caller, 18, c.color)}</div>
              <div style="flex:1; min-width:0;">
                <div class="mn-name" style="font-size:12px; color:${c.color}; letter-spacing:1.6px;">
                  ${c.name} <span style="color:var(--ash); letter-spacing:1.2px;">· ${c.band}</span>
                </div>
                <div style="font-size:13.5px; line-height:1.6; color:var(--bone); margin-top:6px;">${body}</div>
              </div>
            </div>
          `;
        }).join('');

    this.present(`
      <div class="ll-panel ll-pinned mn-shell" style="width:760px;">
        <div class="mn-head">
          <div>
            <div class="ll-title" style="font-size:30px;">Transcript</div>
            <div class="ll-sub">${prog.heard} of ${prog.total} logged. The rest have not been said yet.</div>
          </div>
          ${this.scrapHeader()}
        </div>

        <div class="ll-scroll" style="max-height:52vh; overflow-y:auto; margin-top:14px; padding-right:8px;">
          ${entries}
        </div>

        <button id="btn-back" class="ll-btn" style="margin-top:18px;">Back To The Set</button>
      </div>
    `);

    document.getElementById('btn-back')!.addEventListener('click', () => {
      this.showRadio(onClose);
    });
  }

  // ------------------------------------------------------------- pin board

  /**
   * THE LIST — what the band has asked for, and what is finished.
   *
   * A finished card is not paid automatically. The player has to come here and
   * take it down, which is the only reason anybody ever reads the thing twice.
   */
  public showList(board: BoardBinding, onClose: () => void): void {
    const ctx = board.context();
    const views = readBoard(ctx);
    const ready = views.filter((v) => v.state === 'READY').length;
    const done = views.filter((v) => v.state === 'CLAIMED').length;

    const cards = views.map((v, i) => {
      const p = v.prophecy;
      const c = CALLERS[p.caller];
      const pctDone = Math.round((v.progress / p.target) * 100);

      const foot = v.state === 'CLAIMED'
        ? `<div class="mn-note" style="color:${c.color}; letter-spacing:1.6px; text-transform:uppercase;">
             Taken down · paid ${p.reward}
           </div>`
        : v.state === 'READY'
          ? `<button class="ll-btn" data-claim="${i}" style="padding:7px 14px; font-size:13px;">
               Take It Down — +${p.reward} scrap
             </button>`
          : `<div style="display:flex; align-items:center; gap:10px;">
               <div style="flex:1; height:5px; background:rgba(0,0,0,0.45); border:1px solid var(--char);">
                 <div style="width:${pctDone}%; height:100%; background:${c.color};"></div>
               </div>
               <div class="mn-note" style="white-space:nowrap; font-family:var(--stencil); font-size:14px; color:var(--paper);">
                 ${v.progress} / ${p.target}
               </div>
             </div>`;

      return `
        <div style="
          padding:13px 15px;
          background:rgba(0,0,0,${v.state === 'CLAIMED' ? '0.16' : '0.26'});
          border:1px solid var(--char);
          border-left:3px solid ${c.color};
          opacity:${v.state === 'CLAIMED' ? '0.55' : '1'};
        ">
          <div style="display:flex; align-items:center; gap:8px;">
            ${callerSigil(p.caller, 15, c.color)}
            <div class="mn-name" style="font-size:15px;">${p.title}</div>
            <div class="mn-note" style="margin-left:auto; color:${c.color}; letter-spacing:1.4px;">${c.name}</div>
          </div>
          <div class="mn-note" style="margin-top:6px; line-height:1.6; font-style:italic;">${p.text}</div>
          <div style="margin-top:11px;">${foot}</div>
        </div>
      `;
    }).join('');

    this.present(`
      <div class="ll-panel ll-pinned mn-shell" style="width:820px;">
        <div class="mn-head">
          <div>
            <div class="ll-title" style="font-size:30px;">The List</div>
            <div class="ll-sub">
              ${done} taken down${ready > 0 ? ` · <span style="color:var(--amber);">${ready} finished and unpaid</span>` : ''}
            </div>
          </div>
          ${this.scrapHeader()}
        </div>

        <div class="ll-scroll" style="max-height:56vh; overflow-y:auto; margin-top:16px; padding-right:8px;
                                      display:flex; flex-direction:column; gap:9px;">
          ${cards}
        </div>

        <div style="display:flex; gap:10px; margin-top:18px;">
          <button id="btn-close" class="ll-btn" style="flex:1;">Back To The Shelter</button>
          <button id="btn-records" class="ll-btn-ghost" style="flex:0 0 auto; padding:0 18px;">Records</button>
        </div>
      </div>
    `);

    this.root.querySelectorAll<HTMLElement>('[data-claim]').forEach((el) => {
      el.addEventListener('click', () => {
        board.claim(views[parseInt(el.dataset.claim!, 10)]);
        this.showList(board, onClose);
      });
    });

    document.getElementById('btn-records')!.addEventListener('click', () => {
      this.showRecords(board, onClose);
    });

    document.getElementById('btn-close')!.addEventListener('click', () => {
      this.hide();
      onClose();
    });
  }

  // ---------------------------------------------------------------- records

  public showRecords(board: BoardBinding, onClose: () => void): void {
    const st = SaveSystem.getStats();

    const stat = (label: string, value: string | number) => `
      <div style="padding:11px 13px; background:rgba(0,0,0,0.24); border:1px solid var(--char);">
        <div class="ll-sub" style="margin:0;">${label}</div>
        <div style="font-family:var(--stencil); font-size:23px; color:var(--paper); margin-top:2px;">${value}</div>
      </div>
    `;

    // The band, as a wall of faces. Same portraits the gates and cards use, so
    // a survivor is recognisable from the doorway before the name is readable.
    const callerRows = (Object.keys(CALLERS) as CallerArtId[]).map((k) => {
      const c = CALLERS[k];
      return `
        <div style="background:rgba(0,0,0,0.24); border:1px solid var(--char); border-bottom:3px solid ${c.color};">
          ${callerPortrait(k, 138)}
          <div style="padding:8px 10px 10px;">
            <div style="display:flex; align-items:center; gap:7px;">
              ${callerSigil(k, 16, c.color)}
              <div class="mn-name" style="font-size:13px; color:${c.color}; letter-spacing:1.4px;">${c.name}</div>
            </div>
            <div class="mn-note" style="margin-top:3px;">${c.band}</div>
            <div class="mn-note" style="font-style:italic; margin-top:5px; color:var(--steel);">${c.sting}</div>
          </div>
        </div>
      `;
    }).join('');

    // The layer that rides on the bodies above. Painted from the same table
    // the game plays from, so the board can never describe a rule that is not
    // the rule — and in the marked's own colour, which is the only way the
    // player connects the card to the thing on the street.
    const marked = MARK_ORDER.map((id) => {
      const m = MARKS[id];
      return `
        <div style="padding:9px 12px; background:rgba(0,0,0,0.2); border:1px solid var(--char);">
          <div class="mn-name" style="font-size:14px; color:#9fc4dd;">${m.name}</div>
          <div class="mn-note">${m.desc}</div>
        </div>
      `;
    }).join('');

    const bestiary = [
      ['Shambler', 'Slow, weak, endless. It is the count that kills you.'],
      ['Sprinter', 'Fresh turns still run. Deal with these first.'],
      ['Bloater', 'Hangs back and spits bile. Close the distance or drop it.'],
      ['Butcher', 'Two hundred pounds of nothing left. Do not let it corner you.'],
      ['Burster', 'Swells up next to you and goes off. Shove it away or shoot it early.'],
      ['Screamer', 'Hangs back where you cannot be bothered to go, draws breath, and hands the whole waiting crowd your position. Kill it while it is filling its lungs. Loud guns bring more of them.'],
      ['Clinger', 'Throws itself at you and holds on. It barely hurts — what it costs is the seconds, standing still, with the rest of the street walking in. Roll through the lunge, boot it off with F, or let the animal take it.'],
      ['The Behemoth', 'Slams where you are standing. Keep moving and it never lands.']
    ].map(([n, d]) => `
      <div style="padding:9px 12px; background:rgba(0,0,0,0.2); border:1px solid var(--char);">
        <div class="mn-name" style="font-size:14px;">${n}</div>
        <div class="mn-note">${d}</div>
      </div>
    `).join('');

    this.present(`
      <div class="ll-panel ll-pinned mn-shell ll-scroll" style="width:800px;">
        <div class="mn-head">
          <div>
            <div class="ll-title" style="font-size:30px;">Pin Board</div>
            <div class="ll-sub">What you have learned, and what it cost.</div>
          </div>
          ${this.scrapHeader()}
        </div>

        <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:9px; margin-top:18px;">
          ${stat('Runs', st.runs)}
          ${stat('Never came back', st.deaths)}
          ${stat('Deepest sector', String(st.bestSector).padStart(2, '0'))}
          ${stat('Total put down', st.totalKills)}
          ${stat('Best score', st.bestScore)}
          ${stat('Behemoths killed', st.clears)}
        </div>

        <div class="ll-rule"></div>
        <div class="ll-sub" style="margin:0 0 10px;">Voices on the band</div>
        <div style="display:grid; grid-template-columns:repeat(5,1fr); gap:8px;">${callerRows}</div>

        <div class="ll-rule"></div>
        <div class="ll-sub" style="margin:0 0 10px;">What is out there</div>
        <div style="display:grid; grid-template-columns:repeat(2,1fr); gap:7px;">${bestiary}</div>

        <div class="ll-rule"></div>
        <div class="ll-sub" style="margin:0 0 10px;">And the ones with something the matter with them</div>
        <div style="display:grid; grid-template-columns:repeat(2,1fr); gap:7px;">${marked}</div>

        <div style="display:flex; gap:10px; margin-top:20px;">
          <button id="btn-close" class="ll-btn">Back To The Shelter</button>
          <button id="btn-list" class="ll-btn-ghost" style="white-space:nowrap;">THE LIST</button>
          <button id="btn-wipe" class="ll-btn-ghost" style="white-space:nowrap;">BURN THE RECORDS</button>
        </div>
      </div>
    `);

    document.getElementById('btn-list')!.addEventListener('click', () => {
      this.showList(board, onClose);
    });

    document.getElementById('btn-close')!.addEventListener('click', () => {
      this.hide();
      onClose();
    });

    // Destructive, so it takes a second, explicit confirmation.
    const wipe = document.getElementById('btn-wipe')!;
    let armed = false;
    wipe.addEventListener('click', () => {
      if (!armed) {
        armed = true;
        wipe.textContent = 'CLICK AGAIN TO ERASE EVERYTHING';
        wipe.style.color = CSS.blood;
        wipe.style.borderColor = CSS.blood;
        setTimeout(() => {
          if (!armed) return;
          armed = false;
          wipe.textContent = 'BURN THE RECORDS';
          wipe.style.color = '';
          wipe.style.borderColor = '';
        }, 4000);
        return;
      }
      SaveSystem.wipe();
      this.showRecords(board, onClose);
    });
  }

  // ------------------------------------------------------------------ pause

  public showPause(onResume: () => void, onAbandon: () => void): void {
    this.present(`
      <div class="ll-panel ll-pinned mn-shell" style="width:430px; text-align:center;">
        <div class="ll-title" style="font-size:34px;">Holding Still</div>
        <div class="ll-sub">Nothing out there is waiting politely.</div>
        <div class="ll-rule"></div>
        <button id="btn-resume" class="ll-btn">Keep Going</button>
        <button id="btn-settings" class="ll-btn-ghost" style="width:100%; margin-top:11px;">SETTINGS</button>
        <button id="btn-abandon" class="ll-btn-ghost" style="width:100%; margin-top:9px;">
          WALK AWAY — KEEP THE SCRAP, LOSE THE RUN
        </button>
      </div>
    `);

    document.getElementById('btn-resume')!.addEventListener('click', () => {
      this.hide();
      onResume();
    });
    document.getElementById('btn-settings')!.addEventListener('click', () => {
      this.showSettings(() => this.showPause(onResume, onAbandon));
    });
    document.getElementById('btn-abandon')!.addEventListener('click', () => {
      this.hide();
      onAbandon();
    });
  }

  // ------------------------------------------------------------------ debrief

  public showRunEnd(summary: RunSummary, onReturn: () => void): void {
    const mins = Math.floor(summary.duration / 60);
    const secs = Math.floor(summary.duration % 60);

    this.present(`
      <div class="ll-panel ll-pinned mn-shell" style="width:560px; text-align:center;">
        <div style="display:flex; align-items:center; gap:20px; text-align:left;">
          <div style="flex:0 0 auto; ${summary.survived ? '' : 'filter:grayscale(0.75) brightness(0.62);'}">
            ${callerPortrait('PLAYER', 116)}
          </div>
          <div>
            <div class="ll-sub" style="margin:0;">${summary.survived ? 'The street is quiet' : summary.cause}</div>
            <div class="ll-title" style="font-size:34px; margin-top:6px; color:${summary.survived ? CSS.paper : CSS.blood};">
              ${summary.survived ? 'YOU MADE IT BACK' : 'YOU DID NOT MAKE IT'}
            </div>
            <div class="ll-sub">Sector ${String(summary.sector).padStart(2, '0')} — ${summary.sectorName}</div>
          </div>
        </div>

        <div class="ll-rule"></div>

        <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:9px;">
          <div>
            <div class="ll-sub" style="margin:0;">Put down</div>
            <div style="font-family:var(--stencil); font-size:27px;">${summary.kills}</div>
          </div>
          <div>
            <div class="ll-sub" style="margin:0;">Scrap banked</div>
            <div style="display:flex; align-items:center; justify-content:center; gap:8px; font-family:var(--stencil); font-size:27px; color:var(--amber);">
              ${emblemSvg('scrap', 24)}${summary.scrapBanked}
            </div>
            ${summary.scrapLost > 0 ? `
              <div style="font-family:var(--stencil); font-size:14px; color:${CSS.blood}; margin-top:2px;">
                ${summary.scrapLost} left in the street
              </div>` : ''}
          </div>
          <div>
            <div class="ll-sub" style="margin:0;">Time out</div>
            <div style="font-family:var(--stencil); font-size:27px;">${mins}:${String(secs).padStart(2, '0')}</div>
          </div>
        </div>

        <div style="font-size:12.5px; color:var(--ash); margin-top:18px; line-height:1.6;">
          You carried <b style="color:var(--bone)">${summary.weapon}</b>.
          ${summary.scrapCarried === 0
            ? 'You came back with nothing in your pockets either way.'
            : summary.survived
              ? `All ${summary.scrapCarried} of it came back through the door with you.`
              : `You were carrying ${summary.scrapCarried}. Most of what was in your pockets is still out there.`}
        </div>

        <div style="font-size:10.5px; letter-spacing:2.4px; color:var(--steel); margin-top:12px; text-transform:uppercase;">
          Night ${summary.seed}
        </div>

        <button id="btn-return" class="ll-btn" style="margin-top:22px;">Back Down To The Shelter</button>
      </div>
    `);

    document.getElementById('btn-return')!.addEventListener('click', () => {
      this.hide();
      onReturn();
    });
  }
}
