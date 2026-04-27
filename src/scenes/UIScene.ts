import Phaser from 'phaser';

const SPEED_COLORS = [0x27ae60, 0x2ecc71, 0xf1c40f, 0xe67e22, 0xe74c3c, 0x9b59b6];
const SPEED_LABELS = ['NORMAL', 'FAST', 'FASTER', 'QUICK', 'BLAZING', 'MAX'];

export class UIScene extends Phaser.Scene {
  private scoreLabel!: Phaser.GameObjects.Text;
  private scoreValue!: Phaser.GameObjects.Text;
  private bestLabel!: Phaser.GameObjects.Text;
  private bestValue!: Phaser.GameObjects.Text;
  private speedDots: Phaser.GameObjects.Graphics[] = [];
  private speedText!: Phaser.GameObjects.Text;
  private currentLevel = 0;
  private pauseBtn!: Phaser.GameObjects.Graphics;
  private pauseBtnPaused = false;

  constructor() {
    super({ key: 'UIScene' });
  }

  create(): void {
    const game = this.scene.get('GameScene');

    // ── Score (left) ──────────────────────────────────────────────────────
    this.scoreLabel = this.add.text(20, 10, 'SCORE', {
      fontSize: '12px', fontFamily: 'monospace', color: '#7f8c8d',
    });

    this.scoreValue = this.add.text(20, 26, '0', {
      fontSize: '28px', fontFamily: 'monospace', color: '#f1c40f',
      stroke: '#7d6608', strokeThickness: 2,
    });

    // ── Best (right, shifted left to give room for pause button) ─────────
    this.bestLabel = this.add.text(1210, 10, 'BEST', {
      fontSize: '12px', fontFamily: 'monospace', color: '#7f8c8d',
    }).setOrigin(1, 0);

    this.bestValue = this.add.text(1210, 26, '0', {
      fontSize: '28px', fontFamily: 'monospace', color: '#2ecc71',
      stroke: '#0b5426', strokeThickness: 2,
    }).setOrigin(1, 0);

    // ── Pause button (far top-right) ──────────────────────────────────────
    this.pauseBtn = this.add.graphics();
    this.pauseBtn.setPosition(1252, 30);
    this.drawPauseIcon(false);

    // Make it interactive with a hit area
    this.pauseBtn.setInteractive(
      new Phaser.Geom.Rectangle(-20, -22, 44, 44),
      Phaser.Geom.Rectangle.Contains,
    );
    this.pauseBtn.on('pointerover', () => {
      this.tweens.add({ targets: this.pauseBtn, scaleX: 1.15, scaleY: 1.15, duration: 100 });
    });
    this.pauseBtn.on('pointerout', () => {
      this.tweens.add({ targets: this.pauseBtn, scaleX: 1, scaleY: 1, duration: 100 });
    });
    this.pauseBtn.on('pointerdown', () => {
      game.events.emit('requestPause');
    });

    // ── Speed indicator ───────────────────────────────────────────────────
    const maxLevels = 6;
    for (let i = 0; i < maxLevels; i++) {
      const dot = this.add.graphics();
      dot.setPosition(640 - (maxLevels / 2 - 0.5) * 18 + i * 18, 14);
      this.speedDots.push(dot);
    }

    this.speedText = this.add.text(640, 30, 'NORMAL', {
      fontSize: '11px', fontFamily: 'monospace', color: '#7f8c8d',
    }).setOrigin(0.5, 0);

    this.updateSpeedDots(0);

    // ── Events from GameScene ─────────────────────────────────────────────
    game.events.on('scoreUpdate', ({ score, highScore }: { score: number; highScore: number }) => {
      this.scoreValue.setText(String(score));
      this.bestValue.setText(String(highScore));
      // Bounce score
      this.tweens.add({
        targets: this.scoreValue,
        scaleX: 1.35, scaleY: 1.35,
        duration: 100, yoyo: true, ease: 'Cubic.easeOut',
      });
    });

    game.events.on('levelUp', (level: number) => {
      this.currentLevel = level;
      this.updateSpeedDots(level);
      // Flash speed indicator
      this.tweens.add({
        targets: this.speedText,
        scaleX: 1.4, scaleY: 1.4,
        duration: 120, yoyo: true, ease: 'Back.easeOut',
      });
    });

    game.events.on('pauseChange', (paused: boolean) => {
      this.pauseBtnPaused = paused;
      this.drawPauseIcon(paused);
      // Pulse the button on toggle
      this.tweens.add({
        targets: this.pauseBtn, scaleX: 1.25, scaleY: 1.25,
        duration: 100, yoyo: true, ease: 'Cubic.easeOut',
      });
    });
  }

  private drawPauseIcon(paused: boolean): void {
    this.pauseBtn.clear();
    // Background circle
    this.pauseBtn.fillStyle(0x1a4a2e, 0.85);
    this.pauseBtn.fillCircle(0, 0, 20);
    this.pauseBtn.lineStyle(2, 0x2ecc71, 0.8);
    this.pauseBtn.strokeCircle(0, 0, 20);

    if (paused) {
      // Play triangle (resume)
      this.pauseBtn.fillStyle(0x2ecc71, 1);
      this.pauseBtn.fillTriangle(-5, -10, -5, 10, 12, 0);
    } else {
      // Pause bars
      this.pauseBtn.fillStyle(0x2ecc71, 1);
      this.pauseBtn.fillRoundedRect(-9, -9, 7, 18, 2);
      this.pauseBtn.fillRoundedRect(2,  -9, 7, 18, 2);
    }
  }

  private updateSpeedDots(level: number): void {
    const color = SPEED_COLORS[level] ?? SPEED_COLORS[SPEED_COLORS.length - 1];
    const label = SPEED_LABELS[level] ?? 'MAX';

    this.speedText.setText(label);
    const hex = '#' + color.toString(16).padStart(6, '0');
    this.speedText.setColor(hex);

    for (let i = 0; i < this.speedDots.length; i++) {
      const dot = this.speedDots[i];
      dot.clear();
      if (i <= level) {
        dot.fillStyle(color, 1);
        dot.fillCircle(0, 0, 5);
      } else {
        dot.lineStyle(1.5, 0x3d5a46, 1);
        dot.strokeCircle(0, 0, 4);
      }
    }
  }
}
