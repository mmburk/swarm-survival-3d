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
  private onStartGame: () => void;
  private onToggleAudio: () => boolean;
  private onToggleBloom?: (enabled: boolean) => void;

  private highScore: number = 0;
  public cyberCores: number = 0;

  public metaUpgrades: MetaUpgrades = {
    speedLevel: 0,
    healthLevel: 0,
    critLevel: 0,
    shieldUnlocked: false
  };

  constructor(
    onStartGame: () => void,
    onToggleAudio: () => boolean,
    onToggleBloom?: (enabled: boolean) => void
  ) {
    this.onStartGame = onStartGame;
    this.onToggleAudio = onToggleAudio;
    this.onToggleBloom = onToggleBloom;

    // Load High Score & Cyber Cores from localStorage
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
      z-index: 20;
      display: flex;
      justify-content: center;
      align-items: center;
      font-family: 'Segoe UI', Roboto, sans-serif;
      color: #fff;
      user-select: none;
    `;
    document.body.appendChild(this.element);

    this.showStartMenu();
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
      <style>
        .menu-modal {
          background: rgba(6, 14, 28, 0.88);
          backdrop-filter: blur(16px);
          border: 1px solid rgba(0, 240, 255, 0.3);
          box-shadow: 0 12px 48px rgba(0, 0, 0, 0.8), 0 0 30px rgba(0, 240, 255, 0.15);
          border-radius: 20px;
          padding: 36px;
          max-width: 560px;
          width: 90%;
          text-align: center;
          animation: popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
        @keyframes popIn {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
        .cyber-title {
          font-size: 38px;
          font-weight: 900;
          letter-spacing: 3px;
          background: linear-gradient(135deg, #00ffff, #ff00aa);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          margin-bottom: 8px;
          text-transform: uppercase;
        }
        .cyber-sub {
          font-size: 14px;
          color: #88aacc;
          margin-bottom: 16px;
          letter-spacing: 1px;
        }
        .stats-badge-row {
          display: flex;
          justify-content: center;
          gap: 12px;
          margin-bottom: 20px;
        }
        .high-score-badge {
          background: rgba(255, 170, 0, 0.15);
          border: 1px solid #ffaa00;
          color: #ffaa00;
          font-size: 12px;
          font-weight: bold;
          padding: 4px 12px;
          border-radius: 20px;
        }
        .cores-badge {
          background: rgba(170, 0, 255, 0.15);
          border: 1px solid #aa00ff;
          color: #aa00ff;
          font-size: 12px;
          font-weight: bold;
          padding: 4px 12px;
          border-radius: 20px;
        }
        .controls-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          background: rgba(255,255,255,0.04);
          padding: 14px;
          border-radius: 12px;
          margin-bottom: 24px;
          text-align: left;
          font-size: 13px;
          border: 1px solid rgba(255,255,255,0.06);
        }
        .control-item {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .key-badge {
          background: rgba(0, 240, 255, 0.15);
          border: 1px solid rgba(0, 240, 255, 0.4);
          color: #00ffff;
          padding: 3px 8px;
          border-radius: 6px;
          font-weight: bold;
          font-size: 12px;
        }
        .btn-action {
          background: linear-gradient(135deg, #00ffff, #0099ff);
          color: #040c1a;
          font-weight: 900;
          font-size: 18px;
          letter-spacing: 2px;
          padding: 14px 36px;
          border: none;
          border-radius: 30px;
          cursor: pointer;
          box-shadow: 0 0 20px rgba(0, 240, 255, 0.4);
          transition: all 0.2s ease;
          width: 100%;
        }
        .btn-action:hover {
          transform: translateY(-2px);
          box-shadow: 0 0 30px rgba(0, 240, 255, 0.7);
          filter: brightness(1.1);
        }
        .settings-row {
          display: flex;
          justify-content: center;
          gap: 10px;
          margin-top: 14px;
        }
        .btn-setting {
          background: transparent;
          border: 1px solid rgba(255,255,255,0.2);
          color: #aaa;
          padding: 6px 14px;
          border-radius: 20px;
          cursor: pointer;
          font-size: 12px;
        }
        .shop-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          padding: 12px 16px;
          border-radius: 12px;
          text-align: left;
        }
        .btn-buy {
          background: linear-gradient(135deg, #aa00ff, #00ffff);
          color: #fff;
          font-weight: bold;
          border: none;
          padding: 6px 16px;
          border-radius: 16px;
          cursor: pointer;
        }
      </style>

      <div class="menu-modal">
        <div class="cyber-title">CYBER SWARM 3D</div>
        <div class="cyber-sub">SURVIVAL SHOOTER • THREE.JS & ARCADE PHYSICS</div>

        <div class="stats-badge-row">
          <div class="high-score-badge">🏆 HIGH SCORE: ${this.highScore}</div>
          <div class="cores-badge">💎 CORES: ${this.cyberCores}</div>
        </div>

        <div class="controls-grid">
          <div class="control-item"><span class="key-badge">WASD / TOUCH</span> Movement</div>
          <div class="control-item"><span class="key-badge">MOUSE</span> 3D Aiming</div>
          <div class="control-item"><span class="key-badge">LMB</span> Pulse Laser</div>
          <div class="control-item"><span class="key-badge">RMB</span> Plasma Missile</div>
          <div class="control-item"><span class="key-badge">E</span> Cyber Nova Ult</div>
          <div class="control-item"><span class="key-badge">SPACE</span> Thruster Dash</div>
        </div>

        <button id="start-btn" class="btn-action">DEPLOY INTO ARENA</button>

        <div class="settings-row">
          <button id="shop-btn" class="btn-setting" style="border-color: #aa00ff; color: #aa00ff;">🛍️ META SHOP</button>
          <button id="audio-btn" class="btn-setting">🔊 SOUND: ON</button>
          <button id="bloom-btn" class="btn-setting">✨ BLOOM: HIGH</button>
        </div>
      </div>
    `;

    document.getElementById('start-btn')!.addEventListener('click', () => {
      this.element.style.display = 'none';
      this.onStartGame();
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
    this.element.innerHTML = `
      <div class="menu-modal" style="max-width: 600px;">
        <div class="cyber-title" style="background: linear-gradient(135deg, #aa00ff, #00ffff); -webkit-background-clip: text;">CYBER CORE SHOP</div>
        <div class="cyber-sub">PERMANENT STAT OVERCLOCKS • CORES: <span style="color:#aa00ff; font-weight:bold;">${this.cyberCores}</span></div>

        <div style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 24px;">
          <div class="shop-row">
            <div>
              <div style="font-weight: bold; color: #00ffaa;">🚀 Base Move Speed (+5%/lvl)</div>
              <div style="font-size: 12px; color: #aaa;">Current Level: ${this.metaUpgrades.speedLevel}/5</div>
            </div>
            <button id="buy-speed" class="btn-buy" ${this.metaUpgrades.speedLevel >= 5 || this.cyberCores < 150 ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''}>150 CORES</button>
          </div>

          <div class="shop-row">
            <div>
              <div style="font-weight: bold; color: #ff0055;">🛡️ Max Hull Armor (+10 HP/lvl)</div>
              <div style="font-size: 12px; color: #aaa;">Current Level: ${this.metaUpgrades.healthLevel}/5</div>
            </div>
            <button id="buy-hp" class="btn-buy" ${this.metaUpgrades.healthLevel >= 5 || this.cyberCores < 150 ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''}>150 CORES</button>
          </div>

          <div class="shop-row">
            <div>
              <div style="font-weight: bold; color: #ffaa00;">🎯 Critical Hit Chance (+5%/lvl)</div>
              <div style="font-size: 12px; color: #aaa;">Current Level: ${this.metaUpgrades.critLevel}/5</div>
            </div>
            <button id="buy-crit" class="btn-buy" ${this.metaUpgrades.critLevel >= 5 || this.cyberCores < 200 ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''}>200 CORES</button>
          </div>
        </div>

        <button id="close-shop" class="btn-action" style="background: transparent; border: 1px solid #00ffff; color: #00ffff;">BACK TO MENU</button>
      </div>
    `;

    document.getElementById('buy-speed')?.addEventListener('click', () => {
      if (this.cyberCores >= 150 && this.metaUpgrades.speedLevel < 5) {
        this.cyberCores -= 150;
        this.metaUpgrades.speedLevel++;
        this.saveMeta();
        this.showShopModal();
      }
    });

    document.getElementById('buy-hp')?.addEventListener('click', () => {
      if (this.cyberCores >= 150 && this.metaUpgrades.healthLevel < 5) {
        this.cyberCores -= 150;
        this.metaUpgrades.healthLevel++;
        this.saveMeta();
        this.showShopModal();
      }
    });

    document.getElementById('buy-crit')?.addEventListener('click', () => {
      if (this.cyberCores >= 200 && this.metaUpgrades.critLevel < 5) {
        this.cyberCores -= 200;
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
        <div class="perk-card" data-perkid="${perk.id}" style="border-color: ${perk.color}55;">
          <div style="font-size: 32px; min-width: 44px; height: 44px; display: grid; place-content: center; background: ${perk.color}22; border-radius: 10px;">${perk.icon}</div>
          <div>
            <div style="font-size: 16px; font-weight: bold; color: ${perk.color};">${perk.title}</div>
            <div style="font-size: 13px; color: #aabbcc; margin-top: 2px;">${perk.description}</div>
          </div>
        </div>
      `;
    });

    this.element.innerHTML = `
      <div class="menu-modal" style="max-width: 600px;">
        <div class="cyber-title" style="background: linear-gradient(135deg, #aa00ff, #00ffff); -webkit-background-clip: text;">SYSTEM UPGRADE</div>
        <div class="cyber-sub">DATA CORE OVERCHARGED • CHOOSE A PERK (LEVEL ${level})</div>

        <div style="display: flex; flex-direction: column; gap: 14px; margin-bottom: 10px;">
          ${perkCardsHTML}
        </div>
      </div>
    `;

    const cards = this.element.querySelectorAll('.perk-card');
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
      <div class="menu-modal" style="border-color: rgba(0, 255, 170, 0.5); box-shadow: 0 0 45px rgba(0, 255, 170, 0.3);">
        <div class="cyber-title" style="background: linear-gradient(135deg, #00ffaa, #00ffff); -webkit-background-clip: text;">VICTORY ACHIEVED!</div>
        <div class="cyber-sub">CYBER OVERLORD VAPORIZED • ARENA CLEARED</div>

        ${isNewHigh ? '<div style="color: #ffaa00; font-size: 16px; font-weight: bold; margin-bottom: 12px;">🎉 NEW ALL-TIME HIGH SCORE! 🎉</div>' : ''}
        <div style="color: #aa00ff; font-weight: bold; margin-bottom: 16px;">💎 +${earnedCores} CYBER CORES EARNED</div>

        <div style="background: rgba(255,255,255,0.04); border-radius: 12px; padding: 20px; margin-bottom: 24px; display: grid; grid-template-columns: 1fr 1fr; gap: 16px; text-align: center;">
          <div>
            <div style="font-size: 11px; color: #888;">FINAL SCORE</div>
            <div style="font-size: 24px; font-weight: bold; color: #00ffff;">${score}</div>
          </div>
          <div>
            <div style="font-size: 11px; color: #888;">TIME SURVIVED</div>
            <div style="font-size: 24px; font-weight: bold; color: #00ffaa;">${timeStr}</div>
          </div>
          <div>
            <div style="font-size: 11px; color: #888;">ENEMIES VAPORIZED</div>
            <div style="font-size: 24px; font-weight: bold; color: #ff0055;">${kills}</div>
          </div>
          <div>
            <div style="font-size: 11px; color: #888;">LEVEL REACHED</div>
            <div style="font-size: 24px; font-weight: bold; color: #aa00ff;">LVL ${level}</div>
          </div>
        </div>

        <button id="victory-btn" class="btn-action" style="background: linear-gradient(135deg, #00ffaa, #00ffff); box-shadow: 0 0 20px rgba(0, 255, 170, 0.5);">PLAY AGAIN</button>
      </div>
    `;

    document.getElementById('victory-btn')!.addEventListener('click', () => {
      this.element.style.display = 'none';
      this.onStartGame();
    });
  }

  public showGameOver(score: number, wave: number, kills: number): void {
    this.element.style.display = 'flex';
    const isNewHigh = this.checkHighScore(score);
    const earnedCores = Math.floor(score / 15 + kills * 1.5);
    this.addCores(earnedCores);

    this.element.innerHTML = `
      <div class="menu-modal" style="border-color: rgba(255, 0, 85, 0.4); box-shadow: 0 0 35px rgba(255, 0, 85, 0.2);">
        <div class="cyber-title" style="background: linear-gradient(135deg, #ff0055, #ff6600); -webkit-background-clip: text;">SYSTEM OVERRIDE</div>
        <div class="cyber-sub">SWARM BREACHED YOUR ARMOR</div>

        ${isNewHigh ? '<div style="color: #ffaa00; font-size: 16px; font-weight: bold; margin-bottom: 12px;">🎉 NEW ALL-TIME HIGH SCORE! 🎉</div>' : ''}
        <div style="color: #aa00ff; font-weight: bold; margin-bottom: 16px;">💎 +${earnedCores} CYBER CORES EARNED</div>

        <div style="background: rgba(255,255,255,0.04); border-radius: 12px; padding: 20px; margin-bottom: 28px; display: flex; justify-content: space-around;">
          <div>
            <div style="font-size: 11px; color: #888;">FINAL SCORE</div>
            <div style="font-size: 26px; font-weight: bold; color: #00ffff;">${score}</div>
          </div>
          <div>
            <div style="font-size: 11px; color: #888;">SURVIVED WAVES</div>
            <div style="font-size: 26px; font-weight: bold; color: #ffaa00;">${wave}</div>
          </div>
          <div>
            <div style="font-size: 11px; color: #888;">KILLS</div>
            <div style="font-size: 26px; font-weight: bold; color: #ff0055;">${kills}</div>
          </div>
        </div>

        <button id="restart-btn" class="btn-action" style="background: linear-gradient(135deg, #ff0055, #ff6600); box-shadow: 0 0 20px rgba(255, 0, 85, 0.4);">REBOOT SYSTEM</button>
      </div>
    `;

    document.getElementById('restart-btn')!.addEventListener('click', () => {
      this.element.style.display = 'none';
      this.onStartGame();
    });
  }
}
