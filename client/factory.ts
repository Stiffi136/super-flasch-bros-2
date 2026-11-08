import Phaser from 'phaser';
import type { Level, Platform } from '../shared/game';

/** Draw the bottling-factory environment in world coordinates. Call after clear(), before the player. */
export function drawFactoryEnvironment(
  g: Phaser.GameObjects.Graphics,
  level: Level,
  camera: Phaser.Cameras.Scene2D.Camera,
): void {
  const view = camera.worldView;
  const left = view.x - 90;
  const right = view.right + 90;
  const top = view.y - 80;
  const bottom = view.bottom + 90;

  // Dim, warm factory hall. Foreground edges stay brighter than the background.
  g.fillStyle(0x191210, 1); g.fillRect(left, top, right - left, bottom - top);
  g.fillStyle(0x30211d, 1); g.fillRect(left, 0, right - left, 430);
  g.fillStyle(0x56392c, .38); g.fillRect(left, 0, right - left, 5);

  // Far pipework: position shifts at a lower rate than the foreground.
  const parallax = camera.scrollX * .18;
  const farStart = Math.floor((left + parallax) / 420) - 1;
  const farEnd = Math.floor((right + parallax) / 420) + 1;
  for (let i = farStart; i <= farEnd; i++) {
    const x = i * 420 - parallax;
    g.fillStyle(0x394750, .52); g.fillRect(x + 22, 96, 3, 260);
    g.fillRect(x + 22, 96, 130, 3); g.fillRect(x + 149, 96, 3, 72);
    g.fillStyle(0x68737a, .38); g.fillCircle(x + 22, 96, 5); g.fillCircle(x + 149, 168, 5);
    // Distant factory windows.
    g.fillStyle(0xb58b52, .08); g.fillRoundedRect(x + 195, 70, 174, 102, 8);
    g.lineStyle(3, 0x53616a, .38); g.strokeRoundedRect(x + 195, 70, 174, 102, 8);
    g.lineStyle(2, 0x53616a, .32); g.lineBetween(x + 282, 74, x + 282, 168); g.lineBetween(x + 199, 121, x + 365, 121);
  }

  // Midground steel bays, tanks and windows. A stable integer hash keeps decoration
  // identical for a given level and independent of render rate or camera history.
  const firstBay = Math.floor(left / 360) - 1;
  const lastBay = Math.floor(right / 360) + 1;
  for (let i = firstBay; i <= lastBay; i++) {
    const x = i * 360;
    const variant = hash(i + (level.seed >>> 0));
    g.fillStyle(variant % 2 ? 0x25343d : 0x202f38, .88); g.fillRect(x + 8, 184, 336, 235);
    g.fillStyle(0x3b4b53, .72); g.fillRect(x + 8, 184, 5, 235); g.fillRect(x + 339, 184, 5, 235);
    // Dim amber panels and riveted vertical supports.
    g.fillStyle(0xc99b5b, .08); g.fillRoundedRect(x + 34, 210, 82, 58, 5);
    g.lineStyle(2, 0x59666c, .65); g.strokeRoundedRect(x + 34, 210, 82, 58, 5);
    g.lineStyle(2, 0x46545b, .72); g.lineBetween(x + 76, 213, x + 76, 265);
    g.fillStyle(0x899196, .56);
    for (let r = 0; r < 3; r++) { g.fillCircle(x + 18, 197 + r * 105, 2); g.fillCircle(x + 334, 197 + r * 105, 2); }

    // Stainless tanks sit behind platforms, with a clear dome and gauge.
    if (variant % 3 !== 0) {
      const tx = x + 143 + (variant % 2) * 26, ty = 264 + (variant % 3) * 15;
      g.fillStyle(0x34434a, .94); g.fillRoundedRect(tx, ty, 126, 154, 21);
      g.fillStyle(0x56646a, .62); g.fillRect(tx + 10, ty + 20, 7, 112);
      g.fillStyle(0x26343b, .96); g.fillRoundedRect(tx - 5, ty + 15, 136, 12, 5); g.fillRoundedRect(tx - 5, ty + 126, 136, 12, 5);
      g.lineStyle(2, 0x718087, .66); g.strokeRoundedRect(tx, ty, 126, 154, 21);
      g.fillStyle(0xc99b5b, .12); g.fillRect(tx + 24, ty + 58, 78, 26);
      g.lineStyle(3, 0x56646a, .72); g.lineBetween(tx + 63, ty - 24, tx + 63, ty);
      g.fillStyle(0x182329, 1); g.fillCircle(tx + 63, ty - 27, 13); g.lineStyle(2, 0x718087, .72); g.strokeCircle(tx + 63, ty - 27, 11);
      g.lineStyle(2, 0xc99b5b, .82); g.lineBetween(tx + 63, ty - 27, tx + 69, ty - 32);
    }

    // Overhead pipe run, with elbows and supports.
    const py = 315 + (variant % 2) * 34;
    g.lineStyle(11, 0x18242b, .98); g.lineBetween(x + 12, py, x + 344, py);
    g.lineStyle(5, 0x65747b, .76); g.lineBetween(x + 12, py - 2, x + 344, py - 2);
    g.lineStyle(7, 0x26343b, .98); g.lineBetween(x + 82, py, x + 82, py + 55);
    g.lineStyle(3, 0x65747b, .7); g.lineBetween(x + 82, py + 2, x + 82, py + 52);
    for (const bx of [x + 42, x + 192, x + 320]) {
      g.fillStyle(0x7e7665, .72); g.fillRoundedRect(bx - 7, py - 7, 14, 14, 3);
      g.fillStyle(0x26343b, .95); g.fillRect(bx - 2, py - 6, 4, 12);
    }
  }

  // Deep blue-grey floor band and faint safety stripes keep the lower boundary subdued.
  g.fillStyle(0x172128, .94); g.fillRect(left, 590, right - left, 130);
  g.fillStyle(0xb58b52, .2);
  for (let x = Math.floor(left / 46) * 46; x < right; x += 46) g.fillRect(x, 588, 22, 4);

  // Draw only level pieces in or near the camera. Platform geometry remains unchanged.
  for (const p of level.platforms) {
    if (p.x + p.w < left || p.x > right || p.y + p.h < top || p.y > bottom) continue;
    drawPlatform(g, p);
  }
}

function drawPlatform(g: Phaser.GameObjects.Graphics, p: Platform): void {
  if (p.kind === 'solid') {
    // Rusted iron body with a warm, light rim on all collidable edges.
    g.fillStyle(0x30231f, 1); g.fillRect(p.x, p.y, p.w, p.h);
    g.fillStyle(0x694333, 1); g.fillRect(p.x + 3, p.y + 3, Math.max(0, p.w - 6), Math.max(0, p.h - 6));
    g.fillStyle(0x8b573d, .7); g.fillRect(p.x + 5, p.y + 6, Math.max(0, p.w - 10), Math.max(0, p.h - 12));
    g.fillStyle(0xb27c58, .72);
    const visibleLeft = g.scene.cameras.main.worldView.x - 100, visibleRight = g.scene.cameras.main.worldView.right + 100;
    for (let x = p.x + 15 + Math.max(0, Math.ceil((visibleLeft - (p.x + 15)) / 46)) * 46; x < Math.min(p.x + p.w - 8, visibleRight); x += 46) {
      g.fillRect(x, p.y + 12, 2, Math.max(0, p.h - 22));
      g.fillCircle(x + 7, p.y + 12, 2);
    }
    if (p.h >= 90) {
      g.lineStyle(2, 0x76503d, .82);
      for (let x = p.x + 22 + Math.max(0, Math.ceil((visibleLeft - (p.x + 22)) / 64)) * 64; x + 28 < Math.min(p.x + p.w, visibleRight + 64); x += 64) {
        g.lineBetween(x, p.y + p.h - 2, x + 28, p.y + Math.max(12, p.h - 21));
        g.lineBetween(x + 28, p.y + Math.max(12, p.h - 21), x + 56, p.y + p.h - 2);
      }
    }
    // Dark separation and a brass highlight make walls and ceilings readable too.
    g.lineStyle(4, 0x241711, 1); g.strokeRect(p.x + 2, p.y + 2, Math.max(0, p.w - 4), Math.max(0, p.h - 4));
    g.lineStyle(2, 0xd9a16b, 1); g.strokeRect(p.x + 1, p.y + 1, Math.max(0, p.w - 2), Math.max(0, p.h - 2));
  } else if (p.kind === 'grip') {
    // Restrained cool grip rail contrasts with the warm ironwork. Grip collision is still controlled by game.ts.
    g.fillStyle(0x598f83, .98); g.fillRoundedRect(p.x, p.y, p.w, p.h, 4);
    g.fillStyle(0xb4d2b5, .95); g.fillRect(p.x + 2, p.y + 2, Math.max(0, p.w - 4), 3);
    g.fillStyle(0x355e56, .98);
    const left = g.scene.cameras.main.worldView.x - 100, right = g.scene.cameras.main.worldView.right + 100;
    for (let x = p.x + 8 + Math.max(0, Math.ceil((left - (p.x + 8)) / 18)) * 18; x < Math.min(p.x + p.w - 4, right); x += 18) g.fillRect(x, p.y + Math.max(4, p.h - 5), 9, 2);
    g.fillStyle(0xb4d2b5, .9); g.fillCircle(p.x + 5, p.y + p.h / 2, 2);
    g.fillCircle(p.x + p.w - 5, p.y + p.h / 2, 2);
  } else if (p.kind === 'hazard') {
    // Amber teeth stand against a transparent background. The rectangular
    // collision trigger still covers the whole spike strip, including gaps.
    // Divide the whole strip evenly so the final tooth is never clipped.
    const toothCount = Math.max(1, Math.round(p.w / 12));
    const toothWidth = p.w / toothCount;
    for (let i = 0; i < toothCount; i++) {
      const x = p.x + i * toothWidth;
      const end = p.x + (i + 1) * toothWidth;
      const mid = (x + end) / 2;
      g.fillStyle(0xffc247, 1);
      g.fillTriangle(x, p.y + p.h, mid, p.y, end, p.y + p.h);
      // A narrow dark facet gives each warning tooth a forged-metal edge.
      g.fillStyle(0x9e3828, .9);
      g.fillTriangle(mid, p.y + 2, Math.min(mid + 2, end), p.y + p.h - 1, mid, p.y + p.h - 1);
    }
    // Inset warning stripe and border never extend beyond the trigger bounds.
    g.fillStyle(0x5a2d20, 1); g.fillRect(p.x, p.y + p.h - 3, p.w, 3);
    g.fillStyle(0xffd46a, 1); g.fillRect(p.x + 1, p.y + p.h - 2, Math.max(0, p.w - 2), 1);
  } else if (p.kind === 'checkpoint') {
    // The marker rests on the floor at the bottom of the invisible trigger.
    const floor = p.y + p.h;
    g.fillStyle(0xffd36b, 1); g.fillRect(p.x + 11, floor - 45, 4, 43);
    g.fillStyle(0xffd36b, .98); g.fillTriangle(p.x + 15, floor - 44, p.x + 43, floor - 34, p.x + 15, floor - 24);
    g.fillStyle(0xfff2bd, 1); g.fillCircle(p.x + 13, floor - 46, 4);
    g.fillStyle(0xffd36b, .95); g.fillRoundedRect(p.x + 2, floor - 13, 48, 11, 3);
    g.fillStyle(0x3c2922, 1); g.fillRect(p.x + 8, floor - 10, 4, 3); g.fillRect(p.x + 17, floor - 10, 4, 3); g.fillRect(p.x + 26, floor - 10, 4, 3);
  } else if (p.kind === 'goal') {
    g.fillStyle(0xffd05c, 1); g.fillRoundedRect(p.x, p.y, p.w, p.h, 8);
    g.fillStyle(0x9f5d32, 1); g.fillRoundedRect(p.x + 6, p.y + 8, p.w - 12, p.h - 12, 5);
    g.fillStyle(0xfff0b0, .95); g.fillRoundedRect(p.x + 12, p.y + 12, p.w - 24, 5, 2);
    g.fillStyle(0xc78b43, 1); g.fillCircle(p.x + p.w / 2, p.y + 27, 7);
    g.fillStyle(0xffe5ad, 1); g.fillCircle(p.x + p.w / 2 - 2, p.y + 25, 2);
    g.fillStyle(0xffd05c, 1); g.fillTriangle(p.x + p.w / 2 - 7, p.y - 8, p.x + p.w / 2 + 7, p.y - 8, p.x + p.w / 2, p.y - 18);
  }
}

function hash(n: number): number {
  let x = n | 0;
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  return (x ^ (x >>> 16)) >>> 0;
}
