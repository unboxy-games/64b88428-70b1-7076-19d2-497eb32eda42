import { createUnboxyGame, Unboxy } from '@unboxy/phaser-sdk';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { UIScene } from './scenes/UIScene';
import { GAME_WIDTH, GAME_HEIGHT } from './config';

export const unboxyReady = Unboxy.init({ standaloneGameId: 'snake' }).catch(() => null);

createUnboxyGame({
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#0a1a10',
  scenes: [BootScene, GameScene, UIScene],
});
