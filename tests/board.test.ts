import { describe, it, expect } from 'vitest';
import { Board, colToLetter, letterToCol, coordsToNotation, notationToCoords } from '../src/engine/board';

describe('Board Coordinate Helpers', () => {
  it('converts column indices to letters and back', () => {
    expect(colToLetter(0)).toBe('A');
    expect(colToLetter(25)).toBe('Z');
    expect(colToLetter(26)).toBe('AA');
    expect(colToLetter(63)).toBe('BL');

    expect(letterToCol('A')).toBe(0);
    expect(letterToCol('Z')).toBe(25);
    expect(letterToCol('AA')).toBe(26);
    expect(letterToCol('BL')).toBe(63);
  });

  it('converts coordinates to notation and back', () => {
    expect(coordsToNotation(0, 0)).toBe('A1');
    expect(coordsToNotation(32, 32)).toBe('AG33');
    expect(coordsToNotation(63, 63)).toBe('BL64');

    expect(notationToCoords('A1')).toEqual([0, 0]);
    expect(notationToCoords('AG33')).toEqual([32, 32]);
    expect(notationToCoords('BL64')).toEqual([63, 63]);
    expect(notationToCoords('INVALID')).toBeNull();
  });
});

describe('Board Engine', () => {
  it('initializes empty board and generates center candidate first', () => {
    const board = new Board();
    expect(board.history.length).toBe(0);
    expect(board.currentTurn).toBe(1);
    const candidates = board.getCandidates();
    expect(candidates).toEqual([board.getIndex(32, 32)]);
  });

  it('handles moves and alternates turns', () => {
    const board = new Board();
    expect(board.makeMove(32, 32)).toBe(true);
    expect(board.currentTurn).toBe(2);
    expect(board.get(32, 32)).toBe(1);

    expect(board.makeMove(32, 33)).toBe(true);
    expect(board.currentTurn).toBe(1);
    expect(board.get(32, 33)).toBe(2);

    // Cannot play on occupied cell
    expect(board.makeMove(32, 32)).toBe(false);
  });

  it('tracks candidates within Chebyshev distance 2', () => {
    const board = new Board();
    board.makeMove(32, 32);
    const candidates = board.getCandidates();
    // 5x5 box minus center = 24 candidates
    expect(candidates.length).toBe(24);
    for (const idx of candidates) {
      const [x, y] = board.getCoords(idx);
      expect(Math.abs(x - 32)).toBeLessThanOrEqual(2);
      expect(Math.abs(y - 32)).toBeLessThanOrEqual(2);
    }
  });

  it('detects horizontal 5-in-a-row win', () => {
    const board = new Board();
    // Black: (30,30), (31,30), (32,30), (33,30), (34,30)
    // White: (30,31), (31,31), (32,31), (33,31)
    expect(board.makeMove(30, 30)).toBe(true); // B1
    expect(board.makeMove(30, 31)).toBe(true); // W1
    expect(board.makeMove(31, 30)).toBe(true); // B2
    expect(board.makeMove(31, 31)).toBe(true); // W2
    expect(board.makeMove(32, 30)).toBe(true); // B3
    expect(board.makeMove(32, 31)).toBe(true); // W3
    expect(board.makeMove(33, 30)).toBe(true); // B4
    expect(board.makeMove(33, 31)).toBe(true); // W4
    expect(board.makeMove(34, 30)).toBe(true); // B5 -> Win!

    expect(board.winInfo).not.toBeNull();
    expect(board.winInfo?.winner).toBe(1);
    expect(board.winInfo?.direction).toBe('H');
    expect(board.winInfo?.line.length).toBe(5);

    // Cannot make moves after win
    expect(board.makeMove(34, 31)).toBe(false);
  });

  it('detects diagonal win', () => {
    const board = new Board();
    for (let i = 0; i < 4; i++) {
      board.makeMove(10 + i, 10 + i); // Black
      board.makeMove(10 + i, 20);      // White
    }
    board.makeMove(14, 14); // Black 5th
    expect(board.winInfo).not.toBeNull();
    expect(board.winInfo?.winner).toBe(1);
    expect(board.winInfo?.direction).toBe('D1');
  });

  it('supports undoing moves and restoring candidates', () => {
    const board = new Board();
    board.makeMove(32, 32);
    board.makeMove(32, 33);
    expect(board.history.length).toBe(2);

    const undone = board.undoMove();
    expect(undone?.x).toBe(32);
    expect(undone?.y).toBe(33);
    expect(board.get(32, 33)).toBe(0);
    expect(board.currentTurn).toBe(2);
    expect(board.getCandidates().length).toBe(24);
  });
});
