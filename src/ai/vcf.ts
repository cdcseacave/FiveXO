import { BOARD_SIZE } from '../engine/types';
import type { Player } from '../engine/types';
import { Board } from '../engine/board';
import { analyzeDirection, DIRECTIONS } from './patterns';

export interface VCFResult {
  won: boolean;
  path: number[]; // sequence of moves leading to win
}

/**
 * Finds all moves for `attacker` that create a 4 (Open 4 or Blocked 4) or immediate 5.
 * Uses fast threatIndices from analyzeDirection without extra loops.
 */
export function findFourMoves(
  board: Board,
  attacker: Player
): Array<{ move: number; isLiveFour: boolean; isFive: boolean; defenseMoves: number[] }> {
  const moves: Array<{ move: number; isLiveFour: boolean; isFive: boolean; defenseMoves: number[] }> = [];
  const candidates = board.getCandidates();

  for (const idx of candidates) {
    const x = idx % BOARD_SIZE;
    const y = Math.floor(idx / BOARD_SIZE);

    let createsFive = false;
    let createsLiveFour = false;
    let createsFour = false;
    const defenseSet = new Set<number>();

    for (const [dx, dy] of DIRECTIONS) {
      const tactics = analyzeDirection(board.cells, x, y, dx, dy, attacker);
      if (tactics.hasFive) {
        createsFive = true;
        break;
      }
      if (tactics.hasLiveFour) {
        createsLiveFour = true;
      } else if (tactics.fours > 0) {
        createsFour = true;
      }

      for (const tIdx of tactics.threatIndices) {
        if (board.cells[tIdx] === 0) {
          defenseSet.add(tIdx);
        }
      }
    }

    if (createsFive) {
      return [{ move: idx, isLiveFour: false, isFive: true, defenseMoves: [] }];
    }

    if (createsLiveFour || createsFour) {
      moves.push({
        move: idx,
        isLiveFour: createsLiveFour,
        isFive: false,
        defenseMoves: Array.from(defenseSet),
      });
    }
  }

  // Sort Open Fours first, then by fewest defense responses (hardest to defend)
  moves.sort((a, b) => {
    if (a.isLiveFour && !b.isLiveFour) return -1;
    if (!a.isLiveFour && b.isLiveFour) return 1;
    return a.defenseMoves.length - b.defenseMoves.length;
  });

  return moves;
}

/**
 * Victory by Continuous Fours (VCF) recursive solver.
 * Depth typically 12-16 plies.
 */
export function solveVCF(
  board: Board,
  attacker: Player,
  maxDepth: number = 14,
  currentDepth: number = 0,
  nodeBudget: { count: number } = { count: 3000 }
): VCFResult {
  if (currentDepth >= maxDepth || nodeBudget.count <= 0) {
    return { won: false, path: [] };
  }
  nodeBudget.count--;

  const defender: Player = attacker === 1 ? 2 : 1;
  const fourMoves = findFourMoves(board, attacker);

  for (const { move, isFive, isLiveFour, defenseMoves } of fourMoves) {
    // 1. Immediate win
    if (isFive) {
      return { won: true, path: [move] };
    }

    // 2. Open Four is an unblockable win on the next move
    if (isLiveFour) {
      return { won: true, path: [move] };
    }

    // 3. Blocked Four: Defender must block one of the defense cells
    if (defenseMoves.length === 0) continue;

    // Attacker plays the four
    board.cells[move] = attacker;

    let allDefensesFail = true;
    let winningSubPath: number[] = [];

    for (const defIdx of defenseMoves) {
      if (board.cells[defIdx] !== 0) continue;

      // Defender plays the block
      board.cells[defIdx] = defender;

      // Check if defender's block accidentally made a 5 for defender
      const [dx, dy] = board.getCoords(defIdx);
      if (board.checkWin(dx, dy, defender)) {
        board.cells[defIdx] = 0;
        allDefensesFail = false;
        break;
      }

      // Recurse for attacker's next four
      const subResult = solveVCF(board, attacker, maxDepth, currentDepth + 2, nodeBudget);
      board.cells[defIdx] = 0;

      if (!subResult.won) {
        allDefensesFail = false;
        break;
      } else {
        winningSubPath = subResult.path;
      }
    }

    board.cells[move] = 0;

    if (allDefensesFail && winningSubPath.length > 0) {
      return { won: true, path: [move, ...winningSubPath] };
    }
  }

  return { won: false, path: [] };
}

