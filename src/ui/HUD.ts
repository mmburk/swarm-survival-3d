export class HUD {
  private element: HTMLElement;

  private healthFill!: HTMLElement;
  private staminaFill!: HTMLElement;
  private xpFill!: HTMLElement;
  private ultFill!: HTMLElement;
  private levelEl!: HTMLElement;
  private scoreEl!: HTMLElement;
  private waveEl!: HTMLElement;
  private killsEl!: HTMLElement;
  private secCooldownEl!: HTMLElement;
  private intermissionEl!: HTMLElement;
  private comboEl!: HTMLElement;
  private multkillEl!: HTMLElement;
  private bossBarContainer!: HTMLElement;
  private bossHealthFill!: HTMLElement;
  private onboardingPrompt!: HTMLElement;
  private toastEl!: HTMLElement;
  private minimapCanvas!: HTMLCanvasElement;
  private minimapCtx!: CanvasRenderingContext2D;
  private weaponSlotEls: HTMLElement[] = [];

  private uiTimer: number = 0;
  private minimapTimer: number = 0;
  private multkillTimer: number = 0;
  private toastTimer: number = 0;
  private onboardingTimer: number = 10.0;
  private hasDismissedOnboarding: boolean = false;

  constructor() {
    this.element = document.createElement('div');
    this.element.id = 'hud-container';
    this.element.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      font-family: 'Segoe UI', Roboto, Helvetica, sans-serif;
      user-select: none;
      z-index: 10;
      color: #ffffff;
    `;
    document.body.appendChild(this.element);

    this.renderLayout();
  }

  private renderLayout(): void {
    this.element.innerHTML = `
      <style>
        .hud-card {
          background: rgba(8, 16, 32, 0.75);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(0, 240, 255, 0.25);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5), inset 0 0 15px rgba(0, 240, 255, 0.08);
          border-radius: 12px;
          padding: 14px 18px;
        }
        .bar-bg {
          width: 220px;
          height: 14px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 7px;
          overflow: hidden;
          position: relative;
          box-shadow: inset 0 2px 4px rgba(0,0,0,0.6);
        }
        .bar-fill {
          height: 100%;
          width: 100%;
          border-radius: 7px;
          transition: width 0.15s ease-out;
        }
        #health-fill {
          background: linear-gradient(90deg, #ff0055, #ff4400);
          box-shadow: 0 0 10px #ff0055;
        }
        #stamina-fill {
          background: linear-gradient(90deg, #00e5ff, #00ffaa);
          box-shadow: 0 0 10px #00e5ff;
        }
        #xp-fill {
          background: linear-gradient(90deg, #aa00ff, #00ffff);
          box-shadow: 0 0 10px #aa00ff;
        }
        #ult-fill {
          background: linear-gradient(90deg, #ffaa00, #ffff00);
          box-shadow: 0 0 10px #ffaa00;
        }
        #boss-health-fill {
          background: linear-gradient(90deg, #ff0033, #ff6600);
          box-shadow: 0 0 15px #ff0033;
        }
        .hud-stat-title {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 1.5px;
          color: rgba(255, 255, 255, 0.6);
          margin-bottom: 4px;
        }
        .hud-stat-value {
          font-size: 28px;
          font-weight: 800;
          color: #00ffff;
          text-shadow: 0 0 12px rgba(0, 255, 255, 0.6);
        }
        .multkill-banner {
          position: absolute;
          top: 20%;
          left: 50%;
          transform: translate(-50%, -50%);
          font-size: 32px;
          font-weight: 900;
          letter-spacing: 3px;
          color: #ffaa00;
          text-shadow: 0 0 20px #ffaa00;
          display: none;
          animation: popKill 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
        .toast-banner {
          position: absolute;
          top: 130px;
          right: 20px;
          background: rgba(6, 14, 28, 0.85);
          backdrop-filter: blur(10px);
          border: 1px solid #00ffff;
          color: #00ffff;
          font-weight: bold;
          font-size: 13px;
          padding: 8px 16px;
          border-radius: 20px;
          display: none;
          box-shadow: 0 0 15px rgba(0, 240, 255, 0.3);
        }
        .onboarding-banner {
          position: absolute;
          bottom: 90px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(8, 18, 36, 0.85);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(0, 240, 255, 0.4);
          border-radius: 30px;
          padding: 10px 24px;
          display: flex;
          align-items: center;
          gap: 16px;
          box-shadow: 0 0 25px rgba(0, 240, 255, 0.25);
          transition: opacity 0.5s ease;
        }
        .onboarding-key {
          background: rgba(0, 240, 255, 0.2);
          border: 1px solid #00ffff;
          color: #00ffff;
          padding: 2px 8px;
          border-radius: 6px;
          font-weight: bold;
          font-size: 11px;
        }
        .intermission-banner {
          position: absolute;
          top: 25%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: rgba(6, 16, 32, 0.9);
          border: 2px solid #00ffff;
          box-shadow: 0 0 30px rgba(0, 240, 255, 0.4);
          border-radius: 16px;
          padding: 20px 40px;
          text-align: center;
          display: none;
        }
        .weapon-slot { opacity: 0.5; transition: all 0.15s ease; }
        .active-weapon { opacity: 1.0 !important; transform: translateY(-4px); }
        .active-weapon div:nth-child(2) { box-shadow: 0 0 16px rgba(0,255,255,0.5); }
      </style>

      <div class="hud-card" style="position: absolute; top: 20px; left: 20px; display: flex; flex-direction: column; gap: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div class="hud-stat-title">Cyber Armor (HP)</div>
          <div id="hud-level" style="font-size: 11px; font-weight: bold; color: #00ffff; background: rgba(0,255,255,0.15); padding: 2px 6px; border-radius: 4px;">LVL 1</div>
        </div>
        <div class="bar-bg">
          <div id="health-fill" class="bar-fill"></div>
        </div>

        <div class="hud-stat-title">Dash Thruster</div>
        <div class="bar-bg">
          <div id="stamina-fill" class="bar-fill"></div>
        </div>

        <div class="hud-stat-title">Data Core (XP)</div>
        <div class="bar-bg">
          <div id="xp-fill" class="bar-fill"></div>
        </div>

        <div class="hud-stat-title">Cyber Nova (Key E)</div>
        <div class="bar-bg">
          <div id="ult-fill" class="bar-fill"></div>
        </div>
      </div>

      <div style="position: absolute; top: 20px; left: 50%; transform: translateX(-50%); display: flex; gap: 16px;">
        <div class="hud-card" style="text-align: center; min-width: 130px;">
          <div class="hud-stat-title">Current Wave</div>
          <div id="hud-wave" class="hud-stat-value">1</div>
        </div>
        <div class="hud-card" style="text-align: center; min-width: 150px;">
          <div class="hud-stat-title">Score</div>
          <div id="hud-score" class="hud-stat-value">0</div>
        </div>
        <div class="hud-card" style="text-align: center; min-width: 120px;">
          <div class="hud-stat-title">Swarm Kills</div>
          <div id="hud-kills" class="hud-stat-value">0</div>
        </div>
        <div id="combo-badge" class="hud-card" style="text-align: center; min-width: 110px; border-color: #ffaa00; display: none;">
          <div class="hud-stat-title" style="color: #ffaa00;">COMBO</div>
          <div id="combo-val" style="font-size: 24px; font-weight: bold; color: #ffaa00;">2x</div>
        </div>
      </div>

      <div id="multkill-banner" class="multkill-banner">DOUBLE KILL!</div>
      <div id="toast-banner" class="toast-banner">🔊 AUDIO: UNMUTED</div>

      <div id="onboarding-prompt" class="onboarding-banner">
        <div style="font-size: 13px; color: #ccddee;"><span class="onboarding-key">WASD</span> MOVE</div>
        <div style="font-size: 13px; color: #ccddee;"><span class="onboarding-key">LMB</span> LASER</div>
        <div style="font-size: 13px; color: #ccddee;"><span class="onboarding-key">RMB</span> MISSILE</div>
        <div style="font-size: 13px; color: #ccddee;"><span class="onboarding-key">SPACE</span> DASH</div>
        <div style="font-size: 13px; color: #ccddee;"><span class="onboarding-key">E</span> ULT</div>
      </div>

      <div id="boss-bar-container" style="position: absolute; top: 95px; left: 50%; transform: translateX(-50%); width: 440px; display: none; text-align: center;">
        <div style="font-size: 12px; font-weight: 900; letter-spacing: 2px; color: #ff0044; margin-bottom: 4px;">⚠️ CYBER OVERLORD (BOSS) ⚠️</div>
        <div style="width: 100%; height: 18px; background: rgba(0,0,0,0.8); border: 1px solid #ff0044; border-radius: 9px; overflow: hidden; padding: 2px;">
          <div id="boss-health-fill" style="width: 100%; height: 100%; border-radius: 7px; transition: width 0.1s linear;"></div>
        </div>
      </div>

      <div id="intermission-banner" class="intermission-banner">
        <div style="font-size: 26px; font-weight: 900; color: #00ffff; letter-spacing: 2px;">WAVE CLEARED</div>
        <div id="intermission-sub" style="font-size: 14px; color: #aaa; margin-top: 6px;">PRESS SPACE TO START NEXT WAVE</div>
      </div>

      <div class="hud-card" style="position: absolute; bottom: 20px; right: 20px; display: flex; gap: 12px; align-items: center;">
        <div id="wpn-slot-1" class="weapon-slot active-weapon" style="text-align: center;">
          <div style="font-size: 10px; color: #888; font-weight: bold;">1</div>
          <div style="width: 48px; height: 48px; border: 2px solid #00ffff; border-radius: 10px; display: grid; place-content: center; background: rgba(0,255,255,0.15); font-size: 18px;">🔫</div>
          <div style="font-size: 9px; color: #00ffff; margin-top: 2px; font-weight: bold;">RIFLE</div>
        </div>
        <div id="wpn-slot-2" class="weapon-slot" style="text-align: center;">
          <div style="font-size: 10px; color: #888; font-weight: bold;">2</div>
          <div style="width: 48px; height: 48px; border: 2px solid #555; border-radius: 10px; display: grid; place-content: center; background: rgba(255,255,255,0.05); font-size: 18px;">💥</div>
          <div style="font-size: 9px; color: #888; margin-top: 2px; font-weight: bold;">SHOTGUN</div>
        </div>
        <div id="wpn-slot-3" class="weapon-slot" style="text-align: center;">
          <div style="font-size: 10px; color: #888; font-weight: bold;">3</div>
          <div style="width: 48px; height: 48px; border: 2px solid #555; border-radius: 10px; display: grid; place-content: center; background: rgba(255,255,255,0.05); font-size: 18px;">💣</div>
          <div style="font-size: 9px; color: #888; margin-top: 2px; font-weight: bold;">GRENADE</div>
        </div>
        <div style="width: 1px; height: 50px; background: rgba(255,255,255,0.15); margin: 0 4px;"></div>
        <div style="text-align: center;">
          <div style="font-size: 10px; color: #888;">SPACE</div>
          <div style="width: 44px; height: 44px; border: 2px solid #00ffaa; border-radius: 8px; display: grid; place-content: center; background: rgba(0,255,170,0.1); font-weight: bold;">💨</div>
          <div style="font-size: 9px; color: #00ffaa; margin-top: 2px;">DASH</div>
        </div>
        <div style="text-align: center;">
          <div style="font-size: 10px; color: #888;">E</div>
          <div style="width: 44px; height: 44px; border: 2px solid #ffaa00; border-radius: 8px; display: grid; place-content: center; background: rgba(255,170,0,0.15); font-weight: bold;">🌟</div>
          <div style="font-size: 9px; color: #ffaa00; margin-top: 2px;">NOVA</div>
        </div>
      </div>

      <div class="hud-card" style="position: absolute; bottom: 20px; left: 20px; padding: 8px;">
        <canvas id="minimap" width="130" height="130" style="border-radius: 8px; background: rgba(0, 10, 25, 0.8); display: block;"></canvas>
      </div>
    `;

    this.healthFill = document.getElementById('health-fill')!;
    this.staminaFill = document.getElementById('stamina-fill')!;
    this.xpFill = document.getElementById('xp-fill')!;
    this.ultFill = document.getElementById('ult-fill')!;
    this.levelEl = document.getElementById('hud-level')!;
    this.scoreEl = document.getElementById('hud-score')!;
    this.waveEl = document.getElementById('hud-wave')!;
    this.killsEl = document.getElementById('hud-kills')!;
    this.secCooldownEl = document.getElementById('sec-cd-overlay')!;
    this.intermissionEl = document.getElementById('intermission-banner')!;
    this.comboEl = document.getElementById('combo-badge')!;
    this.multkillEl = document.getElementById('multkill-banner')!;
    this.toastEl = document.getElementById('toast-banner')!;
    this.onboardingPrompt = document.getElementById('onboarding-prompt')!;
    this.bossBarContainer = document.getElementById('boss-bar-container')!;
    this.bossHealthFill = document.getElementById('boss-health-fill')!;
    this.minimapCanvas = document.getElementById('minimap') as HTMLCanvasElement;
    this.minimapCtx = this.minimapCanvas.getContext('2d')!;
    this.weaponSlotEls = [
      document.getElementById('wpn-slot-1')!,
      document.getElementById('wpn-slot-2')!,
      document.getElementById('wpn-slot-3')!
    ];
  }

  public showToast(text: string): void {
    this.toastEl.innerText = text;
    this.toastEl.style.display = 'block';
    this.toastTimer = 1.5;
  }

  public resetOnboarding(): void {
    this.onboardingTimer = 10.0;
    this.hasDismissedOnboarding = false;
    this.onboardingPrompt.style.display = 'flex';
    this.onboardingPrompt.style.opacity = '1';
  }

  public showMultiKillPopup(text: string): void {
    this.multkillEl.innerText = text;
    this.multkillEl.style.display = 'block';
    this.multkillTimer = 1.2;
  }

  public showBossHealthBar(show: boolean, health: number = 100, maxHealth: number = 100): void {
    if (show) {
      this.bossBarContainer.style.display = 'block';
      this.bossHealthFill.style.width = `${Math.max(0, (health / maxHealth) * 100)}%`;
    } else {
      this.bossBarContainer.style.display = 'none';
    }
  }

  public showIntermission(show: boolean, timerSec?: number): void {
    if (show) {
      this.intermissionEl.style.display = 'block';
      if (timerSec !== undefined) {
        document.getElementById('intermission-sub')!.innerText = `NEXT WAVE IN ${Math.ceil(timerSec)}s (OR PRESS SPACE)`;
      }
    } else {
      this.intermissionEl.style.display = 'none';
    }
  }

  public updateWeaponSlot(slot: number): void {
    const colors = ['#00ffff', '#ff6600', '#ffaa00'];
    for (let i = 0; i < 3; i++) {
      const el = this.weaponSlotEls[i];
      if (!el) continue;
      if (i === slot - 1) {
        el.classList.add('active-weapon');
        el.style.opacity = '1';
        const box = el.querySelector('div:nth-child(2)') as HTMLElement;
        if (box) {
          box.style.borderColor = colors[i];
          box.style.background = colors[i] + '22';
        }
        const label = el.querySelector('div:nth-child(3)') as HTMLElement;
        if (label) label.style.color = colors[i];
      } else {
        el.classList.remove('active-weapon');
        el.style.opacity = '0.5';
        const box = el.querySelector('div:nth-child(2)') as HTMLElement;
        if (box) {
          box.style.borderColor = '#555';
          box.style.background = 'rgba(255,255,255,0.05)';
        }
        const label = el.querySelector('div:nth-child(3)') as HTMLElement;
        if (label) label.style.color = '#888';
      }
    }
  }

  public updateHUD(
    delta: number,
    health: number,
    maxHealth: number,
    stamina: number,
    maxStamina: number,
    xp: number,
    maxXp: number,
    ultCharge: number,
    maxUltCharge: number,
    level: number,
    score: number,
    wave: number,
    kills: number,
    secondaryCD: number,
    comboCount: number = 0,
    comboMult: number = 1
  ): void {
    if (this.toastTimer > 0) {
      this.toastTimer -= delta;
      if (this.toastTimer <= 0) {
        this.toastEl.style.display = 'none';
      }
    }

    if (!this.hasDismissedOnboarding) {
      this.onboardingTimer -= delta;
      if (this.onboardingTimer <= 0) {
        this.hasDismissedOnboarding = true;
        this.onboardingPrompt.style.opacity = '0';
        setTimeout(() => { this.onboardingPrompt.style.display = 'none'; }, 500);
      }
    }

    if (this.multkillTimer > 0) {
      this.multkillTimer -= delta;
      if (this.multkillTimer <= 0) {
        this.multkillEl.style.display = 'none';
      }
    }

    this.uiTimer += delta;
    if (this.uiTimer < 0.066) return;
    this.uiTimer = 0;

    this.healthFill.style.width = `${Math.max(0, (health / maxHealth) * 100)}%`;
    this.staminaFill.style.width = `${Math.max(0, (stamina / maxStamina) * 100)}%`;
    this.xpFill.style.width = `${Math.max(0, (xp / maxXp) * 100)}%`;
    this.ultFill.style.width = `${Math.max(0, (ultCharge / maxUltCharge) * 100)}%`;
    this.levelEl.innerText = `LVL ${level}`;
    this.scoreEl.innerText = score.toString();
    this.waveEl.innerText = wave.toString();
    this.killsEl.innerText = kills.toString();

    if (comboCount > 1) {
      this.comboEl.style.display = 'block';
      document.getElementById('combo-val')!.innerText = `${comboMult}x (${comboCount})`;
    } else {
      this.comboEl.style.display = 'none';
    }

    if (secondaryCD > 0) {
      this.secCooldownEl.style.display = 'grid';
      this.secCooldownEl.innerText = secondaryCD.toFixed(1) + 's';
    } else {
      this.secCooldownEl.style.display = 'none';
    }
  }

  public drawMinimap(delta: number, playerPos: { x: number; z: number }, enemies: Array<{ position: { x: number; z: number } }>): void {
    this.minimapTimer += delta;
    if (this.minimapTimer < 0.05) return;
    this.minimapTimer = 0;

    const ctx = this.minimapCtx;
    const w = this.minimapCanvas.width;
    const h = this.minimapCanvas.height;
    const scale = 1.1;

    ctx.clearRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(0, 240, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w / 2 - 4, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h);
    ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2);
    ctx.stroke();

    ctx.fillStyle = '#ff0055';
    for (let i = 0; i < enemies.length; i++) {
      const ePos = enemies[i].position;
      const relX = w / 2 + (ePos.x - playerPos.x) * scale;
      const relY = h / 2 + (ePos.z - playerPos.z) * scale;

      if (relX >= 4 && relX <= w - 4 && relY >= 4 && relY <= h - 4) {
        ctx.beginPath();
        ctx.arc(relX, relY, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.fillStyle = '#00ffff';
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}
