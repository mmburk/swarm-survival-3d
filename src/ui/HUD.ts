import * as THREE from 'three';
import { injectTheme, CSS } from '../theme/Palette';

interface DamageText {
  el: HTMLElement;
  active: boolean;
  pos: THREE.Vector3;
  life: number;
  maxLife: number;
}

export interface Vitals {
  health: number;
  maxHealth: number;
  stamina: number;
  maxStamina: number;
  adrenaline: number;
  maxAdrenaline: number;
  getUps: number;
  maxGetUps: number;
}

const tempVec = new THREE.Vector3();

/**
 * Everything on the glass. Painted like a field kit: stencilled labels,
 * canvas-and-tape panels, no bloom and no cyan.
 */
export class HUD {
  private root: HTMLElement;

  private healthFill!: HTMLElement;
  private healthText!: HTMLElement;
  private staminaFill!: HTMLElement;
  private flareFill!: HTMLElement;
  private getUpRow!: HTMLElement;

  private sectorName!: HTMLElement;
  private sectorIndex!: HTMLElement;
  private objectiveEl!: HTMLElement;
  private nightEl!: HTMLElement;

  private scrapEl!: HTMLElement;
  private killsEl!: HTMLElement;
  private streakEl!: HTMLElement;

  private weaponName!: HTMLElement;
  private weaponModel!: HTMLElement;
  private altKey!: HTMLElement;
  private shoveKey!: HTMLElement;
  private flareKey!: HTMLElement;

  private promptEl!: HTMLElement;
  private toastEl!: HTMLElement;
  private bannerEl!: HTMLElement;
  private bossWrap!: HTMLElement;
  private bossFill!: HTMLElement;
  private cacheEl!: HTMLElement;
  private vignette!: HTMLElement;
  private crosshair!: HTMLElement;

  private minimapCanvas!: HTMLCanvasElement;
  private minimapCtx!: CanvasRenderingContext2D;

  private dmgContainer!: HTMLElement;
  private dmgPool: DamageText[] = [];

  private uiTimer = 0;
  private minimapTimer = 0;
  private toastTimer = 0;
  private bannerTimer = 0;
  private streakTimer = 0;

  public onToggleMute: (() => boolean) | null = null;

  constructor() {
    injectTheme();

    this.root = document.createElement('div');
    this.root.id = 'hud';
    this.root.style.cssText = `
      position: absolute; inset: 0;
      pointer-events: none;
      font-family: var(--body);
      user-select: none;
      z-index: 10;
      color: var(--bone);
    `;
    document.body.appendChild(this.root);

    this.build();
    this.buildDamagePool();
  }

  private build(): void {
    this.root.innerHTML = `
      <style>
        .hud-card {
          background: linear-gradient(180deg, rgba(30,33,22,0.86) 0%, rgba(14,16,10,0.9) 100%);
          border: 1px solid rgba(42,45,34,0.95);
          border-radius: 2px;
          padding: 11px 14px;
          box-shadow: 0 6px 20px rgba(0,0,0,0.5);
        }
        .hud-label {
          font-size: 9.5px;
          letter-spacing: 2.2px;
          text-transform: uppercase;
          color: var(--ash);
        }
        .hud-bar {
          position: relative;
          width: 236px;
          height: 13px;
          background: rgba(0,0,0,0.55);
          border: 1px solid rgba(42,45,34,0.9);
          overflow: hidden;
        }
        .hud-bar-fill {
          height: 100%;
          width: 100%;
          transition: width 0.12s linear;
        }
        /* Segment ticks so the bar reads as a quantity, not a glow. */
        .hud-bar::after {
          content: '';
          position: absolute; inset: 0;
          background-image: repeating-linear-gradient(
            90deg, transparent 0 22px, rgba(0,0,0,0.55) 22px 24px);
          pointer-events: none;
        }
        #hp-fill     { background: linear-gradient(180deg, #a93030, #6d1c1c); }
        #hp-fill.low { background: linear-gradient(180deg, #d05a2a, #8e2323); }
        #stam-fill   { background: linear-gradient(180deg, #7d8a5c, #4b5436); }
        #flare-fill  { background: linear-gradient(180deg, #d9a441, #8a6826); }
        #boss-fill   { background: linear-gradient(180deg, #9b3030, #5e1616); }

        .key-cap {
          display: inline-grid;
          place-content: center;
          min-width: 22px;
          height: 20px;
          padding: 0 5px;
          font-size: 10px;
          font-weight: 700;
          color: var(--bone);
          background: rgba(0,0,0,0.5);
          border: 1px solid var(--steel);
          border-bottom-width: 2px;
          border-radius: 2px;
        }
        .abil {
          display: flex;
          align-items: center;
          gap: 7px;
          font-size: 10.5px;
          letter-spacing: 1.4px;
          text-transform: uppercase;
          color: var(--ash);
          transition: color 0.15s linear, opacity 0.15s linear;
        }
        .abil.ready { color: var(--bone); }
        .abil.cooling { opacity: 0.45; }

        #interact-prompt {
          position: absolute;
          bottom: 132px;
          left: 50%;
          transform: translateX(-50%);
          display: none;
          text-align: center;
          background: linear-gradient(180deg, rgba(32,35,24,0.94), rgba(15,17,11,0.96));
          border: 1px solid var(--steel);
          border-radius: 2px;
          padding: 10px 22px;
          animation: llFadeUp 0.14s ease-out;
        }
        #toast {
          position: absolute;
          top: 96px;
          right: 22px;
          display: none;
          max-width: 330px;
          background: rgba(16,18,11,0.94);
          border-left: 3px solid var(--rust);
          border-top: 1px solid var(--char);
          border-right: 1px solid var(--char);
          border-bottom: 1px solid var(--char);
          padding: 9px 15px;
          font-size: 12.5px;
          letter-spacing: 0.4px;
          color: var(--bone);
          animation: llFadeUp 0.2s ease-out;
        }
        #banner {
          position: absolute;
          top: 21%;
          left: 50%;
          transform: translateX(-50%);
          display: none;
          text-align: center;
          padding: 4px 40px;
          border-top: 1px solid rgba(139,136,120,0.35);
          border-bottom: 1px solid rgba(139,136,120,0.35);
          animation: llFade 0.35s ease-out;
        }
        #streak {
          position: absolute;
          top: 30%;
          left: 50%;
          transform: translateX(-50%);
          display: none;
          font-family: var(--stencil);
          font-size: 26px;
          letter-spacing: 5px;
          color: var(--amber);
        }
        .dmg {
          position: absolute;
          top: 0; left: 0;
          font-family: var(--stencil);
          font-size: 17px;
          letter-spacing: 1px;
          color: var(--bone);
          text-shadow: 0 2px 3px rgba(0,0,0,0.95);
          display: none;
          will-change: transform, opacity;
        }
        .dmg.crit { font-size: 24px; color: #e8b45a; }
      </style>

      <div id="dmg-layer" style="position:absolute; inset:0; overflow:hidden;"></div>

      <!-- Sector plate -->
      <div id="sector-card" class="hud-card" style="position:absolute; top:18px; left:18px; min-width:246px;">
        <div style="display:flex; align-items:baseline; gap:9px;">
          <div id="sector-index" style="font-family:var(--stencil); font-size:26px; letter-spacing:2px; color:var(--rust);">01</div>
          <div id="sector-name" style="font-family:var(--stencil); font-size:19px; letter-spacing:2.4px; color:var(--paper);">WILLOW CREEK</div>
        </div>
        <div id="objective" class="hud-label" style="margin-top:5px; color:var(--bone);">Clear the street</div>
        <div id="night-tier" class="hud-label" style="margin-top:4px; color:var(--amber);"></div>
      </div>

      <!-- Run tally -->
      <div id="tally-card" class="hud-card" style="position:absolute; top:18px; right:18px; display:flex; gap:20px; align-items:center;">
        <div style="text-align:right;">
          <div class="hud-label">Scrap</div>
          <div id="scrap-val" style="font-family:var(--stencil); font-size:21px; color:var(--amber);">0</div>
        </div>
        <div style="width:1px; height:30px; background:var(--char);"></div>
        <div style="text-align:right;">
          <div class="hud-label">Put Down</div>
          <div id="kills-val" style="font-family:var(--stencil); font-size:21px; color:var(--bone);">0</div>
        </div>
        <div id="mute-btn" style="pointer-events:auto; cursor:pointer; padding:6px 9px; border:1px solid var(--char); font-size:11px; letter-spacing:1.4px; color:var(--ash);">SND</div>
      </div>

      <!-- Vitals -->
      <div id="vitals" class="hud-card" style="position:absolute; bottom:18px; left:18px; display:flex; flex-direction:column; gap:7px;">
        <div style="display:flex; justify-content:space-between; align-items:flex-end;">
          <div class="hud-label">Condition</div>
          <div id="hp-text" style="font-family:var(--stencil); font-size:15px; color:var(--bone);">100/100</div>
        </div>
        <div class="hud-bar"><div id="hp-fill" class="hud-bar-fill"></div></div>
        <div id="getup-row" style="display:flex; gap:5px; margin-top:-2px;"></div>

        <div class="hud-label" style="margin-top:3px;">Wind &nbsp;·&nbsp; <span style="color:var(--bone)">SPACE</span> roll</div>
        <div class="hud-bar" style="height:8px;"><div id="stam-fill" class="hud-bar-fill"></div></div>

        <div class="hud-label" style="margin-top:3px;">Flare &nbsp;·&nbsp; <span style="color:var(--bone)">Q</span></div>
        <div class="hud-bar" style="height:8px;"><div id="flare-fill" class="hud-bar-fill" style="width:0%"></div></div>
      </div>

      <!-- Minimap -->
      <div id="minimap-card" class="hud-card" style="position:absolute; bottom:18px; left:290px; padding:7px;">
        <canvas id="minimap" width="124" height="124" style="display:block; background:rgba(8,9,6,0.75);"></canvas>
      </div>

      <!-- Weapon -->
      <div id="weapon-card" class="hud-card" style="position:absolute; bottom:18px; right:18px; min-width:224px;">
        <div class="hud-label">Carrying</div>
        <div id="wpn-name" style="font-family:var(--stencil); font-size:21px; letter-spacing:2px; color:var(--paper); margin-top:2px;">THE RANGER</div>
        <div id="wpn-model" class="hud-label" style="margin-top:1px;">Scoped Service Carbine</div>
        <div style="height:1px; background:var(--char); margin:10px 0 9px;"></div>
        <div style="display:flex; flex-direction:column; gap:6px;">
          <div id="abil-alt" class="abil ready"><span class="key-cap">RMB</span><span id="alt-label">Rifle Grenade</span></div>
          <div id="abil-shove" class="abil ready"><span class="key-cap">R</span><span>Shove</span></div>
          <div id="abil-flare" class="abil cooling"><span class="key-cap">Q</span><span>Road Flare</span></div>
        </div>
      </div>

      <!-- Boss -->
      <div id="boss-wrap" style="position:absolute; top:92px; left:50%; transform:translateX(-50%); width:460px; display:none; text-align:center;">
        <div style="font-family:var(--stencil); font-size:15px; letter-spacing:5px; color:var(--blood);">THE BEHEMOTH</div>
        <div style="width:100%; height:15px; background:rgba(0,0,0,0.7); border:1px solid var(--char); margin-top:4px;">
          <div id="boss-fill" style="width:100%; height:100%; transition:width 0.1s linear;"></div>
        </div>
      </div>

      <!-- Supply cache timer -->
      <div id="cache-timer" class="hud-card" style="position:absolute; top:150px; left:50%; transform:translateX(-50%); display:none; text-align:center; border-color:var(--amber);">
        <div class="hud-label" style="color:var(--amber);">Supply Crate — Chained</div>
        <div id="cache-line" style="font-family:var(--stencil); font-size:19px; letter-spacing:2px; margin-top:3px;">0 / 12 &nbsp; 18.0s</div>
      </div>

      <div id="banner">
        <div id="banner-title" class="ll-title" style="font-size:32px;"></div>
        <div id="banner-sub" class="ll-sub" style="margin-bottom:8px;"></div>
      </div>

      <div id="toast"></div>
      <div id="streak">DOUBLE</div>

      <div id="interact-prompt">
        <div style="display:flex; align-items:center; gap:10px; justify-content:center;">
          <span class="key-cap" style="min-width:26px; height:24px; font-size:12px;">E</span>
          <span id="prompt-label" style="font-family:var(--stencil); font-size:18px; letter-spacing:2.4px; color:var(--paper);">WEAPON RACK</span>
        </div>
        <div id="prompt-hint" class="hud-label" style="margin-top:4px;"></div>
      </div>

      <div id="vignette" style="position:absolute; inset:0; pointer-events:none; box-shadow: inset 0 0 130px rgba(90,14,14,0.92); opacity:0; transition:opacity 0.16s ease-out; z-index:5;"></div>

      <div id="crosshair" style="position:fixed; top:0; left:0; width:30px; height:30px; z-index:9999; transform:translate(-50%,-50%); display:none;">
        <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
          <circle cx="15" cy="15" r="10.5" stroke="${CSS.bone}" stroke-opacity="0.55" stroke-width="1"/>
          <circle cx="15" cy="15" r="1.4" fill="${CSS.bone}" fill-opacity="0.9"/>
          <line x1="15" y1="1" x2="15" y2="6" stroke="${CSS.bone}" stroke-opacity="0.8" stroke-width="1.4"/>
          <line x1="15" y1="24" x2="15" y2="29" stroke="${CSS.bone}" stroke-opacity="0.8" stroke-width="1.4"/>
          <line x1="1" y1="15" x2="6" y2="15" stroke="${CSS.bone}" stroke-opacity="0.8" stroke-width="1.4"/>
          <line x1="24" y1="15" x2="29" y2="15" stroke="${CSS.bone}" stroke-opacity="0.8" stroke-width="1.4"/>
        </svg>
      </div>
    `;

    const $ = (id: string) => document.getElementById(id)!;

    this.healthFill = $('hp-fill');
    this.healthText = $('hp-text');
    this.staminaFill = $('stam-fill');
    this.flareFill = $('flare-fill');
    this.getUpRow = $('getup-row');

    this.sectorName = $('sector-name');
    this.sectorIndex = $('sector-index');
    this.objectiveEl = $('objective');
    this.nightEl = $('night-tier');

    this.scrapEl = $('scrap-val');
    this.killsEl = $('kills-val');
    this.streakEl = $('streak');

    this.weaponName = $('wpn-name');
    this.weaponModel = $('wpn-model');
    this.altKey = $('abil-alt');
    this.shoveKey = $('abil-shove');
    this.flareKey = $('abil-flare');

    this.promptEl = $('interact-prompt');
    this.toastEl = $('toast');
    this.bannerEl = $('banner');
    this.bossWrap = $('boss-wrap');
    this.bossFill = $('boss-fill');
    this.cacheEl = $('cache-timer');
    this.vignette = $('vignette');
    this.crosshair = $('crosshair');

    this.minimapCanvas = $('minimap') as HTMLCanvasElement;
    this.minimapCtx = this.minimapCanvas.getContext('2d')!;
    this.dmgContainer = $('dmg-layer');

    $('mute-btn').addEventListener('click', () => {
      if (!this.onToggleMute) return;
      this.setMuteState(this.onToggleMute());
    });
  }

  private buildDamagePool(): void {
    for (let i = 0; i < 40; i++) {
      const el = document.createElement('div');
      el.className = 'dmg';
      this.dmgContainer.appendChild(el);
      this.dmgPool.push({ el, active: false, pos: new THREE.Vector3(), life: 0, maxLife: 0.5 });
    }
  }

  // -------------------------------------------------------------- feedback

  public spawnDamageNumber(worldPos: THREE.Vector3, damage: number, crit: boolean): void {
    const item = this.dmgPool.find((d) => !d.active) ?? this.dmgPool[0];
    item.pos.copy(worldPos);
    item.life = 0;
    item.maxLife = crit ? 0.62 : 0.45;
    item.active = true;
    item.el.textContent = crit ? `${Math.round(damage)}!` : `${Math.round(damage)}`;
    item.el.className = crit ? 'dmg crit' : 'dmg';
    item.el.style.display = 'block';
  }

  public updateDamageNumbers(delta: number, camera: THREE.PerspectiveCamera): void {
    const w = window.innerWidth;
    const h = window.innerHeight;

    for (const item of this.dmgPool) {
      if (!item.active) continue;

      item.life += delta;
      if (item.life >= item.maxLife) {
        item.active = false;
        item.el.style.display = 'none';
        continue;
      }

      const t = item.life / item.maxLife;
      tempVec.copy(item.pos);
      tempVec.y += 1.5 + t * 1.6;
      tempVec.project(camera);

      if (tempVec.z > 1) {
        item.el.style.display = 'none';
        continue;
      }

      const x = (tempVec.x * 0.5 + 0.5) * w;
      const y = (-(tempVec.y * 0.5) + 0.5) * h;
      const scale = 1.15 - t * 0.28;

      item.el.style.transform = `translate(-50%,-50%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${scale.toFixed(2)})`;
      item.el.style.opacity = Math.max(0, 1 - t * t).toFixed(2);
      item.el.style.display = 'block';
    }
  }

  public showToast(text: string): void {
    this.toastEl.textContent = text;
    this.toastEl.style.display = 'block';
    this.toastTimer = 2.6;
  }

  public showBanner(title: string, sub: string, seconds = 3.4): void {
    document.getElementById('banner-title')!.textContent = title;
    document.getElementById('banner-sub')!.textContent = sub;
    this.bannerEl.style.display = 'block';
    this.bannerTimer = seconds;
  }

  public showStreak(text: string): void {
    this.streakEl.textContent = text;
    this.streakEl.style.display = 'block';
    this.streakTimer = 1.1;
  }

  public flashDamage(): void {
    this.vignette.style.opacity = '1';
    setTimeout(() => { this.vignette.style.opacity = '0'; }, 150);
  }

  public setMuteState(enabled: boolean): void {
    const btn = document.getElementById('mute-btn');
    if (btn) {
      btn.textContent = enabled ? 'SND' : 'MUTE';
      btn.style.color = enabled ? CSS.ash : CSS.rust;
    }
  }

  // -------------------------------------------------------------- prompts

  public showPrompt(label: string, hint: string): void {
    document.getElementById('prompt-label')!.textContent = label.toUpperCase();
    document.getElementById('prompt-hint')!.textContent = hint;
    this.promptEl.style.display = 'block';
  }

  public hidePrompt(): void {
    this.promptEl.style.display = 'none';
  }

  // -------------------------------------------------------------- panels

  public setSector(index: number, name: string, objective: string, nightLabel: string): void {
    this.sectorIndex.textContent = String(index).padStart(2, '0');
    this.sectorName.textContent = name.toUpperCase();
    this.objectiveEl.textContent = objective;
    this.nightEl.textContent = nightLabel;
  }

  public setObjective(text: string): void {
    this.objectiveEl.textContent = text;
  }

  public setWeapon(name: string, model: string, altName: string): void {
    this.weaponName.textContent = name.toUpperCase();
    this.weaponModel.textContent = model;
    document.getElementById('alt-label')!.textContent = altName;
  }

  public setBossBar(show: boolean, health = 1, maxHealth = 1): void {
    this.bossWrap.style.display = show ? 'block' : 'none';
    if (show) this.bossFill.style.width = `${Math.max(0, (health / maxHealth) * 100)}%`;
  }

  public setCacheTimer(show: boolean, kills = 0, required = 0, timeLeft = 0): void {
    this.cacheEl.style.display = show ? 'block' : 'none';
    if (show) {
      document.getElementById('cache-line')!.textContent =
        `${kills} / ${required}  ·  ${timeLeft.toFixed(1)}s`;
    }
  }

  /** Hides combat furniture while the player is in the shelter. */
  public setShelterMode(inShelter: boolean): void {
    const combatOnly = ['vitals', 'minimap-card', 'weapon-card', 'sector-card', 'tally-card'];
    for (const id of combatOnly) {
      const el = document.getElementById(id);
      if (el) el.style.display = inShelter && id !== 'tally-card' ? 'none' : '';
    }
    if (inShelter) {
      this.setBossBar(false);
      this.setCacheTimer(false);
    } else {
      this.hidePrompt();
    }
  }

  // -------------------------------------------------------------- per-frame

  public update(
    delta: number,
    vitals: Vitals,
    scrap: number,
    kills: number,
    cooldowns: { alt: number; shove: number; flareReady: boolean }
  ): void {
    if (this.toastTimer > 0) {
      this.toastTimer -= delta;
      if (this.toastTimer <= 0) this.toastEl.style.display = 'none';
    }
    if (this.bannerTimer > 0) {
      this.bannerTimer -= delta;
      if (this.bannerTimer <= 0) this.bannerEl.style.display = 'none';
    }
    if (this.streakTimer > 0) {
      this.streakTimer -= delta;
      if (this.streakTimer <= 0) this.streakEl.style.display = 'none';
    }

    // Throttled: none of this needs to run at frame rate.
    this.uiTimer += delta;
    if (this.uiTimer < 0.05) return;
    this.uiTimer = 0;

    const hpPct = Math.max(0, (vitals.health / vitals.maxHealth) * 100);
    this.healthFill.style.width = `${hpPct}%`;
    this.healthFill.className = hpPct <= 30 ? 'hud-bar-fill low' : 'hud-bar-fill';
    this.healthText.textContent = `${Math.ceil(vitals.health)}/${Math.round(vitals.maxHealth)}`;

    this.staminaFill.style.width = `${(vitals.stamina / vitals.maxStamina) * 100}%`;
    this.flareFill.style.width = `${(vitals.adrenaline / vitals.maxAdrenaline) * 100}%`;

    // Get-up pips.
    if (this.getUpRow.childElementCount !== vitals.maxGetUps) {
      this.getUpRow.innerHTML = Array.from({ length: vitals.maxGetUps })
        .map(() => `<div style="width:16px;height:4px;background:var(--char);"></div>`)
        .join('');
    }
    Array.from(this.getUpRow.children).forEach((pip, i) => {
      (pip as HTMLElement).style.background = i < vitals.getUps ? CSS.amber : CSS.char;
    });

    this.scrapEl.textContent = String(scrap);
    this.killsEl.textContent = String(kills);

    this.altKey.className = cooldowns.alt > 0 ? 'abil cooling' : 'abil ready';
    this.shoveKey.className = cooldowns.shove > 0 ? 'abil cooling' : 'abil ready';
    this.flareKey.className = cooldowns.flareReady ? 'abil ready' : 'abil cooling';
  }

  public updateCrosshair(x: number, y: number, visible: boolean): void {
    if (!visible) {
      this.crosshair.style.display = 'none';
      return;
    }
    this.crosshair.style.display = 'block';
    this.crosshair.style.transform = `translate(-50%,-50%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
  }

  public drawMinimap(
    delta: number,
    playerPos: { x: number; z: number },
    enemies: Array<{ position: { x: number; z: number } }>,
    gates: Array<{ x: number; z: number }>,
    boss?: { x: number; z: number } | null
  ): void {
    this.minimapTimer += delta;
    if (this.minimapTimer < 0.06) return;
    this.minimapTimer = 0;

    const ctx = this.minimapCtx;
    const w = this.minimapCanvas.width;
    const h = this.minimapCanvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const scale = 0.92;

    ctx.clearRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(139,136,120,0.2)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
    ctx.beginPath();
    ctx.moveTo(cx, 0); ctx.lineTo(cx, h);
    ctx.moveTo(0, cy); ctx.lineTo(w, cy);
    ctx.stroke();

    ctx.fillStyle = 'rgba(142,35,35,0.9)';
    for (const e of enemies) {
      const x = cx + (e.position.x - playerPos.x) * scale;
      const y = cy + (e.position.z - playerPos.z) * scale;
      if (x < 3 || x > w - 3 || y < 3 || y > h - 3) continue;
      ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
    }

    ctx.fillStyle = CSS.amber;
    for (const g of gates) {
      const x = cx + (g.x - playerPos.x) * scale;
      const y = cy + (g.z - playerPos.z) * scale;
      const cxp = Math.max(4, Math.min(w - 4, x));
      const cyp = Math.max(4, Math.min(h - 4, y));
      ctx.fillRect(cxp - 3, cyp - 3, 6, 6);
    }

    if (boss) {
      const x = Math.max(5, Math.min(w - 5, cx + (boss.x - playerPos.x) * scale));
      const y = Math.max(5, Math.min(h - 5, cy + (boss.z - playerPos.z) * scale));
      ctx.fillStyle = '#d05a2a';
      ctx.beginPath();
      ctx.arc(x, y, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = CSS.paper;
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}
