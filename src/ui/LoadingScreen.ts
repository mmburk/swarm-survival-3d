import { injectTheme } from '../theme/Palette';

/**
 * The short black between places. Doubles as the game's tip screen — the
 * lines are written the way somebody who has survived a while would say them.
 */
export class LoadingScreen {
  private root: HTMLElement;
  private bar: HTMLElement;
  private label: HTMLElement;
  private tip: HTMLElement;
  private timer: number | null = null;

  private tips: string[] = [
    'A roll (SPACE) gives you a moment where nothing can touch you. Use it through a crowd, not away from one.',
    'Shove (F) throws whatever is in front of you back and stuns it. It is the answer to a Burster.',
    'Reload (R) between fights, not during one. An empty gun feeds itself, but it picks the worst moment to do it.',
    'They come at you in turns. The ones hanging back are not waiting politely — they are waiting for a gap.',
    'A Screamer stands further out than anything else and takes a second to fill its lungs. That second is the whole of your answer to it.',
    'A Clinger commits to its lunge. Roll and it goes past you; stand still and it does not.',
    'Some of them come out wrong, and they all come out the same cold colour. What kind of wrong it is, you find out. The pin board keeps a list.',
    'A vest only covers the front of a man. Whatever it is facing is the side you cannot get through.',
    'Whatever came out of the pens will take a Clinger off you. It is the one thing down there the gun cannot do.',
    'The street remembers gunfire. Empty a magazine into nothing and something out there will come and say so.',
    'The flare (Q) pulls the whole street toward it before it goes off. Throw it away from you, not at your feet.',
    'Bursters swell before they blow. Shoot them at range or shove them off — never stand still next to one.',
    'Scrap stays with you when you die. A bad run still pays for the workbench.',
    'One gun per run. Pick it at the rack before you go up the stairs.',
    'Take from the same voice on the radio twice and the run starts to have a shape.',
    'The chained crate is optional. If the timer beats you, you have only made the street louder.',
    'Vic under the underpass takes scrap, not questions. Spend it — you cannot bank a run you do not finish.',
    'The radio set decides how bad tonight is. Higher nights pay considerably more.',
    'Rook does not follow you up the stairs. He will be there when you get back.'
  ];

  constructor() {
    injectTheme();

    this.root = document.createElement('div');
    this.root.id = 'loading';
    this.root.style.cssText = `
      position: fixed; inset: 0;
      background: radial-gradient(circle at 50% 45%, #191a13 0%, #080906 75%);
      display: none;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      z-index: 2000;
      font-family: var(--body);
      color: var(--bone);
      user-select: none;
    `;

    this.root.innerHTML = `
      <div style="text-align:center; max-width:560px; padding:0 24px;">
        <div id="load-label" class="ll-sub" style="margin:0;">MOVING</div>
        <div class="ll-title" style="font-size:44px; margin-top:8px;">LAST LIGHT</div>

        <div style="width:340px; max-width:80vw; height:4px; background:rgba(255,255,255,0.07);
                    margin:26px auto 0; border:1px solid var(--char);">
          <div id="load-bar" style="height:100%; width:0%; background:linear-gradient(90deg,#8a4a22,#d9a441);
                                    transition:width 0.12s linear;"></div>
        </div>

        <div id="load-tip" style="font-size:13px; line-height:1.7; color:var(--ash);
                                  margin-top:30px; font-style:italic;"></div>
      </div>
    `;

    document.body.appendChild(this.root);
    this.bar = document.getElementById('load-bar')!;
    this.label = document.getElementById('load-label')!;
    this.tip = document.getElementById('load-tip')!;
  }

  public show(title: string, onComplete: () => void, durationMs: number = 700): void {
    // Guard against a second transition starting mid-fade and stranding the
    // first one's callback.
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }

    this.tip.textContent = this.tips[Math.floor(Math.random() * this.tips.length)];
    this.label.textContent = title.toUpperCase();
    this.bar.style.width = '0%';
    this.root.style.display = 'flex';

    const start = performance.now();
    this.timer = window.setInterval(() => {
      const progress = Math.min(100, ((performance.now() - start) / durationMs) * 100);
      this.bar.style.width = `${progress}%`;

      if (progress >= 100) {
        if (this.timer !== null) clearInterval(this.timer);
        this.timer = null;
        setTimeout(() => {
          this.root.style.display = 'none';
          onComplete();
        }, 110);
      }
    }, 30);
  }
}
