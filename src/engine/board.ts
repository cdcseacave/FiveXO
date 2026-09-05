import { BOARD_SIZE, CELL_COUNT, WIN_LENGTH } from './types';
import type { CellState, Player, Move, WinInfo } from './types';

// Converts 0-indexed column (0..63) to letters: A..Z, AA..BL
export function colToLetter(col: number): string {
  if (col < 26) {
    return String.fromCharCode(65 + col);
  }
  const first = String.fromCharCode(65 + Math.floor(col / 26) - 1);
  const second = String.fromCharCode(65 + (col % 26));
  return `${first}${second}`;
}

// Converts column letters back to 0-indexed column
export function letterToCol(letters: string): number {
  const upper = letters.toUpperCase();
  if (upper.length === 1) {
    return upper.charCodeAt(0) - 65;
  }
  return (upper.charCodeAt(0) - 64) * 26 + (upper.charCodeAt(1) - 65);
}

// Notation format: e.g. "AH32"
export function coordsToNotation(x: number, y: number): string {
  return `${colToLetter(x)}${y + 1}`;
}

export function notationToCoords(notation: string): [number, number] | null {
  const match = notation.trim().match(/^([A-Za-z]+)(\d+)$/);
  if (!match) return null;
  const x = letterToCol(match[1]);
  const y = parseInt(match[2], 10) - 1;
  if (x < 0 || x >= BOARD_SIZE || y < 0 || y >= BOARD_SIZE) return null;
  return [x, y];
}

export class Board {
  public cells: Int8Array;
  public neighborCount: Int16Array;
  public history: Move[] = [];
  public currentTurn: Player = 1; // 1 = Black/X starts
  public winInfo: WinInfo | null = null;
  
  // Bounding box of placed stones for camera framing & search
  public minX: number = BOARD_SIZE;
  public maxX: number = -1;
  public minY: number = BOARD_SIZE;
  public maxY: number = -1;

  constructor() {
    this.cells = new Int8Array(CELL_COUNT);
    this.neighborCount = new Int16Array(CELL_COUNT);
  }

  public reset(): void {
    this.cells.fill(0);
    this.neighborCount.fill(0);
    this.history = [];
    this.currentTurn = 1;
    this.winInfo = null;
    this.minX = BOARD_SIZE;
    this.maxX = -1;
    this.minY = BOARD_SIZE;
    this.maxY = -1;
  }

  public getIndex(x: number, y: number): number {
    return y * BOARD_SIZE + x;
  }

  public getCoords(index: number): [number, number] {
    const x = index % BOARD_SIZE;
    const y = Math.floor(index / BOARD_SIZE);
    return [x, y];
  }

  public get(x: number, y: number): CellState {
    if (x < 0 || x >= BOARD_SIZE || y < 0 || y >= BOARD_SIZE) return 0;
    return this.cells[y * BOARD_SIZE + x] as CellState;
  }

  public isValid(x: number, y: number): boolean {
    return x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE && this.cells[y * BOARD_SIZE + x] === 0;
  }

  // Update Chebyshev neighborhood (radius = 2) when stone added or removed
  private updateNeighbors(cx: number, cy: number, delta: number): void {
    const minDx = Math.max(0, cx - 2);
    const maxDx = Math.min(BOARD_SIZE - 1, cx + 2);
    const minDy = Math.max(0, cy - 2);
    const maxDy = Math.min(BOARD_SIZE - 1, cy + 2);

    for (let y = minDy; y <= maxDy; y++) {
      const rowOffset = y * BOARD_SIZE;
      for (let x = minDx; x <= maxDx; x++) {
        if (x === cx && y === cy) continue;
        this.neighborCount[rowOffset + x] += delta;
      }
    }
  }

  private recalculateBoundingBox(): void {
    if (this.history.length === 0) {
      this.minX = BOARD_SIZE;
      this.maxX = -1;
      this.minY = BOARD_SIZE;
      this.maxY = -1;
      return;
    }
    let minX = BOARD_SIZE;
    let maxX = -1;
    let minY = BOARD_SIZE;
    let maxY = -1;
    for (const m of this.history) {
      if (m.x < minX) minX = m.x;
      if (m.x > maxX) maxX = m.x;
      if (m.y < minY) minY = m.y;
      if (m.y > maxY) maxY = m.y;
    }
    this.minX = minX;
    this.maxX = maxX;
    this.minY = minY;
    this.maxY = maxY;
  }

  public makeMove(x: number, y: number): boolean {
    if (this.winInfo || !this.isValid(x, y)) {
      return false;
    }

    const player = this.currentTurn;
    const index = y * BOARD_SIZE + x;
    this.cells[index] = player;
    this.updateNeighbors(x, y, 1);

    if (x < this.minX) this.minX = x;
    if (x > this.maxX) this.maxX = x;
    if (y < this.minY) this.minY = y;
    if (y > this.maxY) this.maxY = y;

    const move: Move = {
      x,
      y,
      player,
      notation: coordsToNotation(x, y),
      timestamp: Date.now(),
    };
    this.history.push(move);

    // Check for win
    const win = this.checkWin(x, y, player);
    if (win) {
      this.winInfo = win;
    } else {
      this.currentTurn = player === 1 ? 2 : 1;
    }

    return true;
  }

  public undoMove(): Move | null {
    if (this.history.length === 0) return null;
    const lastMove = this.history.pop()!;
    const index = lastMove.y * BOARD_SIZE + lastMove.x;
    this.cells[index] = 0;
    this.updateNeighbors(lastMove.x, lastMove.y, -1);
    this.recalculateBoundingBox();
    this.winInfo = null;
    this.currentTurn = lastMove.player;
    return lastMove;
  }

  // Fast check if placing stone at (x, y) results in a win (5+ in a row)
  public checkWin(x: number, y: number, player: Player): WinInfo | null {
    const directions: Array<{ dx: number; dy: number; name: 'H' | 'V' | 'D1' | 'D2' }> = [
      { dx: 1, dy: 0, name: 'H' },
      { dx: 0, dy: 1, name: 'V' },
      { dx: 1, dy: 1, name: 'D1' },
      { dx: 1, dy: -1, name: 'D2' },
    ];

    for (const dir of directions) {
      const line: Array<[number, number]> = [[x, y]];

      // Forward
      let step = 1;
      while (true) {
        const nx = x + dir.dx * step;
        const ny = y + dir.dy * step;
        if (nx < 0 || nx >= BOARD_SIZE || ny < 0 || ny >= BOARD_SIZE) break;
        if (this.cells[ny * BOARD_SIZE + nx] === player) {
          line.push([nx, ny]);
          step++;
        } else {
          break;
        }
      }

      // Backward
      step = 1;
      while (true) {
        const nx = x - dir.dx * step;
        const ny = y - dir.dy * step;
        if (nx < 0 || nx >= BOARD_SIZE || ny < 0 || ny >= BOARD_SIZE) break;
        if (this.cells[ny * BOARD_SIZE + nx] === player) {
          line.unshift([nx, ny]);
          step++;
        } else {
          break;
        }
      }

      if (line.length >= WIN_LENGTH) {
        return {
          winner: player,
          line,
          direction: dir.name,
        };
      }
    }

    return null;
  }

  // Get all active candidate moves (cells within distance 2 of existing stones)
  public getCandidates(): number[] {
    if (this.minX > this.maxX && this.history.length === 0) {
      return [this.getIndex(32, 32)];
    }

    const candidates: number[] = [];
    const minDx = Math.max(0, this.minX - 2);
    const maxDx = Math.min(BOARD_SIZE - 1, this.maxX + 2);
    const minDy = Math.max(0, this.minY - 2);
    const maxDy = Math.min(BOARD_SIZE - 1, this.maxY + 2);

    for (let y = minDy; y <= maxDy; y++) {
      const rowOffset = y * BOARD_SIZE;
      for (let x = minDx; x <= maxDx; x++) {
        const idx = rowOffset + x;
        if (this.cells[idx] === 0 && this.neighborCount[idx] > 0) {
          candidates.push(idx);
        }
      }
    }

    if (candidates.length === 0) {
      return [this.getIndex(32, 32)];
    }

    return candidates;
  }

  public clone(): Board {
    const b = new Board();
    b.cells.set(this.cells);
    b.neighborCount.set(this.neighborCount);
    b.history = [...this.history];
    b.currentTurn = this.currentTurn;
    b.winInfo = this.winInfo ? { ...this.winInfo, line: [...this.winInfo.line] } : null;
    b.minX = this.minX;
    b.maxX = this.maxX;
    b.minY = this.minY;
    b.maxY = this.maxY;
    return b;
  }
}
