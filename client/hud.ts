import Phaser from 'phaser';
import { MAX_SWING_SPEED, RUN_SPEED } from '../shared/movement';

/** A compact speed gauge in the same warm metal finish as the factory. */
export function createSpeedometer(scene: Phaser.Scene, x: number, y: number): {
  container: Phaser.GameObjects.Container; update: (horizontalSpeed: number) => void;
} {
  const container = scene.add.container(x, y).setScrollFactor(0);
  const face = scene.add.graphics();
  const needle = scene.add.graphics();
  const value = scene.add.text(0, 24, '0', {
    fontFamily: 'monospace', fontSize: '11px', fontStyle: 'bold', color: '#ffe2ae', resolution: 2,
  }).setOrigin(.5);
  const label = scene.add.text(0, 35, 'TEMPO', {
    fontFamily: 'Arial, sans-serif', fontSize: '8px', fontStyle: 'bold', color: '#d5ad84', resolution: 2,
  }).setOrigin(.5);
  container.add([face, needle, value, label]);
  face.fillStyle(0x201713, .94); face.fillCircle(0, 0, 47);
  face.lineStyle(3, 0x805338, 1); face.strokeCircle(0, 0, 45);
  face.lineStyle(1, 0xe6bb80, .85); face.strokeCircle(0, 0, 42);
  const start = Math.PI * .75, sweep = Math.PI * 1.5;
  for (let i = 0; i <= 12; i++) {
    const a = start + sweep * i / 12, major = i % 3 === 0;
    face.lineStyle(major ? 2 : 1, i >= 9 ? 0xe99354 : 0xd6b18b, .9);
    face.lineBetween(Math.cos(a) * (major ? 30 : 33), Math.sin(a) * (major ? 30 : 33), Math.cos(a) * 38, Math.sin(a) * 38);
  }
  // The baseline marker shows the former maximum speed without implying km/h.
  const baseline = start + sweep * RUN_SPEED / MAX_SWING_SPEED;
  face.fillStyle(0xffd36b, 1); face.fillCircle(Math.cos(baseline) * 26, Math.sin(baseline) * 26, 2);
  const update = (horizontalSpeed: number) => {
    const speed = Math.abs(horizontalSpeed), ratio = Math.min(1, speed / MAX_SWING_SPEED);
    const angle = start + sweep * ratio;
    needle.clear();
    needle.lineStyle(3, 0xe4a15f, 1); needle.lineBetween(0, 0, Math.cos(angle) * 28, Math.sin(angle) * 28);
    needle.fillStyle(0xffe0a3, 1); needle.fillCircle(0, 0, 4);
    needle.fillStyle(0x65402e, 1); needle.fillCircle(0, 0, 1.5);
    value.setText(String(Math.round(speed)));
  };
  update(0);
  return { container, update };
}

/** Fixed, compact control hints made from keycap glyphs and labels. */
export function createControlHints(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Container {
  const container = scene.add.container(x, y);
  const items: Array<{ key: string; label: string; width: number }> = [
    { key: 'A D / ← →', label: 'LAUFEN', width: 78 },
    { key: 'SPACE', label: 'SPRINGEN', width: 58 },
    { key: 'SHIFT', label: 'RUTSCHEN / LÖSEN', width: 54 },
    { key: 'R', label: 'NEUSTART', width: 25 },
  ];
  let cursor = 0;
  const total = items.reduce((sum, item) => sum + item.width + item.label.length * 6.5 + 27, 0);
  cursor = -total / 2;
  for (const item of items) {
    const key = scene.add.graphics();
    key.fillStyle(0x110e0e, .9); key.fillRoundedRect(cursor, -12, item.width, 24, 5);
    key.lineStyle(1, 0xe8c899, .7); key.strokeRoundedRect(cursor, -12, item.width, 24, 5);
    container.add(key);
    container.add(scene.add.text(cursor + item.width / 2, 0, item.key, {
      fontFamily: 'Arial, sans-serif', fontSize: '10px', fontStyle: 'bold', color: '#fff4df', resolution: 2,
    }).setOrigin(.5));
    cursor += item.width + 7;
    container.add(scene.add.text(cursor, 0, item.label, {
      fontFamily: 'Arial, sans-serif', fontSize: '10px', fontStyle: 'bold', color: '#f3dfc3', resolution: 2,
    }).setOrigin(0, .5));
    cursor += item.label.length * 6.5 + 20;
  }
  return container;
}
