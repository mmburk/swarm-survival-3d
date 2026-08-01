import { injectTheme, CSS } from '../theme/Palette';
import type { Player } from '../entities/Player';

export interface RunSheet {
  sector: number;
  sectorName: string;
  kills: number;
  score: number;
  scrapEarned: number;
  nightName: string;
}

/**
 * The run sheet (TAB): a folded page in the player's pocket listing what they
 * are carrying, who has been on the radio, and how the numbers stand.
 */
export class CodexModal {
  private root: HTMLElement;
  private visible: boolean = false;
  private onClose: (() => void) | null = null;

  constructor() {
    injectTheme();

    this.root = document.createElement('div');
    this.root.id = 'run-sheet';
    this.root.style.cssText = `
      position: fixed; inset: 0;
      background: rgba(8, 9, 6, 0.88);
      display: none;
      justify-content: center;
      align-items: center;
      z-index: 1200;
      font-family: var(--body);
      color: var(--bone);
      user-select: none;
    `;
    document.body.appendChild(this.root);
  }

  public show(player: Player, sheet: RunSheet, onClose: () => void): void {
    this.onClose = onClose;
    const buffs = player.getActiveBuffList();

    const stat = (label: string, value: string) => `
      <div style="padding:10px 12px; background:rgba(0,0,0,0.25); border:1px solid var(--char);">
        <div class="ll-sub" style="margin:0;">${label}</div>
        <div style="font-family:var(--stencil); font-size:21px; color:var(--paper); margin-top:2px;">${value}</div>
      </div>
    `;

    const pct = (v: number) => `${Math.round(v * 100)}%`;

    this.root.innerHTML = `
      <div class="ll-panel ll-pinned ll-scroll" style="width:820px; max-width:94vw; max-height:90vh; overflow-y:auto; padding:28px 32px;">
        <div style="display:flex; justify-content:space-between; align-items:flex-end; border-bottom:1px solid var(--char); padding-bottom:13px;">
          <div>
            <div class="ll-sub" style="margin:0;">Sector ${String(sheet.sector).padStart(2, '0')} — ${sheet.sectorName} · ${sheet.nightName}</div>
            <div class="ll-title" style="font-size:30px; margin-top:4px;">Run Sheet</div>
          </div>
          <div id="sheet-close" class="ll-btn-ghost" style="cursor:pointer;">CLOSE · TAB</div>
        </div>

        <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:9px; margin-top:18px;">
          ${stat('Put down', String(sheet.kills))}
          ${stat('Score', String(sheet.score))}
          ${stat('Scrap this run', String(sheet.scrapEarned))}
          ${stat('Get-ups left', `${player.getUpsRemaining} / ${player.maxGetUps}`)}
        </div>

        <div class="ll-rule"></div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:22px;">
          <div>
            <div class="ll-sub" style="margin:0 0 10px;">Carrying</div>
            <div style="padding:14px 16px; background:rgba(0,0,0,0.25); border:1px solid var(--char); border-left:3px solid ${CSS.rust};">
              <div style="font-family:var(--stencil); font-size:21px; letter-spacing:2px; color:var(--paper);">
                ${player.weaponDef.name.toUpperCase()}
              </div>
              <div style="font-size:12px; color:var(--ash); margin-top:2px;">
                ${player.weaponDef.model}${player.weaponModActive ? ` · ${player.weaponDef.mod.name}` : ''}
              </div>
              <div style="display:flex; gap:7px; flex-wrap:wrap; margin-top:11px;">
                <div class="ll-tag">${player.weapon.damage} dmg${player.weapon.pellets > 1 ? ` ×${player.weapon.pellets}` : ''}</div>
                <div class="ll-tag">${(1 / player.weapon.cooldown).toFixed(1)}/s</div>
                <div class="ll-tag">pierce ${player.weapon.pierce + player.bonusPierce}</div>
              </div>
            </div>

            <div class="ll-sub" style="margin:18px 0 10px;">Condition</div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:7px; font-size:12.5px;">
              <div class="ll-tag">Damage ${pct(player.damageMultiplier)}</div>
              <div class="ll-tag">Cadence ${pct(2 - player.fireRateMultiplier)}</div>
              <div class="ll-tag">Clean hit ${pct(player.critChance)}</div>
              <div class="ll-tag">Clean mult ${player.critMultiplier.toFixed(1)}×</div>
              <div class="ll-tag">Toughness ${pct(player.toughness)}</div>
              <div class="ll-tag">Speed ${player.moveSpeed.toFixed(1)}</div>
              <div class="ll-tag">Salvage ${player.pickupRadius.toFixed(1)}m</div>
              <div class="ll-tag">Rupture ${pct(player.burstChance)}</div>
            </div>
          </div>

          <div>
            <div class="ll-sub" style="margin:0 0 10px;">Who has been on the radio</div>
            ${
              buffs.length === 0
                ? `<div style="font-size:13px; color:var(--ash); font-style:italic; padding:18px 0;">
                     Nobody yet. Clear a sector and take a signal at the gate.
                   </div>`
                : `<div style="display:flex; flex-direction:column; gap:8px;">
                    ${buffs.map((b) => `
                      <div style="display:flex; align-items:center; gap:13px; padding:11px 14px;
                                  background:rgba(0,0,0,0.25); border:1px solid var(--char); border-left:3px solid ${b.color};">
                        <div style="width:38px; height:38px; display:grid; place-content:center;
                                    border:1px solid ${b.color}; color:${b.color};
                                    font-family:var(--stencil); font-size:19px;">${b.icon}</div>
                        <div>
                          <div style="font-family:var(--stencil); font-size:16px; letter-spacing:1.6px; color:${b.color};">${b.name}</div>
                          <div style="font-size:11.5px; color:var(--ash); margin-top:1px;">${b.count} offer${b.count === 1 ? '' : 's'} taken</div>
                        </div>
                      </div>
                    `).join('')}
                   </div>`
            }
          </div>
        </div>
      </div>
    `;

    document.getElementById('sheet-close')!.addEventListener('click', () => this.hide());

    this.root.style.display = 'flex';
    this.visible = true;
  }

  public hide(): void {
    this.root.style.display = 'none';
    this.visible = false;
    this.onClose?.();
  }

  public get isOpen(): boolean {
    return this.visible;
  }
}
