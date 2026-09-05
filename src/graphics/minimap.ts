import { BOARD_SIZE } from '../engine/types';
import type { BoardTheme } from '../engine/types';
import { Board } from '../engine/board';
import { CELL_PIXELS, RULER_MARGIN } from './board-renderer';
import type { Camera } from './board-renderer';

export class MinimapRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
  }

  public render(
    board: Board,
    camera: Camera,
    viewportWidth: number,
    viewportHeight: number,
    theme: BoardTheme
  ): void {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const size = Math.min(w, h);
    const cellSize = size / BOARD_SIZE;

    ctx.clearRect(0, 0, w, h);

    // 1. Background
    ctx.fillStyle = theme === 'zen' ? '#2c1e13' : '#090d16';
    ctx.fillRect(0, 0, size, size);

    // Subtle border
    ctx.strokeStyle = theme === 'cyber' ? 'rgba(6, 182, 212, 0.3)' : 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, size, size);

    // 2. Draw placed stones
    for (let y = 0; y < BOARD_SIZE; y++) {
      const rowOffset = y * BOARD_SIZE;
      for (let x = 0; x < BOARD_SIZE; x++) {
        const p = board.cells[rowOffset + x];
        if (p !== 0) {
          ctx.fillStyle = p === 1 ? '#06b6d4' : '#fbbf24';
          ctx.beginPath();
          ctx.arc(
            (x + 0.5) * cellSize,
            (y + 0.5) * cellSize,
            Math.max(1.2, cellSize * 0.7),
            0,
            Math.PI * 2
          );
          ctx.fill();
        }
      }
    }

    // 3. Draw Camera Viewport Frustum Rectangle
    const invScale = 1 / camera.scale;
    const viewWorldX = -camera.x * invScale - RULER_MARGIN;
    const viewWorldY = -camera.y * invScale - RULER_MARGIN;
    const viewWorldW = viewportWidth * invScale;
    const viewWorldH = viewportHeight * invScale;

    const boardTotalPixels = BOARD_SIZE * CELL_PIXELS;
    const rx = (viewWorldX / boardTotalPixels) * size;
    const ry = (viewWorldY / boardTotalPixels) * size;
    const rw = (viewWorldW / boardTotalPixels) * size;
    const rh = (viewWorldH / boardTotalPixels) * size;

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(rx, ry, rw, rh);

    ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
    ctx.fillRect(rx, ry, rw, rh);
  }

  public screenToBoardCoord(mx: number, my: number): [number, number] {
    const size = Math.min(this.canvas.width, this.canvas.height);
    const bx = Math.max(0, Math.min(BOARD_SIZE - 1, Math.floor((mx / size) * BOARD_SIZE)));
    const by = Math.max(0, Math.min(BOARD_SIZE - 1, Math.floor((my / size) * BOARD_SIZE)));
    return [bx, by];
  }
}
