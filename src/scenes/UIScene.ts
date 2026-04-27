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

    // ── Best (right) ──────────────────────────────────────────────────────
    this.bestLabel = this.add.text(1260, 10, 'BEST', {
      fontSize: '12px', fontFamily: 'monospace', color: '#7f8c8d',
    }).setOrigin(1, 0);

    this.bestValue = this.add.text(1260, 26, '0', {
      fontSize: '28px', fontFamily: 'monospace', color: '#2ecc71',
      stroke: '#0b5426', strokeThickness: 2,
    }).setOrigin(1, 0);

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
