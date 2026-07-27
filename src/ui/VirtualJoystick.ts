export class VirtualJoystick {
  private container: HTMLElement;
  private stick: HTMLElement;
  public moveVector: { x: number; y: number } = { x: 0, y: 0 };
  public active: boolean = false;

  private touchId: number | null = null;
  private originX: number = 0;
  private originY: number = 0;
  private maxRadius: number = 50;

  constructor() {
    this.container = document.createElement('div');
    this.container.id = 'virtual-joystick-base';
    this.container.style.cssText = `
      position: absolute;
      bottom: 40px;
      left: 40px;
      width: 100px;
      height: 100px;
      border-radius: 50%;
      background: rgba(0, 240, 255, 0.15);
      border: 2px solid rgba(0, 240, 255, 0.4);
      box-shadow: 0 0 20px rgba(0, 240, 255, 0.2);
      touch-action: none;
      user-select: none;
      z-index: 15;
      display: none;
    `;

    this.stick = document.createElement('div');
    this.stick.id = 'virtual-joystick-stick';
    this.stick.style.cssText = `
      position: absolute;
      top: 25px;
      left: 25px;
      width: 50px;
      height: 50px;
      border-radius: 50%;
      background: linear-gradient(135deg, #00ffff, #0099ff);
      box-shadow: 0 0 15px #00ffff;
      pointer-events: none;
    `;

    this.container.appendChild(this.stick);
    document.body.appendChild(this.container);

    this.bindEvents();
  }

  private bindEvents(): void {
    const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    if (isTouchDevice) {
      this.container.style.display = 'block';
    }

    window.addEventListener('touchstart', (e) => {
      if (this.touchId !== null) return;
      const touch = e.changedTouches[0];
      if (touch.clientX < window.innerWidth * 0.5) { // Left half touch triggers joystick
        this.touchId = touch.identifier;
        this.active = true;
        this.originX = touch.clientX;
        this.originY = touch.clientY;
        this.container.style.left = `${this.originX - 50}px`;
        this.container.style.top = `${this.originY - 50}px`;
        this.container.style.display = 'block';
      }
    });

    window.addEventListener('touchmove', (e) => {
      if (this.touchId === null) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === this.touchId) {
          const dx = touch.clientX - this.originX;
          const dy = touch.clientY - this.originY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const angle = Math.atan2(dy, dx);
          const clampedDist = Math.min(dist, this.maxRadius);

          const stickX = Math.cos(angle) * clampedDist;
          const stickY = Math.sin(angle) * clampedDist;

          this.stick.style.transform = `translate(${stickX}px, ${stickY}px)`;
          this.moveVector.x = stickX / this.maxRadius;
          this.moveVector.y = stickY / this.maxRadius;
        }
      }
    });

    const endTouch = (e: TouchEvent) => {
      if (this.touchId === null) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === this.touchId) {
          this.touchId = null;
          this.active = false;
          this.moveVector.x = 0;
          this.moveVector.y = 0;
          this.stick.style.transform = 'translate(0px, 0px)';
        }
      }
    };

    window.addEventListener('touchend', endTouch);
    window.addEventListener('touchcancel', endTouch);
  }
}
