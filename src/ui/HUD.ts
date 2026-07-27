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
  private minimapCanvas!: HTMLCanvasElement;
  private minimapCtx!: CanvasRenderingContext2D;

  private uiTimer: number = 0;
  private minimapTimer: number = 0;
  private multkillTimer: number = 0;

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
        @keyframes popKill {
          from { opacity: 0; transform: translate(-50%, -50%) scale(0.7); }
          to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
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

      <div class="hud-card" style="position: absolute; bottom: 20px; right: 20px; display: flex; gap: 16px; align-items: center;">
        <div style="text-align: center;">
          <div style="font-size: 11px; color: #888;">LMB</div>
          <div style="width: 44px; height: 44px; border: 2px solid #00ffff; border-radius: 8px; display: grid; place-content: center; background: rgba(0,255,255,0.1); font-weight: bold;">⚡</div>
          <div style="font-size: 10px; color: #00ffff; margin-top: 2px;">LASER</div>
        </div>
        <div style="text-align: center;">
          <div style="font-size: 11px; color: #888;">RMB</div>
          <div id="sec-cd-box" style="width: 44px; height: 44px; border: 2px solid #ffaa00; border-radius: 8px; display: grid; place-content: center; background: rgba(255,170,0,0.1); font-weight: bold; position: relative;">
            💥
            <div id="sec-cd-overlay" style="position: absolute; inset: 0; background: rgba(0,0,0,0.7); display: none; place-content: center; border-radius: 6px; font-size: 12px;"></div>
          </div>
          <div style="font-size: 10px; color: #ffaa00; margin-top: 2px;">MISSILE</div>
        </div>
        <div style="text-align: center;">
          <div style="font-size: 11px; color: #888;">E</div>
          <div style="width: 44px; height: 44px; border: 2px solid #ffaa00; border-radius: 8px; display: grid; place-content: center; background: rgba(255,170,0,0.15); font-weight: bold;">🌟</div>
          <div style="font-size: 10px; color: #ffaa00; margin-top: 2px;">NOVA</div>
        </div>
        <div style="text-align: center;">
          <div style="font-size: 11px; color: #888;">SPACE</div>
          <div style="width: 44px; height: 44px; border: 2px solid #00ffaa; border-radius: 8px; display: grid; place-content: center; background: rgba(0,255,170,0.1); font-weight: bold;">💨</div>
          <div style="font-size: 10px; color: #00ffaa; margin-top: 2px;">DASH</div>
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
    this.bossBarContainer = document.getElementById('boss-bar-container')!;
    this.bossHealthFill = document.getElementById('boss-health-fill')!;
    this.minimapCanvas = document.getElementById('minimap') as HTMLCanvasElement;
    this.minimapCtx = this.minimapCanvas.getContext('2d')!;
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
