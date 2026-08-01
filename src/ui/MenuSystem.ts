import { injectTheme, CSS } from '../theme/Palette';
import { SaveSystem } from '../utils/SaveSystem';
import { META_DEFS, NIGHT_TIERS } from '../config/Progression';
import { WEAPONS, WEAPON_ORDER, resolveWeaponStats, type WeaponId } from '../config/Weapons';
import { CALLERS } from './BoonModal';

export interface RunSummary {
  survived: boolean;
  sector: number;
  sectorName: string;
  kills: number;
  scrapEarned: number;
  duration: number;
  weapon: string;
  cause: string;
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
        grid-template-columns: 236px 1fr;
        gap: 18px;
        margin-top: 18px;
      }
      .wpn-item {
        padding: 11px 13px;
        border: 1px solid var(--char);
        border-left: 3px solid transparent;
        background: rgba(0,0,0,0.22);
        cursor: pointer;
        transition: border-color 0.12s linear, background 0.12s linear;
      }
      .wpn-item:hover { background: rgba(255,255,255,0.04); }
      .wpn-item.active {
        border-left-color: var(--rust);
        background: rgba(168,85,43,0.12);
      }
      .wpn-item.locked { opacity: 0.5; }

      .stat-line { display: flex; align-items: center; gap: 10px; margin-top: 7px; }
      .stat-key {
        width: 62px;
        font-size: 10px;
        letter-spacing: 1.6px;
        text-transform: uppercase;
        color: var(--ash);
      }
      .stat-track { flex: 1; height: 7px; background: rgba(0,0,0,0.5); border: 1px solid var(--char); }
      .stat-val { height: 100%; background: linear-gradient(90deg, #7d5a2c, #c98d3c); }

      .tier-item {
        padding: 12px 15px;
        border: 1px solid var(--char);
        border-left: 3px solid transparent;
        background: rgba(0,0,0,0.22);
        cursor: pointer;
      }
      .tier-item.active { border-left-color: var(--blood); background: rgba(142,35,35,0.12); }
      .tier-item:hover { background: rgba(255,255,255,0.04); }

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
      <div style="text-align:right;">
        <div class="ll-sub" style="margin:0;">Scrap on hand</div>
        <div class="mn-scrap">${SaveSystem.getScrap()}</div>
      </div>
    `;
  }

  // ------------------------------------------------------------------ title

  public showTitle(onEnter: () => void): void {
    const st = SaveSystem.getStats();

    this.present(`
      <div class="ll-panel ll-pinned mn-shell" style="width:560px; text-align:center; padding-top:44px;">
        <div class="ll-sub" style="margin:0;">A roguelite of the long walk home</div>
        <div class="ll-title" style="font-size:60px; margin-top:8px;">LAST LIGHT</div>
        <div class="ll-sub">Sector by sector. Night after night.</div>

        <div class="ll-rule"></div>

        <div style="display:flex; justify-content:center; gap:10px; flex-wrap:wrap;">
          <div class="ll-tag scrap">SCRAP ${SaveSystem.getScrap()}</div>
          <div class="ll-tag">RUNS ${st.runs}</div>
          <div class="ll-tag">DEEPEST SECTOR ${String(st.bestSector).padStart(2, '0')}</div>
          <div class="ll-tag">PUT DOWN ${st.totalKills}</div>
        </div>

        <button id="btn-enter" class="ll-btn" style="margin-top:26px;">Go Down To The Shelter</button>

        <div style="margin-top:20px; font-size:11.5px; line-height:1.9; color:var(--ash); letter-spacing:0.6px;">
          <b style="color:var(--bone)">WASD</b> move &nbsp;·&nbsp;
          <b style="color:var(--bone)">MOUSE</b> aim &nbsp;·&nbsp;
          <b style="color:var(--bone)">LMB</b> fire &nbsp;·&nbsp;
          <b style="color:var(--bone)">RMB</b> heavy<br>
          <b style="color:var(--bone)">SPACE</b> roll &nbsp;·&nbsp;
          <b style="color:var(--bone)">R</b> shove &nbsp;·&nbsp;
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
      return `
        <div class="wpn-item ${active ? 'active' : ''} ${unlocked ? '' : 'locked'}" data-wpn="${id}">
          <div class="mn-name" style="font-size:16px;">${def.name}</div>
          <div class="mn-note">${unlocked ? def.model : `LOCKED — ${def.unlockCost} scrap`}</div>
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
      </div>
    `;

    const r = def.readout;
    const shotsPerSecond = (1 / stats.cooldown).toFixed(1);

    this.present(`
      <div class="ll-panel ll-pinned mn-shell">
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
            <div style="display:flex; justify-content:space-between; align-items:baseline;">
              <div class="ll-title" style="font-size:26px;">${def.name}</div>
              <div class="ll-sub" style="margin:0;">${def.model}</div>
            </div>

            <div style="font-size:13.5px; line-height:1.6; color:var(--bone); margin-top:10px;">${def.desc}</div>
            <div style="font-size:12px; font-style:italic; color:var(--ash); margin-top:8px;">${def.flavor}</div>

            <div style="margin-top:14px;">
              ${bar('Power', r.power)}
              ${bar('Cadence', r.speed)}
              ${bar('Reach', r.reach)}
              ${bar('Control', r.control)}
            </div>

            <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:13px;">
              <div class="ll-tag">${stats.damage} dmg${stats.pellets > 1 ? ` × ${stats.pellets}` : ''}</div>
              <div class="ll-tag">${shotsPerSecond} / sec</div>
              <div class="ll-tag">${Math.round(stats.range)}m</div>
              ${stats.pierce > 0 ? `<div class="ll-tag">pierces ${stats.pierce}</div>` : ''}
            </div>

            <div style="margin-top:16px; padding:12px 14px; background:rgba(0,0,0,0.26); border:1px solid var(--char);">
              <div class="ll-sub" style="margin:0;">Heavy attack — right mouse</div>
              <div class="mn-name" style="font-size:16px; margin-top:3px;">${def.alt.name}</div>
              <div class="mn-note">${def.alt.desc} &nbsp;·&nbsp; ${def.alt.cooldown.toFixed(1)}s between uses</div>
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
                      : `<button id="btn-mod-buy" class="ll-btn-ghost" ${scrap < def.mod.cost ? 'disabled' : ''}>BUY · ${def.mod.cost}</button>`
                }
              </div>
            </div>

            <div style="display:flex; gap:10px; margin-top:18px;">
              ${
                unlocked
                  ? `<button id="btn-take" class="ll-btn">Take ${def.name}</button>`
                  : `<button id="btn-unlock" class="ll-btn" ${scrap < def.unlockCost ? 'disabled' : ''}>Trade ${def.unlockCost} scrap for it</button>`
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
            ${maxed ? 'DONE' : `${cost} SCRAP`}
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

  // ------------------------------------------------------------------ radio

  public showRadio(onClose: () => void): void {
    const current = SaveSystem.getNightLevel();

    const rows = NIGHT_TIERS.map((t) => `
      <div class="tier-item ${t.level === current ? 'active' : ''}" data-night="${t.level}">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:16px;">
          <div style="flex:1;">
            <div class="mn-name" style="font-size:17px;">${t.level}. ${t.name}</div>
            <div class="mn-note">${t.desc}</div>
          </div>
          <div style="text-align:right; white-space:nowrap;">
            <div class="ll-tag scrap">×${t.scrapMult.toFixed(1)} scrap</div>
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

        <button id="btn-close" class="ll-btn" style="margin-top:18px;">Switch It Off</button>
      </div>
    `);

    this.root.querySelectorAll<HTMLElement>('[data-night]').forEach((el) => {
      el.addEventListener('click', () => {
        SaveSystem.setNightLevel(parseInt(el.dataset.night!, 10));
        this.showRadio(onClose);
      });
    });

    document.getElementById('btn-close')!.addEventListener('click', () => {
      this.hide();
      onClose();
    });
  }

  // ---------------------------------------------------------------- records

  public showRecords(onClose: () => void): void {
    const st = SaveSystem.getStats();

    const stat = (label: string, value: string | number) => `
      <div style="padding:11px 13px; background:rgba(0,0,0,0.24); border:1px solid var(--char);">
        <div class="ll-sub" style="margin:0;">${label}</div>
        <div style="font-family:var(--stencil); font-size:23px; color:var(--paper); margin-top:2px;">${value}</div>
      </div>
    `;

    const callerRows = (Object.keys(CALLERS) as Array<keyof typeof CALLERS>).map((k) => {
      const c = CALLERS[k];
      return `
        <div style="padding:9px 12px; border-left:3px solid ${c.color}; background:rgba(0,0,0,0.2);">
          <div class="mn-name" style="font-size:14px; color:${c.color};">${c.name}</div>
          <div class="mn-note">${c.band}</div>
        </div>
      `;
    }).join('');

    const bestiary = [
      ['Shambler', 'Slow, weak, endless. It is the count that kills you.'],
      ['Sprinter', 'Fresh turns still run. Deal with these first.'],
      ['Bloater', 'Hangs back and spits bile. Close the distance or drop it.'],
      ['Butcher', 'Two hundred pounds of nothing left. Do not let it corner you.'],
      ['Burster', 'Swells up next to you and goes off. Shove it away or shoot it early.'],
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
        <div style="display:grid; grid-template-columns:repeat(2,1fr); gap:7px;">${callerRows}</div>

        <div class="ll-rule"></div>
        <div class="ll-sub" style="margin:0 0 10px;">What is out there</div>
        <div style="display:grid; grid-template-columns:repeat(2,1fr); gap:7px;">${bestiary}</div>

        <div style="display:flex; gap:10px; margin-top:20px;">
          <button id="btn-close" class="ll-btn">Back To The Shelter</button>
          <button id="btn-wipe" class="ll-btn-ghost" style="white-space:nowrap;">BURN THE RECORDS</button>
        </div>
      </div>
    `);

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
      this.showRecords(onClose);
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
        <button id="btn-abandon" class="ll-btn-ghost" style="width:100%; margin-top:11px;">
          WALK AWAY — KEEP THE SCRAP, LOSE THE RUN
        </button>
      </div>
    `);

    document.getElementById('btn-resume')!.addEventListener('click', () => {
      this.hide();
      onResume();
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
      <div class="ll-panel ll-pinned mn-shell" style="width:520px; text-align:center;">
        <div class="ll-sub" style="margin:0;">${summary.survived ? 'The street is quiet' : summary.cause}</div>
        <div class="ll-title" style="font-size:40px; margin-top:6px; color:${summary.survived ? CSS.paper : CSS.blood};">
          ${summary.survived ? 'YOU MADE IT BACK' : 'YOU DID NOT MAKE IT'}
        </div>
        <div class="ll-sub">Sector ${String(summary.sector).padStart(2, '0')} — ${summary.sectorName}</div>

        <div class="ll-rule"></div>

        <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:9px;">
          <div>
            <div class="ll-sub" style="margin:0;">Put down</div>
            <div style="font-family:var(--stencil); font-size:27px;">${summary.kills}</div>
          </div>
          <div>
            <div class="ll-sub" style="margin:0;">Scrap kept</div>
            <div style="font-family:var(--stencil); font-size:27px; color:var(--amber);">${summary.scrapEarned}</div>
          </div>
          <div>
            <div class="ll-sub" style="margin:0;">Time out</div>
            <div style="font-family:var(--stencil); font-size:27px;">${mins}:${String(secs).padStart(2, '0')}</div>
          </div>
        </div>

        <div style="font-size:12.5px; color:var(--ash); margin-top:18px; line-height:1.6;">
          You carried <b style="color:var(--bone)">${summary.weapon}</b>.
          Everything you salvaged is already on the workbench.
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
