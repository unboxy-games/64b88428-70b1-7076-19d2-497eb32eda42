import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
import { unboxyReady } from '../main';

// ── Grid constants ──────────────────────────────────────────────────────────
const CELL = 32;
const COLS = 36;
const ROWS = 20;
const GRID_X = (GAME_WIDTH - COLS * CELL) / 2; // 64
const GRID_Y = (GAME_HEIGHT - ROWS * CELL) / 2; // 40

// Speed in ms per step, indexed by level (0–5)
const SPEEDS = [150, 130, 110, 90, 75, 65];

// ── Types ───────────────────────────────────────────────────────────────────
type Point = { x: number; y: number };
type Dir = { x: number; y: number };
type GameState = 'title' | 'playing' | 'dead';

// ── Helpers ─────────────────────────────────────────────────────────────────
function lerpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bv = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bv;
}

// ────────────────────────────────────────────────────────────────────────────
export class GameScene extends Phaser.Scene {
  // Game state
  private state: GameState = 'title';
  private snake: Point[] = [];
  private dir: Dir = { x: 1, y: 0 };
  private dirQueue: Dir[] = [];
  private food: Point = { x: 18, y: 10 };

  // Scores & level
  private score = 0;
  private highScore = 0;
  private level = 0;
  private foodEaten = 0;
  private canRestart = false;

  // Timing
  private moveAccum = 0;

  // Graphics
  private snakeGfx!: Phaser.GameObjects.Graphics;
  private foodGfx!: Phaser.GameObjects.Graphics;
  private foodContainer!: Phaser.GameObjects.Container;
  private foodBobTween?: Phaser.Tweens.Tween;

  // Overlay containers
  private titleContainer!: Phaser.GameObjects.Container;
  private gameOverContainer!: Phaser.GameObjects.Container;
  private finalScoreText!: Phaser.GameObjects.Text;
  private bestText!: Phaser.GameObjects.Text;
  private goRestartText!: Phaser.GameObjects.Text;
  private goRestartTween?: Phaser.Tweens.Tween;

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    // Load high score without blocking
    unboxyReady.then(async (unboxy) => {
      if (!unboxy) return;
      const saved = await unboxy.saves.get<number>('highScore').catch(() => null);
      this.highScore = typeof saved === 'number' && saved > 0 ? saved : 0;
      this.events.emit('scoreUpdate', { score: this.score, highScore: this.highScore });
    });

    // Input
    this.input.keyboard!.on('keydown', this.handleKeydown, this);

    // Draw static background & board
    this.drawBackground();

    // Snake graphics layer
    this.snakeGfx = this.add.graphics().setDepth(3);

    // Food
    this.foodGfx = this.add.graphics();
    this.foodContainer = this.add.container(0, 0, [this.foodGfx]).setDepth(3);
    // Idle pulse — scale only, so setPosition() doesn't fight the tween
    this.foodBobTween = this.tweens.add({
      targets: this.foodContainer,
      scaleX: 1.12, scaleY: 1.12,
      duration: 750,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
    });

    // Overlays
    this.buildTitleScreen();
    this.buildGameOverScreen();

    // Start HUD
    this.scene.launch('UIScene');

    this.showTitle();
  }

  // ── Background ─────────────────────────────────────────────────────────────
  private drawBackground(): void {
    const bg = this.add.graphics().setDepth(0);
    bg.fillGradientStyle(0x071510, 0x071510, 0x0e2318, 0x0e2318, 1);
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    const board = this.add.graphics().setDepth(1);
    // Checkerboard cells
    for (let col = 0; col < COLS; col++) {
      for (let row = 0; row < ROWS; row++) {
        const even = (col + row) % 2 === 0;
        board.fillStyle(even ? 0x0d2819 : 0x0f2d1c, 1);
        board.fillRect(GRID_X + col * CELL, GRID_Y + row * CELL, CELL, CELL);
      }
    }

    // Border glow layers
    board.lineStyle(4, 0x27ae60, 0.9);
    board.strokeRect(GRID_X - 3, GRID_Y - 3, COLS * CELL + 6, ROWS * CELL + 6);
    board.lineStyle(2, 0x2ecc71, 0.35);
    board.strokeRect(GRID_X - 6, GRID_Y - 6, COLS * CELL + 12, ROWS * CELL + 12);
    board.lineStyle(1, 0x2ecc71, 0.12);
    board.strokeRect(GRID_X - 9, GRID_Y - 9, COLS * CELL + 18, ROWS * CELL + 18);
  }

  // ── Snake ──────────────────────────────────────────────────────────────────
  private initSnake(): void {
    this.snake = [{ x: 18, y: 10 }, { x: 17, y: 10 }, { x: 16, y: 10 }];
    this.dir = { x: 1, y: 0 };
    this.dirQueue = [];
    this.score = 0;
    this.level = 0;
    this.foodEaten = 0;
    this.moveAccum = 0;
  }

  private drawSnake(): void {
    this.snakeGfx.clear();
    const len = this.snake.length;

    for (let i = 0; i < len; i++) {
      const { x, y } = this.snake[i];
      const px = GRID_X + x * CELL;
      const py = GRID_Y + y * CELL;
      const t = i / Math.max(len - 1, 1);

      if (i === 0) {
        // Head
        this.snakeGfx.fillStyle(0x2ecc71, 1);
        this.snakeGfx.fillRoundedRect(px + 1, py + 1, CELL - 2, CELL - 2, 7);
        // Sheen
        this.snakeGfx.fillStyle(0x58d68d, 0.6);
        this.snakeGfx.fillRoundedRect(px + 4, py + 4, CELL - 8, (CELL - 8) / 2, 4);

        // Eyes — direction-aware
        const cx = px + CELL / 2;
        const cy = py + CELL / 2;
        const [e1, e2] = this.eyePositions(cx, cy);
        // Outer eye
        this.snakeGfx.fillStyle(0x145a32, 1);
        this.snakeGfx.fillCircle(e1.x, e1.y, 4);
        this.snakeGfx.fillCircle(e2.x, e2.y, 4);
        // Pupil
        this.snakeGfx.fillStyle(0xffffff, 1);
        this.snakeGfx.fillCircle(e1.x + this.dir.x, e1.y + this.dir.y, 2);
        this.snakeGfx.fillCircle(e2.x + this.dir.x, e2.y + this.dir.y, 2);
      } else {
        // Body — gradient from bright to dark
        const color = lerpColor(0x27ae60, 0x0e5c25, t);
        const pad = 2 + Math.floor(t * 2);
        const radius = Math.max(2, 6 - Math.floor(t * 3));
        this.snakeGfx.fillStyle(color, 1);
        this.snakeGfx.fillRoundedRect(px + pad, py + pad, CELL - pad * 2, CELL - pad * 2, radius);
      }
    }
  }

  private eyePositions(cx: number, cy: number): [Point, Point] {
    const d = this.dir;
    if (d.x === 1)  return [{ x: cx + 5, y: cy - 6 }, { x: cx + 5, y: cy + 6 }];
    if (d.x === -1) return [{ x: cx - 5, y: cy - 6 }, { x: cx - 5, y: cy + 6 }];
    if (d.y === -1) return [{ x: cx - 6, y: cy - 5 }, { x: cx + 6, y: cy - 5 }];
    return [{ x: cx - 6, y: cy + 5 }, { x: cx + 6, y: cy + 5 }];
  }

  // ── Food ───────────────────────────────────────────────────────────────────
  private placeFood(): void {
    const occupied = new Set(this.snake.map(p => `${p.x},${p.y}`));
    const empty: Point[] = [];
    for (let x = 0; x < COLS; x++) {
      for (let y = 0; y < ROWS; y++) {
        if (!occupied.has(`${x},${y}`)) empty.push({ x, y });
      }
    }
    if (empty.length === 0) return;
    this.food = empty[Math.floor(Math.random() * empty.length)];
    this.drawFood();

    // Pause bob tween during spawn animation to avoid conflicts
    this.foodBobTween?.pause();
    this.foodContainer.setScale(0);
    this.tweens.add({
      targets: this.foodContainer,
      scaleX: 1, scaleY: 1,
      duration: 280,
      ease: 'Back.easeOut',
      onComplete: () => this.foodBobTween?.resume(),
    });
  }

  private drawFood(): void {
    const cx = GRID_X + this.food.x * CELL + CELL / 2;
    const cy = GRID_Y + this.food.y * CELL + CELL / 2;
    this.foodContainer.setPosition(cx, cy);

    this.foodGfx.clear();
    // Glow ring
    this.foodGfx.fillStyle(0xe74c3c, 0.25);
    this.foodGfx.fillCircle(0, 0, 15);
    // Main body
    this.foodGfx.fillStyle(0xe74c3c, 1);
    this.foodGfx.fillCircle(0, 0, 10);
    // Highlight cap
    this.foodGfx.fillStyle(0xff8080, 1);
    this.foodGfx.fillCircle(-3, -3, 5);
    // Shine
    this.foodGfx.fillStyle(0xffffff, 0.85);
    this.foodGfx.fillCircle(-4, -5, 2.5);
    // Stem dot
    this.foodGfx.fillStyle(0x27ae60, 1);
    this.foodGfx.fillRect(-1, -13, 3, 5);
  }

  // ── Game loop step ─────────────────────────────────────────────────────────
  private step(): void {
    if (this.dirQueue.length > 0) {
      this.dir = this.dirQueue.shift()!;
    }

    const head = this.snake[0];
    const nx = head.x + this.dir.x;
    const ny = head.y + this.dir.y;

    // Wall collision
    if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) { this.die(); return; }

    // Self collision (exclude tail tip which moves away)
    for (let i = 0; i < this.snake.length - 1; i++) {
      if (this.snake[i].x === nx && this.snake[i].y === ny) { this.die(); return; }
    }

    this.snake.unshift({ x: nx, y: ny });

    if (nx === this.food.x && ny === this.food.y) {
      this.eatFood();
    } else {
      this.snake.pop();
    }

    this.drawSnake();
  }

  private eatFood(): void {
    this.foodEaten++;
    const bonus = this.level * 5;
    const pts = 10 + bonus;
    this.score += pts;
    if (this.score > this.highScore) this.highScore = this.score;

    this.events.emit('scoreUpdate', { score: this.score, highScore: this.highScore });

    // Floating score popup
    const px = GRID_X + this.food.x * CELL + CELL / 2;
    const py = GRID_Y + this.food.y * CELL;
    const popup = this.add.text(px, py, `+${pts}`, {
      fontSize: '20px', fontFamily: 'monospace',
      color: '#f1c40f', stroke: '#7d6608', strokeThickness: 2,
    }).setOrigin(0.5, 1).setDepth(10);
    this.tweens.add({
      targets: popup,
      y: py - 45, alpha: 0,
      duration: 900, ease: 'Cubic.easeOut',
      onComplete: () => popup.destroy(),
    });

    // Burst particles
    this.spawnBurst(px, py + CELL / 2, 12, 0xe74c3c, 0xf39c12);

    // Speed up every 5 foods
    if (this.foodEaten % 5 === 0 && this.level < SPEEDS.length - 1) {
      this.level++;
      this.events.emit('levelUp', this.level);
    }

    this.placeFood();
  }

  private die(): void {
    this.state = 'dead';
    this.canRestart = false;
    this.cameras.main.flash(250, 180, 10, 10);

    // Flash snake red
    this.tweens.add({
      targets: this.snakeGfx,
      alpha: 0.2,
      duration: 100,
      yoyo: true,
      repeat: 3,
    });

    this.saveHighScore();

    this.time.delayedCall(700, () => {
      this.showGameOver();
      this.time.delayedCall(800, () => { this.canRestart = true; });
    });
  }

  // ── Burst particles ────────────────────────────────────────────────────────
  private spawnBurst(x: number, y: number, count: number, c1: number, c2: number): void {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.3;
      const dist = Phaser.Math.Between(35, 90);
      const gfx = this.add.graphics().setDepth(6);
      const color = Math.random() < 0.5 ? c1 : c2;
      const r = Phaser.Math.Between(2, 5);
      gfx.fillStyle(color, 1);
      gfx.fillCircle(0, 0, r);
      gfx.setPosition(x, y);
      this.tweens.add({
        targets: gfx,
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist,
        alpha: 0, scaleX: 0, scaleY: 0,
        duration: Phaser.Math.Between(350, 600),
        ease: 'Cubic.easeOut',
        onComplete: () => gfx.destroy(),
      });
    }
  }

  // ── Save ───────────────────────────────────────────────────────────────────
  private async saveHighScore(): Promise<void> {
    const unboxy = await unboxyReady;
    if (!unboxy) return;
    try {
      await unboxy.saves.set('highScore', this.highScore);
    } catch (err) {
      console.warn('[snake] failed to save highScore', err);
    }
  }

  // ── Input ──────────────────────────────────────────────────────────────────
  private handleKeydown(event: KeyboardEvent): void {
    if (this.state === 'title') { this.startGame(); return; }
    if (this.state === 'dead' && this.canRestart) { this.restartGame(); return; }

    if (this.state !== 'playing') return;

    let nd: Dir | null = null;
    switch (event.code) {
      case 'ArrowUp':    case 'KeyW': nd = { x: 0, y: -1 }; break;
      case 'ArrowDown':  case 'KeyS': nd = { x: 0, y: 1 };  break;
      case 'ArrowLeft':  case 'KeyA': nd = { x: -1, y: 0 }; break;
      case 'ArrowRight': case 'KeyD': nd = { x: 1, y: 0 };  break;
    }
    if (!nd) return;

    const last = this.dirQueue.length > 0 ? this.dirQueue[this.dirQueue.length - 1] : this.dir;
    const isReverse = nd.x === -last.x && nd.y === -last.y;
    const isSame = nd.x === last.x && nd.y === last.y;
    if (!isReverse && !isSame && this.dirQueue.length < 2) {
      this.dirQueue.push(nd);
    }
  }

  // ── State transitions ──────────────────────────────────────────────────────
  private startGame(): void {
    this.tweens.add({
      targets: this.titleContainer,
      alpha: 0, duration: 300,
      onComplete: () => this.titleContainer.setVisible(false),
    });
    this.state = 'playing';
    this.initSnake();
    this.placeFood();
    this.drawSnake();
    this.events.emit('scoreUpdate', { score: 0, highScore: this.highScore });
    this.events.emit('levelUp', 0);
  }

  private restartGame(): void {
    if (this.goRestartTween) { this.goRestartTween.stop(); this.goRestartTween = undefined; }
    this.goRestartText.setAlpha(1);
    this.gameOverContainer.setVisible(false);
    this.startGame();
  }

  private showTitle(): void {
    this.state = 'title';
    this.titleContainer.setVisible(true).setAlpha(1);
    this.gameOverContainer.setVisible(false);
  }

  private showGameOver(): void {
    this.finalScoreText.setText(`SCORE  ${this.score}`);
    this.bestText.setText(`BEST   ${this.highScore}`);
    this.gameOverContainer.setAlpha(0).setVisible(true);

    this.tweens.add({
      targets: this.gameOverContainer,
      alpha: 1, duration: 450, ease: 'Cubic.easeOut',
    });

    this.goRestartText.setAlpha(0);
    this.time.delayedCall(900, () => {
      if (this.goRestartTween) this.goRestartTween.stop();
      this.goRestartText.setAlpha(1);
      this.goRestartTween = this.tweens.add({
        targets: this.goRestartText,
        alpha: 0, duration: 550,
        ease: 'Sine.easeInOut', yoyo: true, repeat: -1,
      });
    });

    // Bounce score on show
    this.time.delayedCall(500, () => {
      this.tweens.add({
        targets: this.finalScoreText,
        scaleX: 1.25, scaleY: 1.25,
        duration: 130, yoyo: true, ease: 'Cubic.easeOut',
      });
    });
  }

  // ── Overlay builders ───────────────────────────────────────────────────────
  private buildTitleScreen(): void {
    const bg = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.72).setOrigin(0);

    const title = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 100, 'SNAKE', {
      fontSize: '104px', fontFamily: 'monospace',
      color: '#2ecc71', stroke: '#0b5426', strokeThickness: 5,
    }).setOrigin(0.5);

    this.tweens.add({
      targets: title, scaleX: 1.04, scaleY: 1.04,
      duration: 1300, ease: 'Sine.easeInOut', yoyo: true, repeat: -1,
    });

    const sub = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 5, 'E A T  ·  G R O W  ·  S U R V I V E', {
      fontSize: '18px', fontFamily: 'monospace', color: '#58d68d',
    }).setOrigin(0.5);

    const prompt = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 75, 'PRESS ANY KEY TO START', {
      fontSize: '22px', fontFamily: 'monospace', color: '#ecf0f1',
    }).setOrigin(0.5);

    this.tweens.add({
      targets: prompt, alpha: 0, duration: 580,
      ease: 'Sine.easeInOut', yoyo: true, repeat: -1,
    });

    const hint = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 125, '← ↑ ↓ →   or   W A S D', {
      fontSize: '15px', fontFamily: 'monospace', color: '#7f8c8d',
    }).setOrigin(0.5);

    this.titleContainer = this.add.container(0, 0, [bg, title, sub, prompt, hint]).setDepth(100);
  }

  private buildGameOverScreen(): void {
    const overlay = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.78).setOrigin(0);

    const goText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 100, 'GAME OVER', {
      fontSize: '86px', fontFamily: 'monospace',
      color: '#e74c3c', stroke: '#7b241c', strokeThickness: 5,
    }).setOrigin(0.5);

    this.tweens.add({
      targets: goText, scaleX: 1.03, scaleY: 1.03,
      duration: 900, ease: 'Sine.easeInOut', yoyo: true, repeat: -1,
    });

    this.finalScoreText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 10, 'SCORE  0', {
      fontSize: '34px', fontFamily: 'monospace', color: '#f1c40f',
    }).setOrigin(0.5);

    this.bestText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 58, 'BEST   0', {
      fontSize: '26px', fontFamily: 'monospace', color: '#2ecc71',
    }).setOrigin(0.5);

    this.goRestartText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 130, 'PRESS ANY KEY TO PLAY AGAIN', {
      fontSize: '20px', fontFamily: 'monospace', color: '#ecf0f1',
    }).setOrigin(0.5).setAlpha(1);

    this.gameOverContainer = this.add.container(0, 0, [
      overlay, goText, this.finalScoreText, this.bestText, this.goRestartText,
    ]).setDepth(200).setVisible(false);
  }

  // ── Update ─────────────────────────────────────────────────────────────────
  update(_time: number, delta: number): void {
    if (this.state !== 'playing') return;
    this.moveAccum += delta;
    const interval = SPEEDS[this.level] ?? 65;
    if (this.moveAccum >= interval) {
      this.moveAccum -= interval;
      this.step();
    }
  }
}
