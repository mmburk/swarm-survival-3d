import type { ShipClass } from '../entities/Player';

export interface PerkOption {
  id: string;
  icon: string;
  title: string;
  description: string;
  color: string;
}

export interface MetaUpgrades {
  speedLevel: number;
  healthLevel: number;
  critLevel: number;
  shieldUnlocked: boolean;
}

export class MenuSystem {
  private element: HTMLElement;
  private onStartGame: (shipClass: ShipClass) => void;
  private onToggleAudio: () => boolean;
  private onToggleBloom?: (enabled: boolean) => void;

  private selectedShipClass: ShipClass = 'VANGUARD';
  private highScore: number = 0;
  public cyberCores: number = 0;

  public metaUpgrades: MetaUpgrades = {
    speedLevel: 0,
    healthLevel: 0,
    critLevel: 0,
    shieldUnlocked: false
  };

  constructor(
    onStartGame: (shipClass: ShipClass) => void,
    onToggleAudio: () => boolean,
    onToggleBloom?: (enabled: boolean) => void
  ) {
    this.onStartGame = onStartGame;
    this.onToggleAudio = onToggleAudio;
    this.onToggleBloom = onToggleBloom;

    const savedScore = localStorage.getItem('cyber_swarm_high_score');
    if (savedScore) this.highScore = parseInt(savedScore, 10) || 0;

    const savedCores = localStorage.getItem('cyber_swarm_cores');
    if (savedCores) this.cyberCores = parseInt(savedCores, 10) || 0;

    const savedMeta = localStorage.getItem('cyber_swarm_meta');
    if (savedMeta) {
      try {
        this.metaUpgrades = JSON.parse(savedMeta);
      } catch {
        // Fallback default
      }
    }

    this.element = document.createElement('div');
    this.element.id = 'menu-container';
    this.element.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 1000;
      pointer-events: auto;
      display: flex;
      justify-content: center;
      align-items: center;
      font-family: 'Segoe UI', Roboto, sans-serif;
      color: #fff;
      user-select: none;
    `;
    document.body.appendChild(this.element);

    this.injectGlobalStyles();
    this.showStartMenu();
  }

  private injectGlobalStyles(): void {
    const styleId = 'menu-system-styles';
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.innerHTML = `
      .menu-modal-panel {
        background: rgba(6, 14, 28, 0.92);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border: 1.5px solid rgba(0, 240, 255, 0.35);
        box-shadow: 0 16px 64px rgba(0, 0, 0, 0.85), 0 0 35px rgba(0, 240, 255, 0.2);
        border-radius: 24px;
        padding: 36px 40px;
        max-width: 620px;
        width: 90%;
        text-align: center;
        pointer-events: auto;
        animation: popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        box-sizing: border-box;
      }
      @keyframes popIn {
        from { opacity: 0; transform: scale(0.88); }
        to { opacity: 1; transform: scale(1); }
      }
      .cyber-head-title {
        font-size: 38px;
        font-weight: 900;
        letter-spacing: 3px;
        background: linear-gradient(135deg, #00ffff, #ff00aa);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        margin-bottom: 6px;
        text-transform: uppercase;
      }
      .cyber-sub-title {
        font-size: 13px;
        color: #88aacc;
        margin-bottom: 20px;
        letter-spacing: 1.5px;
        text-transform: uppercase;
      }
      .ship-select-row {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        gap: 12px;
        margin-bottom: 22px;
      }
      .ship-card {
        background: rgba(14, 28, 54, 0.7);
        border: 1.5px solid rgba(0, 240, 255, 0.2);
        border-radius: 14px;
        padding: 14px 10px;
        cursor: pointer;
        transition: all 0.2s ease;
        text-align: center;
      }
      .ship-card:hover {
        border-color: #00ffff;
        transform: translateY(-2px);
      }
      .ship-card.active {
        border-color: #00ffff;
        background: rgba(0, 240, 255, 0.15);
        box-shadow: 0 0 20px rgba(0, 240, 255, 0.3);
      }
      .badge-container-row {
        display: flex;
        justify-content: center;
        gap: 12px;
        margin-bottom: 18px;
      }
      .stat-pill {
        background: rgba(255, 170, 0, 0.12);
        border: 1px solid rgba(255, 170, 0, 0.4);
        color: #ffaa00;
        font-size: 12px;
        font-weight: bold;
        padding: 5px 14px;
        border-radius: 20px;
      }
      .core-pill {
        background: rgba(170, 0, 255, 0.15);
        border: 1px solid rgba(170, 0, 255, 0.5);
        color: #aa00ff;
        font-size: 12px;
        font-weight: bold;
        padding: 5px 14px;
        border-radius: 20px;
      }
      .btn-cyber-primary {
        background: linear-gradient(135deg, #00ffff, #0088ff);
        color: #040c1a;
        font-weight: 900;
        font-size: 18px;
        letter-spacing: 2px;
        padding: 16px 36px;
        border: none;
        border-radius: 30px;
        cursor: pointer;
        box-shadow: 0 0 24px rgba(0, 240, 255, 0.4);
        transition: all 0.2s ease;
        width: 100%;
        pointer-events: auto;
      }
      .btn-cyber-primary:hover {
        transform: translateY(-2px);
        box-shadow: 0 0 36px rgba(0, 240, 255, 0.7);
        filter: brightness(1.15);
      }
      .settings-button-group {
        display: flex;
        justify-content: center;
        gap: 10px;
        margin-top: 16px;
      }
      .btn-cyber-secondary {
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.2);
        color: #aabbcc;
        padding: 8px 16px;
        border-radius: 20px;
        cursor: pointer;
        font-size: 12px;
        font-weight: bold;
        transition: all 0.2s ease;
        pointer-events: auto;
      }
      .btn-cyber-secondary:hover {
        border-color: #00ffff;
        color: #00ffff;
        background: rgba(0, 240, 255, 0.1);
      }
      .shop-item-card {
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: rgba(14, 28, 54, 0.7);
        border: 1px solid rgba(0, 240, 255, 0.25);
        padding: 14px 18px;
        border-radius: 14px;
        text-align: left;
      }
      .btn-buy-tier {
        background: linear-gradient(135deg, #aa00ff, #00ffff);
        color: #ffffff;
        font-weight: 800;
        border: none;
        padding: 8px 18px;
        border-radius: 20px;
        cursor: pointer;
        box-shadow: 0 0 12px rgba(170, 0, 255, 0.4);
      }
      .btn-buy-tier:disabled {
        opacity: 0.4;
        cursor: not-allowed;
        box-shadow: none;
      }
      .perk-option-card {
        background: rgba(12, 24, 48, 0.85);
        border: 1px solid rgba(0, 240, 255, 0.3);
        border-radius: 14px;
        padding: 16px 20px;
        cursor: pointer;
        transition: all 0.2s ease;
        text-align: left;
        display: flex;
        align-items: center;
        gap: 16px;
      }
    `;
    document.head.appendChild(style);
  }

  public checkHighScore(score: number): boolean {
    if (score > this.highScore) {
      this.highScore = score;
      localStorage.setItem('cyber_swarm_high_score', score.toString());
      return true;
    }
    return false;
  }

  public addCores(earned: number): void {
    this.cyberCores += earned;
    localStorage.setItem('cyber_swarm_cores', this.cyberCores.toString());
  }

  private saveMeta(): void {
    localStorage.setItem('cyber_swarm_meta', JSON.stringify(this.metaUpgrades));
    localStorage.setItem('cyber_swarm_cores', this.cyberCores.toString());
  }

  public showStartMenu(): void {
    this.element.style.display = 'flex';
    this.element.innerHTML = `
      <div class="menu-modal-panel">
        <div class="cyber-head-title">CYBER SWARM 3D</div>
        <div class="cyber-sub-title">SURVIVAL SHOOTER • CHOOSE SHIP CLASS</div>

        <div class="badge-container-row">
          <div class="stat-pill">🏆 BEST SCORE: ${this.highScore}</div>
          <div class="core-pill">💎 CYBER CORES: ${this.cyberCores}</div>
        </div>

        <div class="ship-select-row">
          <div class="ship-card ${this.selectedShipClass === 'VANGUARD' ? 'active' : ''}" data-ship="VANGUARD">
            <div style="font-size: 26px;">🚀</div>
            <div style="font-weight: bold; color: #00ffff; margin-top: 4px;">VANGUARD</div>
            <div style="font-size: 10px; color: #88aacc; margin-top: 2px;">BALANCED • 100 HP</div>
          </div>
          <div class="ship-card ${this.selectedShipClass === 'STRIKER' ? 'active' : ''}" data-ship="STRIKER">
            <div style="font-size: 26px;">⚡</div>
            <div style="font-weight: bold; color: #ffaa00; margin-top: 4px;">STRIKER</div>
            <div style="font-size: 10px; color: #88aacc; margin-top: 2px;">GLASS CANNON • 65 HP</div>
          </div>
          <div class="ship-card ${this.selectedShipClass === 'JUGGERNAUT' ? 'active' : ''}" data-ship="JUGGERNAUT">
            <div style="font-size: 26px;">🛡️</div>
            <div style="font-weight: bold; color: #ff00aa; margin-top: 4px;">JUGGERNAUT</div>
            <div style="font-size: 10px; color: #88aacc; margin-top: 2px;">TANK • 160 HP</div>
          </div>
        </div>

        <button id="start-btn" class="btn-cyber-primary">DEPLOY INTO ARENA</button>

        <div class="settings-button-group">
          <button id="shop-btn" class="btn-cyber-secondary" style="border-color: #aa00ff; color: #aa00ff;">🛍️ OVERCLOCK SHOP</button>
          <button id="audio-btn" class="btn-cyber-secondary">🔊 SOUND: ON</button>
          <button id="bloom-btn" class="btn-cyber-secondary">✨ BLOOM: HIGH</button>
        </div>
      </div>
    `;

    const shipCards = this.element.querySelectorAll('.ship-card');
    shipCards.forEach(card => {
      card.addEventListener('click', () => {
        shipCards.forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        this.selectedShipClass = card.getAttribute('data-ship') as ShipClass;
      });
    });

    document.getElementById('start-btn')!.addEventListener('click', () => {
      this.element.style.display = 'none';
      this.onStartGame(this.selectedShipClass);
    });

    document.getElementById('shop-btn')!.addEventListener('click', () => {
      this.showShopModal();
    });

    const audioBtn = document.getElementById('audio-btn')!;
    audioBtn.addEventListener('click', () => {
      const isEnabled = this.onToggleAudio();
      audioBtn.innerText = isEnabled ? '🔊 SOUND: ON' : '🔇 SOUND: MUTED';
    });

    let bloomHigh = true;
    const bloomBtn = document.getElementById('bloom-btn')!;
    bloomBtn.addEventListener('click', () => {
      bloomHigh = !bloomHigh;
      bloomBtn.innerText = bloomHigh ? '✨ BLOOM: HIGH' : '⚡ BLOOM: OFF (PERF)';
      if (this.onToggleBloom) {
        this.onToggleBloom(bloomHigh);
      }
    });
  }

  public showShopModal(): void {
    this.element.style.display = 'flex';

    const speedCost = 150;
    const hpCost = 150;
    const critCost = 200;

    const isSpeedMax = this.metaUpgrades.speedLevel >= 5;
    const isHpMax = this.metaUpgrades.healthLevel >= 5;
    const isCritMax = this.metaUpgrades.critLevel >= 5;

    this.element.innerHTML = `
      <div class="menu-modal-panel">
        <div class="cyber-head-title" style="background: linear-gradient(135deg, #aa00ff, #00ffff); -webkit-background-clip: text;">CYBER CORE SHOP</div>
        <div class="cyber-sub-title">PERMANENT STAT OVERCLOCKS • AVAILABLE CORES: <span style="color:#aa00ff; font-weight:bold;">${this.cyberCores}</span></div>

        <div style="display: flex; flex-direction: column; gap: 14px; margin-bottom: 24px;">
          <div class="shop-item-card">
            <div>
              <div style="font-weight: bold; font-size: 15px; color: #00ffaa;">🚀 Base Move Speed (+5%/lvl)</div>
              <div style="font-size: 12px; color: #88aacc; margin-top: 2px;">Current Tier: LVL ${this.metaUpgrades.speedLevel}/5</div>
            </div>
            <button id="buy-speed" class="btn-buy-tier" ${isSpeedMax || this.cyberCores < speedCost ? 'disabled' : ''}>
              ${isSpeedMax ? 'MAXED' : `${speedCost} CORES`}
            </button>
          </div>

          <div class="shop-item-card">
            <div>
              <div style="font-weight: bold; font-size: 15px; color: #ff0055;">🛡️ Max Hull Armor (+10 HP/lvl)</div>
              <div style="font-size: 12px; color: #88aacc; margin-top: 2px;">Current Tier: LVL ${this.metaUpgrades.healthLevel}/5</div>
            </div>
            <button id="buy-hp" class="btn-buy-tier" ${isHpMax || this.cyberCores < hpCost ? 'disabled' : ''}>
              ${isHpMax ? 'MAXED' : `${hpCost} CORES`}
            </button>
          </div>

          <div class="shop-item-card">
            <div>
              <div style="font-weight: bold; font-size: 15px; color: #ffaa00;">🎯 Critical Hit Chance (+5%/lvl)</div>
              <div style="font-size: 12px; color: #88aacc; margin-top: 2px;">Current Tier: LVL ${this.metaUpgrades.critLevel}/5</div>
            </div>
            <button id="buy-crit" class="btn-buy-tier" ${isCritMax || this.cyberCores < critCost ? 'disabled' : ''}>
              ${isCritMax ? 'MAXED' : `${critCost} CORES`}
            </button>
          </div>
        </div>

        <button id="close-shop" class="btn-cyber-primary" style="background: transparent; border: 1.5px solid #00ffff; color: #00ffff; box-shadow: none;">BACK TO MENU</button>
      </div>
    `;

    document.getElementById('buy-speed')?.addEventListener('click', () => {
      if (this.cyberCores >= speedCost && this.metaUpgrades.speedLevel < 5) {
        this.cyberCores -= speedCost;
        this.metaUpgrades.speedLevel++;
        this.saveMeta();
        this.showShopModal();
      }
    });

    document.getElementById('buy-hp')?.addEventListener('click', () => {
      if (this.cyberCores >= hpCost && this.metaUpgrades.healthLevel < 5) {
        this.cyberCores -= hpCost;
        this.metaUpgrades.healthLevel++;
        this.saveMeta();
        this.showShopModal();
      }
    });

    document.getElementById('buy-crit')?.addEventListener('click', () => {
      if (this.cyberCores >= critCost && this.metaUpgrades.critLevel < 5) {
        this.cyberCores -= critCost;
        this.metaUpgrades.critLevel++;
        this.saveMeta();
        this.showShopModal();
      }
    });

    document.getElementById('close-shop')!.addEventListener('click', () => {
      this.showStartMenu();
    });
  }

  public showLevelUpModal(level: number, options: PerkOption[], onSelect: (perkId: string) => void): void {
    this.element.style.display = 'flex';

    let perkCardsHTML = '';
    options.forEach(perk => {
      perkCardsHTML += `
        <div class="perk-option-card" data-perkid="${perk.id}" style="border-color: ${perk.color}55;">
          <div style="font-size: 32px; min-width: 44px; height: 44px; display: grid; place-content: center; background: ${perk.color}22; border-radius: 10px;">${perk.icon}</div>
          <div>
            <div style="font-size: 16px; font-weight: bold; color: ${perk.color};">${perk.title}</div>
            <div style="font-size: 13px; color: #aabbcc; margin-top: 2px;">${perk.description}</div>
          </div>
        </div>
      `;
    });

    this.element.innerHTML = `
      <div class="menu-modal-panel">
        <div class="cyber-head-title" style="background: linear-gradient(135deg, #aa00ff, #00ffff); -webkit-background-clip: text;">SYSTEM UPGRADE</div>
        <div class="cyber-sub-title">DATA CORE OVERCHARGED • CHOOSE A PERK (LEVEL ${level})</div>

        <div style="display: flex; flex-direction: column; gap: 14px; margin-bottom: 10px;">
          ${perkCardsHTML}
        </div>
      </div>
    `;

    const cards = this.element.querySelectorAll('.perk-option-card');
    cards.forEach(card => {
      card.addEventListener('click', () => {
        const perkId = card.getAttribute('data-perkid')!;
        this.element.style.display = 'none';
        onSelect(perkId);
      });
    });
  }

  public showVictoryScreen(score: number, timeSec: number, kills: number, level: number): void {
    this.element.style.display = 'flex';
    const isNewHigh = this.checkHighScore(score);
    const earnedCores = Math.floor(score / 10 + kills * 2);
    this.addCores(earnedCores);

    const minutes = Math.floor(timeSec / 60);
    const seconds = Math.floor(timeSec % 60);
    const timeStr = `${minutes}m ${seconds}s`;

    this.element.innerHTML = `
      <div class="menu-modal-panel" style="border-color: rgba(0, 255, 170, 0.5); box-shadow: 0 0 50px rgba(0, 255, 170, 0.35);">
        <div class="cyber-head-title" style="background: linear-gradient(135deg, #00ffaa, #00ffff); -webkit-background-clip: text;">VICTORY ACHIEVED!</div>
        <div class="cyber-sub-title">CYBER OVERLORD VAPORIZED • ARENA CLEARED</div>

        ${isNewHigh ? '<div style="color: #ffaa00; font-size: 16px; font-weight: bold; margin-bottom: 10px;">🎉 NEW ALL-TIME HIGH SCORE! 🎉</div>' : ''}
        <div style="color: #aa00ff; font-weight: bold; font-size: 15px; margin-bottom: 18px;">💎 +${earnedCores} CYBER CORES EARNED</div>

        <div style="background: rgba(255,255,255,0.03); border-radius: 14px; padding: 20px; margin-bottom: 24px; display: grid; grid-template-columns: 1fr 1fr; gap: 16px; text-align: center;">
          <div>
            <div style="font-size: 11px; color: #88aacc;">FINAL SCORE</div>
            <div style="font-size: 24px; font-weight: bold; color: #00ffff;">${score}</div>
          </div>
          <div>
            <div style="font-size: 11px; color: #88aacc;">TIME SURVIVED</div>
            <div style="font-size: 24px; font-weight: bold; color: #00ffaa;">${timeStr}</div>
          </div>
          <div>
            <div style="font-size: 11px; color: #88aacc;">ENEMIES VAPORIZED</div>
            <div style="font-size: 24px; font-weight: bold; color: #ff0055;">${kills}</div>
          </div>
          <div>
            <div style="font-size: 11px; color: #88aacc;">LEVEL REACHED</div>
            <div style="font-size: 24px; font-weight: bold; color: #aa00ff;">LVL ${level}</div>
          </div>
        </div>

        <button id="victory-btn" class="btn-cyber-primary" style="background: linear-gradient(135deg, #00ffaa, #00ffff); box-shadow: 0 0 24px rgba(0, 255, 170, 0.5);">PLAY AGAIN</button>
      </div>
    `;

    document.getElementById('victory-btn')!.addEventListener('click', () => {
      this.element.style.display = 'none';
      this.showStartMenu();
    });
  }

  public showGameOver(score: number, wave: number, kills: number): void {
    this.element.style.display = 'flex';
    const isNewHigh = this.checkHighScore(score);
    const earnedCores = Math.floor(score / 15 + kills * 1.5);
    this.addCores(earnedCores);

    this.element.innerHTML = `
      <div class="menu-modal-panel" style="border-color: rgba(255, 0, 85, 0.45); box-shadow: 0 0 40px rgba(255, 0, 85, 0.25);">
        <div class="cyber-head-title" style="background: linear-gradient(135deg, #ff0055, #ff6600); -webkit-background-clip: text;">SYSTEM OVERRIDE</div>
        <div class="cyber-sub-title">SWARM BREACHED YOUR ARMOR</div>

        ${isNewHigh ? '<div style="color: #ffaa00; font-size: 16px; font-weight: bold; margin-bottom: 10px;">🎉 NEW ALL-TIME HIGH SCORE! 🎉</div>' : ''}
        <div style="color: #aa00ff; font-weight: bold; font-size: 15px; margin-bottom: 18px;">💎 +${earnedCores} CYBER CORES EARNED</div>

        <div style="background: rgba(255,255,255,0.03); border-radius: 14px; padding: 20px; margin-bottom: 24px; display: flex; justify-content: space-around;">
          <div>
            <div style="font-size: 11px; color: #88aacc;">FINAL SCORE</div>
            <div style="font-size: 26px; font-weight: bold; color: #00ffff;">${score}</div>
          </div>
          <div>
            <div style="font-size: 11px; color: #88aacc;">SURVIVED WAVES</div>
            <div style="font-size: 26px; font-weight: bold; color: #ffaa00;">${wave}</div>
          </div>
          <div>
            <div style="font-size: 11px; color: #88aacc;">KILLS</div>
            <div style="font-size: 26px; font-weight: bold; color: #ff0055;">${kills}</div>
          </div>
        </div>

        <button id="restart-btn" class="btn-cyber-primary" style="background: linear-gradient(135deg, #ff0055, #ff6600); box-shadow: 0 0 24px rgba(255, 0, 85, 0.45);">REBOOT SYSTEM</button>
      </div>
    `;

    document.getElementById('restart-btn')!.addEventListener('click', () => {
      this.element.style.display = 'none';
      this.showStartMenu();
    });
  }
}
