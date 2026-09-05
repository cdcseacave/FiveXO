import { Board } from '../engine/board';
import { GomokuAI } from './negamax';
import type { Player, AIDifficulty, AIStats, Move } from '../engine/types';

const ai = new GomokuAI();

export interface WorkerMessageRequest {
  id: number;
  type: 'SEARCH' | 'RESET';
  cells?: number[];
  currentTurn?: Player;
  difficulty?: AIDifficulty;
  history?: Move[];
  maxTimeMs?: number;
  maxDepth?: number;
}

export interface WorkerMessageResponse {
  id: number;
  type: 'PROGRESS' | 'DONE';
  move?: [number, number];
  stats: AIStats;
}

self.onmessage = (e: MessageEvent<WorkerMessageRequest>) => {
  const { id, type, cells, currentTurn, difficulty = 'master', history, maxTimeMs = 1200, maxDepth = 8 } = e.data;

  if (type === 'RESET') {
    ai.reset();
    return;
  }

  if (type === 'SEARCH' && cells && currentTurn) {
    try {
      const board = new Board();
      board.cells.set(new Int8Array(cells));
      board.currentTurn = currentTurn;
      board.history = history ? [...history] : [];

      // Recalculate candidates and bounding box for the reconstructed board
      let stoneCount = 0;
      for (let y = 0; y < 64; y++) {
        const rowOffset = y * 64;
        for (let x = 0; x < 64; x++) {
          const p = board.cells[rowOffset + x];
          if (p !== 0) {
            stoneCount++;
            if (x < board.minX) board.minX = x;
            if (x > board.maxX) board.maxX = x;
            if (y < board.minY) board.minY = y;
            if (y > board.maxY) board.maxY = y;

            // Increment neighbors
            for (let dy = -2; dy <= 2; dy++) {
              const ny = y + dy;
              if (ny < 0 || ny >= 64) continue;
              const nRow = ny * 64;
              for (let dx = -2; dx <= 2; dx++) {
                const nx = x + dx;
                if (nx < 0 || nx >= 64) continue;
                if (dx === 0 && dy === 0) continue;
                board.neighborCount[nRow + nx]++;
              }
            }
          }
        }
      }

      // If no stones were detected, keep bounding box empty
      if (stoneCount === 0) {
        board.minX = 64;
        board.maxX = -1;
        board.minY = 64;
        board.maxY = -1;
      }

      const result = ai.findBestMove(board, currentTurn, {
        difficulty,
        maxTimeMs,
        maxDepth,
        onProgress: (stats: AIStats) => {
          self.postMessage({
            id,
            type: 'PROGRESS',
            stats,
          } as WorkerMessageResponse);
        },
      });

      self.postMessage({
        id,
        type: 'DONE',
        move: result.move,
        stats: result.stats,
      } as WorkerMessageResponse);
    } catch (err) {
      console.error('[AI Worker Error]:', err);
      // Emergency fallback candidate
      const board = new Board();
      board.cells.set(new Int8Array(cells));
      const candidates = board.getCandidates();
      const fallbackIdx = candidates.find((idx) => board.cells[idx] === 0) ?? board.getIndex(32, 32);
      const fallbackMove = board.getCoords(fallbackIdx);

      self.postMessage({
        id,
        type: 'DONE',
        move: fallbackMove,
        stats: {
          depth: 1,
          nodes: 1,
          nps: 0,
          score: 0,
          pv: [fallbackMove],
          pvNotation: `${fallbackMove[0]},${fallbackMove[1]}`,
          bestMove: fallbackMove,
          thinking: false,
        },
      } as WorkerMessageResponse);
    }
  }
};
