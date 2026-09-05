import { BOARD_SIZE } from '../engine/types';
import type { BoardTheme, WinInfo, Player } from '../engine/types';
import { Board, colToLetter } from '../engine/board';

export const CELL_PIXELS = 44;
export const RULER_MARGIN = 32;
export const BOARD_PIXEL_SIZE = BOARD_SIZE * CELL_PIXELS + RULER_MARGIN * 2;

export interface Camera {
  x: number; // pan offset in pixels
  y: number;
  scale: number; // zoom multiplier
}

export interface RenderOptions {
  theme: BoardTheme;
  hoverCoord: [number, number] | null;
  currentTurn: Player;
  showThreats: boolean;
  threatCoords?: Map<number, { type: 'win' | 'four' | 'three'; player: Player }>;
  lastMove: [number, number] | null;
  winInfo: WinInfo | null;
  animTime: number;
}

export class BoardRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false })!;
  }

  public resize(width: number, height: number, dpr: number = window.devicePixelRatio || 1): void {
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(dpr, dpr);
  }

  public screenToBoard(
    screenX: number,
    screenY: number,
    camera: Camera
  ): [number, number] | null {
    const worldX = (screenX - camera.x) / camera.scale - RULER_MARGIN;
    const worldY = (screenY - camera.y) / camera.scale - RULER_MARGIN;

    const bx = Math.floor(worldX / CELL_PIXELS);
    const by = Math.floor(worldY / CELL_PIXELS);

    if (bx >= 0 && bx < BOARD_SIZE && by >= 0 && by < BOARD_SIZE) {
      return [bx, by];
    }
    return null;
  }

  public boardToScreen(
    bx: number,
    by: number,
    camera: Camera
  ): [number, number] {
    const worldX = RULER_MARGIN + (bx + 0.5) * CELL_PIXELS;
    const worldY = RULER_MARGIN + (by + 0.5) * CELL_PIXELS;
    const sx = camera.x + worldX * camera.scale;
    const sy = camera.y + worldY * camera.scale;
    return [sx, sy];
  }

  public render(
    board: Board,
    camera: Camera,
    viewportWidth: number,
    viewportHeight: number,
    options: RenderOptions
  ): void {
    const ctx = this.ctx;
    const { theme, hoverCoord, currentTurn, lastMove, winInfo, animTime } = options;

    ctx.save();

    // 1. Clear background
    const bgColors: Record<BoardTheme, string> = {
      cyber: '#080c14',
      zen: '#1a140f',
      light: '#f1f5f9',
    };
    ctx.fillStyle = bgColors[theme];
    ctx.fillRect(0, 0, viewportWidth, viewportHeight);

    // Apply Camera Transform
    ctx.translate(camera.x, camera.y);
    ctx.scale(camera.scale, camera.scale);

    // 2. Draw Board Surface
    this.drawBoardSurface(ctx, theme);

    // 3. Viewport Culling
    const invScale = 1 / camera.scale;
    const viewLeft = -camera.x * invScale - RULER_MARGIN;
    const viewTop = -camera.y * invScale - RULER_MARGIN;
    const viewRight = viewLeft + viewportWidth * invScale;
    const viewBottom = viewTop + viewportHeight * invScale;

    const minX = Math.max(0, Math.floor(viewLeft / CELL_PIXELS) - 1);
    const maxX = Math.min(BOARD_SIZE - 1, Math.ceil(viewRight / CELL_PIXELS) + 1);
    const minY = Math.max(0, Math.floor(viewTop / CELL_PIXELS) - 1);
    const maxY = Math.min(BOARD_SIZE - 1, Math.ceil(viewBottom / CELL_PIXELS) + 1);

    // 4. Draw Grid Lines
    this.drawGrid(ctx, theme, minX, maxX, minY, maxY);

    // 5. Draw Coordinate Rulers
    this.drawRulers(ctx, theme, minX, maxX, minY, maxY);

    // 6. Draw Placed Stones
    for (let y = minY; y <= maxY; y++) {
      const rowOffset = y * BOARD_SIZE;
      for (let x = minX; x <= maxX; x++) {
        const p = board.cells[rowOffset + x];
        if (p !== 0) {
          const isLast = lastMove !== null && lastMove[0] === x && lastMove[1] === y;
          this.drawStone(ctx, x, y, p as Player, theme, isLast, animTime);
        }
      }
    }

    // 7. Draw Hover Ghost Stone
    if (hoverCoord && !winInfo) {
      const [hx, hy] = hoverCoord;
      if (board.get(hx, hy) === 0) {
        this.drawGhostStone(ctx, hx, hy, currentTurn);
      }
    }

    // 8. Draw Winning Line Animation
    if (winInfo && winInfo.line.length >= 5) {
      this.drawWinningLine(ctx, winInfo, animTime);
    }

    ctx.restore();
  }

  private drawBoardSurface(ctx: CanvasRenderingContext2D, theme: BoardTheme): void {
    const totalSize = BOARD_SIZE * CELL_PIXELS + RULER_MARGIN * 2;

    if (theme === 'zen') {
      const grad = ctx.createLinearGradient(0, 0, totalSize, totalSize);
      grad.addColorStop(0, '#e5a855');
      grad.addColorStop(0.5, '#deb06c');
      grad.addColorStop(1, '#cb8d3b');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, totalSize, totalSize);

      ctx.strokeStyle = '#8a531b';
      ctx.lineWidth = 3;
      ctx.strokeRect(RULER_MARGIN - 4, RULER_MARGIN - 4, BOARD_SIZE * CELL_PIXELS + 8, BOARD_SIZE * CELL_PIXELS + 8);
    } else if (theme === 'cyber') {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, totalSize, totalSize);

      ctx.strokeStyle = 'rgba(6, 182, 212, 0.4)';
      ctx.lineWidth = 2;
      ctx.strokeRect(RULER_MARGIN, RULER_MARGIN, BOARD_SIZE * CELL_PIXELS, BOARD_SIZE * CELL_PIXELS);
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, totalSize, totalSize);
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 2;
      ctx.strokeRect(RULER_MARGIN, RULER_MARGIN, BOARD_SIZE * CELL_PIXELS, BOARD_SIZE * CELL_PIXELS);
    }
  }

  private drawGrid(
    ctx: CanvasRenderingContext2D,
    theme: BoardTheme,
    minX: number,
    maxX: number,
    minY: number,
    maxY: number
  ): void {
    ctx.save();
    ctx.lineWidth = 1;

    let normalLineColor = 'rgba(255, 255, 255, 0.08)';
    let majorLineColor = 'rgba(6, 182, 212, 0.25)';
    let starColor = '#06b6d4';

    if (theme === 'zen') {
      normalLineColor = 'rgba(60, 35, 10, 0.45)';
      majorLineColor = 'rgba(50, 25, 5, 0.75)';
      starColor = '#3a200a';
    } else if (theme === 'light') {
      normalLineColor = '#e2e8f0';
      majorLineColor = '#94a3b8';
      starColor = '#475569';
    }

    for (let x = minX; x <= maxX; x++) {
      const px = RULER_MARGIN + (x + 0.5) * CELL_PIXELS;
      const isMajor = x % 8 === 0 || x === 32;
      ctx.strokeStyle = isMajor ? majorLineColor : normalLineColor;
      ctx.lineWidth = isMajor ? 1.5 : 1;

      ctx.beginPath();
      ctx.moveTo(px, RULER_MARGIN + (minY + 0.5) * CELL_PIXELS);
      ctx.lineTo(px, RULER_MARGIN + (maxY + 0.5) * CELL_PIXELS);
      ctx.stroke();
    }

    for (let y = minY; y <= maxY; y++) {
      const py = RULER_MARGIN + (y + 0.5) * CELL_PIXELS;
      const isMajor = y % 8 === 0 || y === 32;
      ctx.strokeStyle = isMajor ? majorLineColor : normalLineColor;
      ctx.lineWidth = isMajor ? 1.5 : 1;

      ctx.beginPath();
      ctx.moveTo(RULER_MARGIN + (minX + 0.5) * CELL_PIXELS, py);
      ctx.lineTo(RULER_MARGIN + (maxX + 0.5) * CELL_PIXELS, py);
      ctx.stroke();
    }

    // Star points
    ctx.fillStyle = starColor;
    for (let sy = 16; sy < BOARD_SIZE; sy += 16) {
      if (sy < minY || sy > maxY) continue;
      for (let sx = 16; sx < BOARD_SIZE; sx += 16) {
        if (sx < minX || sx > maxX) continue;
        const px = RULER_MARGIN + (sx + 0.5) * CELL_PIXELS;
        const py = RULER_MARGIN + (sy + 0.5) * CELL_PIXELS;
        ctx.beginPath();
        ctx.arc(px, py, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (32 >= minX && 32 <= maxX && 32 >= minY && 32 <= maxY) {
      const cx = RULER_MARGIN + 32.5 * CELL_PIXELS;
      const cy = RULER_MARGIN + 32.5 * CELL_PIXELS;
      ctx.beginPath();
      ctx.arc(cx, cy, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  private drawRulers(
    ctx: CanvasRenderingContext2D,
    theme: BoardTheme,
    minX: number,
    maxX: number,
    minY: number,
    maxY: number
  ): void {
    ctx.save();
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = theme === 'cyber' ? '#64748b' : theme === 'zen' ? '#6b461f' : '#64748b';

    for (let x = minX; x <= maxX; x++) {
      const px = RULER_MARGIN + (x + 0.5) * CELL_PIXELS;
      ctx.fillText(colToLetter(x), px, RULER_MARGIN / 2);
    }

    ctx.textAlign = 'right';
    for (let y = minY; y <= maxY; y++) {
      const py = RULER_MARGIN + (y + 0.5) * CELL_PIXELS;
      ctx.fillText(`${y + 1}`, RULER_MARGIN - 6, py);
    }

    ctx.restore();
  }

  public drawStone(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    player: Player,
    theme: BoardTheme,
    isLast: boolean = false,
    animTime: number = 0
  ): void {
    const cx = RULER_MARGIN + (x + 0.5) * CELL_PIXELS;
    const cy = RULER_MARGIN + (y + 0.5) * CELL_PIXELS;
    const radius = CELL_PIXELS * 0.44;

    ctx.save();

    ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 3;

    if (theme === 'zen') {
      if (player === 1) {
        const grad = ctx.createRadialGradient(cx - radius * 0.3, cy - radius * 0.3, radius * 0.1, cx, cy, radius);
        grad.addColorStop(0, '#333338');
        grad.addColorStop(0.5, '#1e1e22');
        grad.addColorStop(1, '#0e0e11');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const grad = ctx.createRadialGradient(cx - radius * 0.35, cy - radius * 0.35, radius * 0.1, cx, cy, radius);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.7, '#f4f2ec');
        grad.addColorStop(1, '#d8d4c6');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      ctx.shadowColor = player === 1 ? 'rgba(6, 182, 212, 0.55)' : 'rgba(245, 158, 11, 0.55)';
      ctx.shadowBlur = isLast ? 16 : 8;

      const grad = ctx.createRadialGradient(cx - radius * 0.3, cy - radius * 0.3, radius * 0.1, cx, cy, radius);
      if (player === 1) {
        // Full, vibrant cyan / electric sapphire disc matching the fullness of White O
        grad.addColorStop(0, '#cffafe');
        grad.addColorStop(0.3, '#38bdf8');
        grad.addColorStop(0.7, '#0284c7');
        grad.addColorStop(1, '#0369a1');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();

        // Outer crisp rim
        ctx.strokeStyle = '#a5f3fc';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.stroke();

        // Inner decorative ring
        ctx.strokeStyle = '#0284c7';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy, radius * 0.62, 0, Math.PI * 2);
        ctx.stroke();

        // Bold, tactile X emblem matching the weight of the O ring
        ctx.strokeStyle = '#082f49';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        const arm = radius * 0.34;
        ctx.beginPath();
        ctx.moveTo(cx - arm, cy - arm);
        ctx.lineTo(cx + arm, cy + arm);
        ctx.moveTo(cx + arm, cy - arm);
        ctx.lineTo(cx - arm, cy + arm);
        ctx.stroke();
      } else {
        // Full, radiant golden amber disc
        grad.addColorStop(0, '#fef3c7');
        grad.addColorStop(0.3, '#fde68a');
        grad.addColorStop(0.7, '#f59e0b');
        grad.addColorStop(1, '#d97706');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();

        // Outer crisp rim
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.stroke();

        // Inner decorative ring
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy, radius * 0.62, 0, Math.PI * 2);
        ctx.stroke();

        // Bold, tactile O emblem
        ctx.strokeStyle = '#78350f';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(cx, cy, radius * 0.34, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    if (isLast) {
      const pulse = (Math.sin(animTime * 0.006) + 1) * 0.5;
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#06b6d4';
      ctx.strokeStyle = player === 1 ? 'rgba(34, 211, 238, 0.9)' : 'rgba(251, 191, 36, 0.9)';
      ctx.lineWidth = 2 + pulse * 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, radius + 3 + pulse * 2, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  public drawGhostStone(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    player: Player
  ): void {
    const cx = RULER_MARGIN + (x + 0.5) * CELL_PIXELS;
    const cy = RULER_MARGIN + (y + 0.5) * CELL_PIXELS;
    const radius = CELL_PIXELS * 0.42;

    ctx.save();
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = player === 1 ? '#06b6d4' : '#fbbf24';
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = player === 1 ? '#22d3ee' : '#f59e0b';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 4, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }

  public drawWinningLine(
    ctx: CanvasRenderingContext2D,
    winInfo: WinInfo,
    animTime: number
  ): void {
    const { line, winner } = winInfo;
    if (line.length < 5) return;

    ctx.save();
    const start = line[0];
    const end = line[line.length - 1];

    const sx = RULER_MARGIN + (start[0] + 0.5) * CELL_PIXELS;
    const sy = RULER_MARGIN + (start[1] + 0.5) * CELL_PIXELS;
    const ex = RULER_MARGIN + (end[0] + 0.5) * CELL_PIXELS;
    const ey = RULER_MARGIN + (end[1] + 0.5) * CELL_PIXELS;

    const pulse = (Math.sin(animTime * 0.008) + 1) * 0.5;
    ctx.shadowBlur = 18 + pulse * 10;
    ctx.shadowColor = winner === 1 ? '#06b6d4' : '#f59e0b';
    ctx.strokeStyle = winner === 1 ? '#67e8f9' : '#fde047';
    ctx.lineWidth = 4 + pulse * 2;
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.stroke();

    for (const [lx, ly] of line) {
      const cx = RULER_MARGIN + (lx + 0.5) * CELL_PIXELS;
      const cy = RULER_MARGIN + (ly + 0.5) * CELL_PIXELS;
      ctx.beginPath();
      ctx.arc(cx, cy, CELL_PIXELS * 0.48, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }
}
