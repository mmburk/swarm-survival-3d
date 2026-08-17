import { injectTheme } from '../theme/Palette';
import { CALLERS, type Caller } from './BoonModal';
import { callerPortrait, callerSigil } from './art/Portraits';

/**
 * Anything this set can deliver. Deliberately narrower than a RadioLog entry:
 * the shelter's lines carry conditions and priorities the set has no business
 * knowing about, and a line keyed over a drop in the street has neither.
 */
export interface SpokenLine {
  caller: Caller;
  /** One paragraph per press. */
  text: string[];
}

/**
 * THE SET IN THE CORNER — where a radio line is actually delivered.
 *
 * It sits along the bottom of the screen rather than taking the whole frame,
 * because the room has to stay visible behind it. The player is standing in
 * their own shelter with their boots still on, listening to a voice come out
 * of a speaker; a fullscreen modal would turn that into a cutscene, which is
 * the one thing this system exists to avoid.
 *
 * Text reveals a character at a time. A click or a key part-way through skips
 * the reveal and shows the paragraph whole, so nobody is ever made to wait for
 * a line they can already read.
 */
export class RadioDialogue {
  private root: HTMLElement;
  private bodyEl: HTMLElement | null = null;
  private cueEl: HTMLElement | null = null;

  private pages: string[] = [];
  private page: number = 0;
  private revealed: number = 0;
  private revealTimer: number | null = null;
  private onDone: (() => void) | null = null;

  /** Milliseconds per character. Slow enough to read at, fast enough to skip. */
  private readonly charDelay: number = 17;

  constructor() {
    injectTheme();
    this.injectStyles();

    this.root = document.createElement('div');
    this.root.id = 'radio-dialogue';
    this.root.style.cssText = `
      position: fixed; left: 0; right: 0; bottom: 0;
      display: none;
      justify-content: center;
      padding: 0 24px 30px;
      z-index: 1150;
      font-family: var(--body);
      pointer-events: none;
    `;
    document.body.appendChild(this.root);
  }

  public get isOpen(): boolean {
    return this.root.style.display !== 'none';
  }

  public show(line: SpokenLine, onDone: () => void): void {
    const c = CALLERS[line.caller];
    this.pages = line.text.slice();
    this.page = 0;
    this.onDone = onDone;

    this.root.innerHTML = `
      <div class="rd-set" style="--voice:${c.color};">
        <div class="rd-portrait">${callerPortrait(line.caller, 132)}</div>
        <div class="rd-body">
          <div class="rd-head">
            ${callerSigil(line.caller, 15, c.color)}
            <div class="rd-name">${c.name}</div>
            <div class="rd-band">${c.band}</div>
          </div>
          <div class="rd-text" id="rd-text"></div>
          <div class="rd-cue" id="rd-cue">▸</div>
        </div>
      </div>
    `;
    this.root.style.display = 'flex';
    this.bodyEl = document.getElementById('rd-text');
    this.cueEl = document.getElementById('rd-cue');

    this.root.querySelector<HTMLElement>('.rd-set')!.addEventListener('click', () => this.advance());
    window.addEventListener('keydown', this.onKey, true);

    this.renderPage();
  }

  /**
   * Swallows the key so a press meant for the dialogue does not also reach the
   * game underneath — space is the interact key, and the player is standing on
   * a station when this opens.
   */
  private onKey = (e: KeyboardEvent): void => {
    if (!this.isOpen) return;
    if (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyE' || e.code === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      if (e.code === 'Escape') this.finish();
      else this.advance();
    }
  };

  private renderPage(): void {
    const text = this.pages[this.page] ?? '';
    this.revealed = 0;
    if (this.cueEl) this.cueEl.style.opacity = '0';
    if (this.bodyEl) this.bodyEl.textContent = '';

    this.stopReveal();
    this.revealTimer = window.setInterval(() => {
      this.revealed++;
      if (this.bodyEl) this.bodyEl.textContent = text.slice(0, this.revealed);
      if (this.revealed >= text.length) this.completeReveal();
    }, this.charDelay);
  }

  private completeReveal(): void {
    this.stopReveal();
    this.revealed = (this.pages[this.page] ?? '').length;
    if (this.bodyEl) this.bodyEl.textContent = this.pages[this.page] ?? '';
    if (this.cueEl) {
      this.cueEl.textContent = this.page >= this.pages.length - 1 ? '■' : '▸';
      this.cueEl.style.opacity = '1';
    }
  }

  private stopReveal(): void {
    if (this.revealTimer !== null) {
      clearInterval(this.revealTimer);
      this.revealTimer = null;
    }
  }

  /** Mid-reveal, finish the paragraph. Otherwise move on. */
  private advance(): void {
    if (this.revealTimer !== null) {
      this.completeReveal();
      return;
    }
    if (this.page >= this.pages.length - 1) {
      this.finish();
      return;
    }
    this.page++;
    this.renderPage();
  }

  private finish(): void {
    this.stopReveal();
    window.removeEventListener('keydown', this.onKey, true);
    this.root.style.display = 'none';
    this.root.innerHTML = '';
    this.bodyEl = null;
    this.cueEl = null;

    const done = this.onDone;
    this.onDone = null;
    done?.();
  }

  private injectStyles(): void {
    if (document.getElementById('rd-styles')) return;
    const style = document.createElement('style');
    style.id = 'rd-styles';
    style.textContent = `
      .rd-set {
        pointer-events: auto;
        cursor: pointer;
        display: flex;
        align-items: stretch;
        gap: 0;
        width: 880px;
        max-width: 96vw;
        background: rgba(13, 14, 11, 0.93);
        border: 1px solid var(--char);
        /* The voice's colour, as a strip of tape along the bottom edge. */
        border-bottom: 3px solid var(--voice);
        box-shadow: 0 18px 44px rgba(0, 0, 0, 0.6);
        animation: rd-in 220ms ease-out;
      }
      @keyframes rd-in {
        from { opacity: 0; transform: translateY(14px); }
        to   { opacity: 1; transform: translateY(0); }
      }

      .rd-portrait {
        flex: 0 0 auto;
        align-self: flex-end;
        /* No divider: the portrait is a cut-out figure standing on the panel,
           and a rule down its side would be drawn through open air. */
        line-height: 0;
        margin-left: 6px;
      }

      .rd-body {
        flex: 1;
        min-width: 0;
        padding: 15px 20px 14px;
        display: flex;
        flex-direction: column;
      }

      .rd-head {
        display: flex;
        align-items: center;
        gap: 8px;
        padding-bottom: 9px;
        border-bottom: 1px solid var(--char);
      }
      .rd-name {
        font-family: var(--stencil);
        font-size: 15px;
        letter-spacing: 2px;
        text-transform: uppercase;
        color: var(--voice);
      }
      .rd-band {
        margin-left: auto;
        font-size: 11px;
        letter-spacing: 1.5px;
        color: var(--ash);
        white-space: nowrap;
      }

      .rd-text {
        flex: 1;
        margin-top: 11px;
        font-size: 15px;
        line-height: 1.62;
        color: var(--bone);
        /* Two paragraphs of forty words fit without the box changing height
           between pages, which would make the whole panel jump as it reads. */
        min-height: 78px;
      }

      .rd-cue {
        align-self: flex-end;
        font-size: 13px;
        color: var(--voice);
        opacity: 0;
        transition: opacity 160ms ease-out;
        animation: rd-blink 1.1s steps(2, start) infinite;
      }
      @keyframes rd-blink { 50% { opacity: 0.25; } }

      @media (max-width: 720px) {
        .rd-portrait { display: none; }
        .rd-text { min-height: 96px; font-size: 14px; }
      }
    `;
    document.head.appendChild(style);
  }
}
