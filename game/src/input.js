// input.js — keyboard + mouse state, edge-triggered presses. One job: what the player did.
export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.pressed = new Set();
    this.mouse = { x: 0, y: 0, down: false, clicked: false };
    this.anyKey = false;
    this.wheel = 0; // accumulated wheel delta: the 3D camera zooms with it
    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.key.toLowerCase());
      this.keys.add(e.key.toLowerCase());
      this.anyKey = true;
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    canvas.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouse.x = e.clientX - r.left;
      this.mouse.y = e.clientY - r.top;
    });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) { this.mouse.down = true; this.mouse.clicked = true; }
    });
    canvas.addEventListener('wheel', (e) => { e.preventDefault(); this.wheel += e.deltaY; }, { passive: false });
    window.addEventListener('mouseup', (e) => { if (e.button === 0) this.mouse.down = false; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('blur', () => { this.keys.clear(); this.mouse.down = false; });
  }
  down(k) { return this.keys.has(k); }
  hit(k) { return this.pressed.has(k); }
  // edge-triggered press of ANY of the listed keys (e.g. 'l' for the legend,
  // 'c' for the character close-up camera)
  hitAny(...keys) { return keys.some((k) => this.pressed.has(k)); }
  axis() {
    let x = 0, y = 0;
    if (this.down('a') || this.down('arrowleft')) x -= 1;
    if (this.down('d') || this.down('arrowright')) x += 1;
    if (this.down('w') || this.down('arrowup')) y -= 1;
    if (this.down('s') || this.down('arrowdown')) y += 1;
    return { x, y };
  }
  endFrame() { this.pressed.clear(); this.mouse.clicked = false; this.anyKey = false; }
  // consume the wheel delta (the camera zoom in main.js reads it once a frame)
  takeWheel() { const w = this.wheel; this.wheel = 0; return w; }
}
