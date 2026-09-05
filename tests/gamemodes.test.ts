import { describe, it, expect } from 'vitest';
import { Board } from '../src/engine/board';
import { GomokuAI } from '../src/ai/negamax';

describe('Game Modes End-to-End Test Suite', () => {
  it('1. Pass & Play (Local 1v1): Plays full match to victory', () => {
    const board = new Board();
    expect(board.winInfo).toBeNull();

    // Alternate 9 moves until Player 1 (Black) achieves 5-in-a-row horizontally
    const moves: Array<[number, number]> = [
      [32, 32], // B1
      [32, 33], // W1
      [33, 32], // B2
      [33, 33], // W2
      [34, 32], // B3
      [34, 33], // W3
      [35, 32], // B4
      [35, 33], // W4
      [36, 32], // B5 -> Win!
    ];

    for (let i = 0; i < moves.length; i++) {
      const [x, y] = moves[i];
      const success = board.makeMove(x, y);
      expect(success).toBe(true);
    }

    // Verify game over with winner
    expect(board.winInfo).not.toBeNull();
    expect(board.winInfo?.winner).toBe(1);
    expect(board.winInfo?.direction).toBe('H');
    expect(board.winInfo?.line.length).toBe(5);

    // Verify further moves are blocked
    expect(board.makeMove(36, 33)).toBe(false);

    // Verify undo restores game in progress
    const undone = board.undoMove();
    expect(undone).not.toBeNull();
    expect(board.winInfo).toBeNull();
    expect(board.currentTurn).toBe(1);
  });

  it('2. AI vs AI: Simulates full autonomous bot match until 5-in-a-row win', () => {
    const board = new Board();
    const ai1 = new GomokuAI();
    const ai2 = new GomokuAI();

    let moveCount = 0;
    const maxMoves = 60;

    while (!board.winInfo && moveCount < maxMoves) {
      const currentTurn = board.currentTurn;
      const currentAi = currentTurn === 1 ? ai1 : ai2;

      const result = currentAi.findBestMove(board, currentTurn, {
        difficulty: 'intermediate',
        maxTimeMs: 40,
      });

      expect(result.move).toBeDefined();
      const [x, y] = result.move;

      // Assert move is legal and empty
      expect(board.isValid(x, y)).toBe(true);

      const success = board.makeMove(x, y);
      expect(success).toBe(true);
      moveCount++;
    }

    // A game between two competent Gomoku AIs must conclude with a 5-in-a-row winner!
    expect(board.winInfo).not.toBeNull();
    expect(board.winInfo?.line.length).toBeGreaterThanOrEqual(5);
    expect([1, 2]).toContain(board.winInfo?.winner);
  }, 25000);

  it('3. 1 vs AI: Simulates full match until one player achieves 5-in-a-row victory', () => {
    const board = new Board();
    const ai = new GomokuAI();

    let movesPlayed = 0;
    while (!board.winInfo && movesPlayed < 50) {
      if (board.currentTurn === 1) {
        // Human player (Black)
        const candidates = board.getCandidates();
        const [hx, hy] = board.getCoords(candidates[0]);
        board.makeMove(hx, hy);
      } else {
        // AI player (White)
        const aiRes = ai.findBestMove(board, 2, { difficulty: 'master', maxTimeMs: 40 });
        board.makeMove(aiRes.move[0], aiRes.move[1]);
      }
      movesPlayed++;
    }

    expect(board.winInfo).not.toBeNull();
    expect(board.winInfo?.line.length).toBeGreaterThanOrEqual(5);
    expect([1, 2]).toContain(board.winInfo?.winner);
  }, 25000);

  it('3b. 1 vs AI: AI moves first (Black / X) and plays to full victory', () => {
    const board = new Board();
    const ai = new GomokuAI();

    let movesPlayed = 0;
    while (!board.winInfo && movesPlayed < 50) {
      if (board.currentTurn === 1) {
        // AI player moves first as Black (X)
        const aiRes = ai.findBestMove(board, 1, { difficulty: 'master', maxTimeMs: 40 });
        board.makeMove(aiRes.move[0], aiRes.move[1]);
      } else {
        // Human player as White (O)
        const candidates = board.getCandidates();
        const [hx, hy] = board.getCoords(candidates[0]);
        board.makeMove(hx, hy);
      }
      movesPlayed++;
    }

    expect(board.winInfo).not.toBeNull();
    expect(board.winInfo?.line.length).toBeGreaterThanOrEqual(5);
    expect([1, 2]).toContain(board.winInfo?.winner);
  }, 25000);

  it('4. Online 1v1 P2P: Simulates remote network move transmission and synchronization', () => {
    // Peer 1 (Host / Black)
    const hostBoard = new Board();
    // Peer 2 (Guest / White)
    const guestBoard = new Board();

    // Simulated network message channel
    const sendToGuest = (x: number, y: number) => {
      guestBoard.makeMove(x, y);
    };
    const sendToHost = (x: number, y: number) => {
      hostBoard.makeMove(x, y);
    };

    // Sequence of 9 turns synchronized over "network"
    const moves: Array<[number, number]> = [
      [30, 30], // Host
      [30, 31], // Guest
      [31, 30], // Host
      [31, 31], // Guest
      [32, 30], // Host
      [32, 31], // Guest
      [33, 30], // Host
      [33, 31], // Guest
      [34, 30], // Host -> 5 in a row!
    ];

    for (let i = 0; i < moves.length; i++) {
      const [x, y] = moves[i];
      if (i % 2 === 0) {
        // Host turn
        hostBoard.makeMove(x, y);
        sendToGuest(x, y);
      } else {
        // Guest turn
        guestBoard.makeMove(x, y);
        sendToHost(x, y);
      }

      // Assert boards remain 100% in sync at every step
      expect(hostBoard.get(x, y)).toBe(guestBoard.get(x, y));
      expect(hostBoard.currentTurn).toBe(guestBoard.currentTurn);
    }

    // Both peers detect win simultaneously
    expect(hostBoard.winInfo).not.toBeNull();
    expect(guestBoard.winInfo).not.toBeNull();
    expect(hostBoard.winInfo?.winner).toBe(guestBoard.winInfo?.winner);
    expect(hostBoard.winInfo?.winner).toBe(1);
  });
});
