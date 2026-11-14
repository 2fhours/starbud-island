export class Input {
  keys = new Set<string>();
  joyX = 0;
  joyY = 0;
  dpad = { up: false, down: false, left: false, right: false };
  interactQueued = false;
  menuQueued = false;

  axis(): { x: number; y: number } {
    let x = 0;
    let y = 0;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft') || this.dpad.left) x -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight') || this.dpad.right) x += 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp') || this.dpad.up) y -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown') || this.dpad.down) y += 1;
    const joy = Math.hypot(this.joyX, this.joyY);
    if (joy > 0.18) {
      x = this.joyX;
      y = this.joyY;
    }
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    return { x, y };
  }

  consumeInteract(): boolean {
    const queued = this.interactQueued;
    this.interactQueued = false;
    return queued;
  }

  consumeMenu(): boolean {
    const queued = this.menuQueued;
    this.menuQueued = false;
    return queued;
  }
}
