import Phaser from 'phaser';
import { GameScene } from './scene';

export type GameOptions = { bottleIndex?: number; seed?: number; startImmediately?: boolean };
export type MountedGame = {
  game: Phaser.Game;
  scene: GameScene;
  /** Start a fresh run. Omitted seed means a new random seed. */
  restart(options?: { bottleIndex?: number; seed?: number }): void;
  /** Destroy the Phaser instance and remove its canvas and listeners. */
  destroy(): void;
};

/** Mount into a DOM element or element id. No network or server is used. */
export function mountGame(parent: HTMLElement | string, options: GameOptions = {}): MountedGame {
  const scene = new GameScene();
  // Render at 2× the logical resolution, then fit the canvas to its container.
  // The scene camera maps the 960×600 world view back onto these device pixels.
  const renderScale = 2;
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#101b2c',
    width: 960 * renderScale,
    height: 600 * renderScale,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    render: { antialias: true, pixelArt: false },
    scene: [scene],
    callbacks: {
      postBoot: (instance) => {
        instance.scene.start('game', options);
      },
    },
  });
  return {
    game,
    scene,
    restart: (next = {}) => {
      game.scene.stop('game');
      game.scene.start('game', { ...options, ...next, startImmediately: true });
    },
    destroy: () => game.destroy(true),
  };
}

// The standalone client/index.html opts in. Embedded shells can call mountGame directly.
if (document.body?.dataset.gameAutostart === 'true') {
  const target = document.getElementById('game');
  if (target) mountGame(target);
}
