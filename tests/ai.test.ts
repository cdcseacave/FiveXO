import { describe, it, expect } from 'vitest';
import { Board } from '../src/engine/board';
import { GomokuAI } from '../src/ai/negamax';
import { Zobrist } from '../src/ai/zobrist';
import { solveVCF } from '../src/ai/vcf';

describe('Zobrist Hashing', () => {
  it('computes deterministic hashes and updates with XOR', () => {
    const board = new Board();
    const initialHash = Zobrist.computeHash(board.cells);
    expect(initialHash).toBe(0n);

    board.cells[board.getIndex(32, 32)] = 1;
    const hash1 = Zobrist.computeHash(board.cells);
    const key1 = Zobrist.getKey(1, board.getIndex(32, 32));
    expect(hash1).toBe(key1);

    // XOR property
    expect(hash1 ^ key1).toBe(0n);
  });
});

describe('Gomoku AI Tactical Engine', () => {
  it('plays center when board is empty', () => {
    const ai = new GomokuAI();
    const board = new Board();
    const result = ai.findBestMove(board, 1, { difficulty: 'master', maxTimeMs: 200 });
    expect(result.move).toEqual([32, 32]);
  });

  it('detects and plays immediate 5-in-a-row win', () => {
    const ai = new GomokuAI();
    const board = new Board();

    // Black has stones at (30, 30), (31, 30), (32, 30), (33, 30)
    board.makeMove(30, 30); // B
    board.makeMove(10, 10); // W
    board.makeMove(31, 30); // B
    board.makeMove(11, 10); // W
    board.makeMove(32, 30); // B
    board.makeMove(12, 10); // W
    board.makeMove(33, 30); // B
    board.makeMove(13, 10); // W

    // Turn is Black (1). (34, 30) or (29, 30) gives immediate win!
    const result = ai.findBestMove(board, 1, { difficulty: 'master', maxTimeMs: 300 });
    const isWin =
      (result.move[0] === 34 && result.move[1] === 30) ||
      (result.move[0] === 29 && result.move[1] === 30);
    expect(isWin).toBe(true);
    expect(result.stats.tacticsNote).toContain('Immediate winning');
  });

  it('detects and immediately blocks opponent winning 5-in-a-row', () => {
    const ai = new GomokuAI();
    const board = new Board();

    // Black plays scattered moves, White makes 4 in a row at (20, 20..23)
    board.makeMove(10, 10); // B1
    board.makeMove(20, 20); // W1
    board.makeMove(10, 15); // B2
    board.makeMove(20, 21); // W2
    board.makeMove(10, 20); // B3
    board.makeMove(20, 22); // W3
    board.makeMove(10, 25); // B4
    board.makeMove(20, 23); // W4

    // Turn is Black. White threatens (20, 24) and (20, 19). Black must block!
    const result = ai.findBestMove(board, 1, { difficulty: 'master', maxTimeMs: 300 });
    const isBlock =
      (result.move[0] === 20 && result.move[1] === 24) ||
      (result.move[0] === 20 && result.move[1] === 19);
    expect(isBlock).toBe(true);
  });

  it('solves simple VCF pattern', () => {
    const board = new Board();
    // B plays 3-in-a-row open, W plays elsewhere
    board.makeMove(30, 30); // B
    board.makeMove(10, 10); // W
    board.makeMove(31, 30); // B
    board.makeMove(10, 11); // W
    board.makeMove(32, 30); // B
    board.makeMove(10, 12); // W

    // Black (turn 1) can play (33, 30) or (29, 30) creating an Open 4 which is guaranteed VCF win!
    const vcf = solveVCF(board, 1, 6);
    expect(vcf.won).toBe(true);
    expect(vcf.path.length).toBeGreaterThan(0);
    const firstMove = board.getCoords(vcf.path[0]);
    const isValidVcfStart =
      (firstMove[0] === 33 && firstMove[1] === 30) ||
      (firstMove[0] === 29 && firstMove[1] === 30);
    expect(isValidVcfStart).toBe(true);
  });

  it('detects and immediately blocks opponent Open 3 before they create Open 4', () => {
    const ai = new GomokuAI();
    const board = new Board();

    // White has Open 3 horizontally: (20, 20), (21, 20), (22, 20) with ends (19, 20) and (23, 20) open
    board.makeMove(10, 10); // B1
    board.makeMove(20, 20); // W1
    board.makeMove(10, 12); // B2
    board.makeMove(21, 20); // W2
    board.makeMove(10, 14); // B3
    board.makeMove(22, 20); // W3

    // Turn is Black. Black must block either (19, 20) or (23, 20)
    const result = ai.findBestMove(board, 1, { difficulty: 'master', maxTimeMs: 400 });
    const isBlock =
      (result.move[0] === 19 && result.move[1] === 20) ||
      (result.move[0] === 23 && result.move[1] === 20);
    expect(isBlock).toBe(true);
  });

  it('detects and creates a Four-Three (4-3) winning fork', () => {
    const ai = new GomokuAI();
    const board = new Board();

    // Setup Black with:
    // Horizontal 3 stones: (30, 30), (31, 30), (32, 30) -> cell (33, 30) creates a 4!
    // Vertical 2 stones: (33, 28), (33, 29) -> cell (33, 30) creates an Open 3!
    // Playing (33, 30) forms a Four-Three fork!
    board.makeMove(30, 30); // B1
    board.makeMove(10, 10); // W1
    board.makeMove(31, 30); // B2
    board.makeMove(10, 20); // W2
    board.makeMove(32, 30); // B3
    board.makeMove(10, 30); // W3
    board.makeMove(33, 28); // B4
    board.makeMove(10, 40); // W4
    board.makeMove(33, 29); // B5
    board.makeMove(10, 50); // W5

    // Turn is Black. Cell (33, 30) gives an immediate Four-Three fork, or (29, 30) gives Open Four
    const result = ai.findBestMove(board, 1, { difficulty: 'master', maxTimeMs: 400 });
    const isWinningTactic =
      (result.move[0] === 33 && result.move[1] === 30) || // Four-Three fork
      (result.move[0] === 29 && result.move[1] === 30);   // Open Four
    expect(isWinningTactic).toBe(true);
  });

  it('detects and blocks opponent Double Three fork', () => {
    const ai = new GomokuAI();
    const board = new Board();

    // White is threatening a Double Three fork at intersection (25, 25):
    // Horizontal: (23, 25), (24, 25)
    // Vertical: (25, 23), (25, 24)
    // If White plays (25, 25), White creates two open threes simultaneously!
    board.makeMove(10, 10); // B1
    board.makeMove(23, 25); // W1
    board.makeMove(10, 20); // B2
    board.makeMove(24, 25); // W2
    board.makeMove(10, 30); // B3
    board.makeMove(25, 23); // W3
    board.makeMove(10, 40); // B4
    board.makeMove(25, 24); // W4

    // Turn is Black. Black AI must take the fork square (25, 25) to block both threes
    const result = ai.findBestMove(board, 1, { difficulty: 'master', maxTimeMs: 500 });
    expect(result.move).toEqual([25, 25]);
  });

  it('preempts opponent forced VCF sequence', () => {
    const ai = new GomokuAI();
    const board = new Board();

    // White has 4-in-a-row with 1 end open (Blocked 4) threatening five
    board.makeMove(10, 10); // B1
    board.makeMove(20, 20); // W1
    board.makeMove(10, 12); // B2
    board.makeMove(21, 20); // W2
    board.makeMove(10, 14); // B3
    board.makeMove(22, 20); // W3
    board.makeMove(10, 16); // B4
    board.makeMove(23, 20); // W4
    // Block one end so it's a Blocked Four
    board.cells[board.getIndex(19, 20)] = 1; // Black stone blocks (19, 20)

    // White now has Blocked Four: (20..23, 20). Only open square is (24, 20).
    // Black turn: Black must play (24, 20) to prevent White's immediate 5!
    const result = ai.findBestMove(board, 1, { difficulty: 'master', maxTimeMs: 400 });
    expect(result.move).toEqual([24, 20]);
  });

  it('achieves high search depth in midgame tactical positions', () => {
    const ai = new GomokuAI();
    const board = new Board();

    // Setup an early game position around center with no immediate wins
    board.makeMove(32, 32); // B1
    board.makeMove(32, 33); // W1
    board.makeMove(33, 32); // B2
    board.makeMove(31, 33); // W2

    const result = ai.findBestMove(board, 1, { difficulty: 'master', maxTimeMs: 800 });
    expect(result.stats.depth).toBeGreaterThanOrEqual(4);
    expect(result.stats.nodes).toBeGreaterThan(1000);
    expect(result.move[0]).toBeGreaterThanOrEqual(28);
    expect(result.move[0]).toBeLessThanOrEqual(36);
  });



});


