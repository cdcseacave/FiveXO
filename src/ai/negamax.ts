import { CELL_COUNT } from '../engine/types';
import type { Player, AIDifficulty, AIStats } from '../engine/types';
import { Board, coordsToNotation } from '../engine/board';
import { evaluateCellScore, evaluateCellAttack, PATTERN_SCORES } from './patterns';
import { Zobrist } from './zobrist';
import { TranspositionTable, TTFlag } from './transposition';
import { solveVCF } from './vcf';

const WIN_SCORE = 10_000_000;
const INF = 100_000_000;

export interface SearchOptions {
  difficulty: AIDifficulty;
  maxTimeMs?: number;
  maxDepth?: number;
  onProgress?: (stats: AIStats) => void;
}

export class GomokuAI {
  private tt: TranspositionTable = new TranspositionTable();
  private killerMoves: number[][] = []; // [depth][2]
  private historyTable: Int32Array = new Int32Array(CELL_COUNT);
  private nodesVisited: number = 0;
  private startTime: number = 0;
  private timeLimit: number = 1000;
  private stopSearch: boolean = false;

  // Track PV (Principal Variation)
  private pvTable: number[][] = [];

  constructor() {
    this.initTables();
  }

  private initTables(): void {
    this.killerMoves = Array.from({ length: 32 }, () => [-1, -1]);
    this.historyTable.fill(0);
    this.pvTable = Array.from({ length: 32 }, () => []);
  }

  public reset(): void {
    this.tt.clear();
    this.initTables();
  }

  /**
   * Evaluates whole board from perspective of current player with symmetric threat dominance.
   */
  public evaluateBoard(board: Board, player: Player): number {
    const opponent: Player = player === 1 ? 2 : 1;
    let myScore = 0;
    let oppScore = 0;
    let myMax = 0;
    let oppMax = 0;

    const candidates = board.getCandidates();
    for (const idx of candidates) {
      const [x, y] = board.getCoords(idx);
      const myAttack = evaluateCellAttack(board.cells, x, y, player);
      const oppAttack = evaluateCellAttack(board.cells, x, y, opponent);

      if (myAttack > myMax) myMax = myAttack;
      if (oppAttack > oppMax) oppMax = oppAttack;

      myScore += myAttack;
      oppScore += oppAttack;
    }

    // Decisive threat dominance (symmetric)
    if (myMax >= PATTERN_SCORES.FIVE) return WIN_SCORE;
    if (oppMax >= PATTERN_SCORES.FIVE) return -WIN_SCORE / 2;
    if (myMax >= PATTERN_SCORES.LIVE_FOUR) return 2_000_000;
    if (oppMax >= PATTERN_SCORES.LIVE_FOUR) return -2_000_000;
    if (myMax >= PATTERN_SCORES.FOUR_THREE) return 1_200_000;
    if (oppMax >= PATTERN_SCORES.FOUR_THREE) return -1_200_000;
    if (myMax >= PATTERN_SCORES.DOUBLE_THREE) return 1_000_000;
    if (oppMax >= PATTERN_SCORES.DOUBLE_THREE) return -1_000_000;

    return (myMax - oppMax) * 2 + (myScore - oppScore);
  }

  /**
   * Generates and sorts candidate moves using strict tactical pruning:
   * - Tier 1: Player immediate 5 win (B=1)
   * - Tier 2: Opponent 4->5 threat: MUST block (B=1 or 2, quiet moves pruned 100%)
   * - Tier 3: Opponent Open 3 or Fork (3-3, 4-3) threat: restricted to player Fours and direct blocks (B <= 6)
   * - Tier 4: Quiet position: sorted by tactical threat + TT + Killer + History
   */
  private getOrderedCandidates(
    board: Board,
    player: Player,
    depth: number,
    ttMove: number = -1,
    maxCandidates: number = 14
  ): Array<{ index: number; score: number }> {
    const rawCandidates = board.getCandidates();

    let winMove: { index: number; score: number } | null = null;
    const oppFiveBlocks: Array<{ index: number; score: number }> = [];
    const oppOpenFourBlocks: Array<{ index: number; score: number }> = [];
    const myForks: Array<{ index: number; score: number }> = [];
    const myFours: Array<{ index: number; score: number }> = [];
    const generalMoves: Array<{ index: number; score: number }> = [];

    for (const idx of rawCandidates) {
      const [x, y] = board.getCoords(idx);
      const cell = evaluateCellScore(board.cells, x, y, player);

      // 1. Immediate Win
      if (cell.hasFive) {
        winMove = { index: idx, score: 50_000_000 };
        break;
      }

      // 2. Opponent 5 Threat
      if (cell.oppHasFive) {
        oppFiveBlocks.push({ index: idx, score: 30_000_000 + cell.attack });
        continue;
      }

      // 3. Opponent Open Four Threat or Fork Threat (Double Three, Four-Three, Double Four)
      if (cell.oppHasLiveFour || cell.oppHasFork) {
        oppOpenFourBlocks.push({ index: idx, score: 10_000_000 + cell.total });
      }

      // 4. Player Forks (Four-Three, Double Four, Double Three)
      if (cell.hasFork) {
        myForks.push({ index: idx, score: 12_000_000 + cell.total });
      }

      // 5. Player Fours (counter-attack forcing moves)
      if (cell.hasLiveFour || cell.hasFour) {
        myFours.push({ index: idx, score: 5_000_000 + cell.total });
      }

      let score = cell.total;
      if (cell.hasFork) {
        score += 8_000_000;
      }

      // TT move bonus
      if (idx === ttMove) {
        score += 25_000_000;
      } else if (
        this.killerMoves[depth] &&
        (this.killerMoves[depth][0] === idx || this.killerMoves[depth][1] === idx)
      ) {
        score += 300_000;
      }
      score += Math.min(30_000, this.historyTable[idx]);

      generalMoves.push({ index: idx, score });
    }

    // TIER 1: Immediate win
    if (winMove !== null) {
      return [winMove];
    }

    // TIER 2: Mandatory block against opponent 5
    if (oppFiveBlocks.length > 0) {
      return oppFiveBlocks;
    }

    // TIER 3: Opponent threatens Open 4 or Fork (Open 3 on board)
    if (oppOpenFourBlocks.length > 0) {
      const urgent = [...myForks, ...myFours, ...oppOpenFourBlocks];
      urgent.sort((a, b) => b.score - a.score);
      const seen = new Set<number>();
      const pruned: Array<{ index: number; score: number }> = [];
      for (const m of urgent) {
        if (!seen.has(m.index)) {
          seen.add(m.index);
          pruned.push(m);
        }
      }
      return pruned.slice(0, 6);
    }

    // TIER 4: General tactical moves
    generalMoves.sort((a, b) => b.score - a.score);
    return generalMoves.slice(0, maxCandidates);
  }

  /**
   * Quiescence search to evaluate forced moves and high threats to avoid horizon effect.
   */
  private quiescence(
    board: Board,
    player: Player,
    alpha: number,
    beta: number,
    depth: number
  ): number {
    this.nodesVisited++;

    const standPat = this.evaluateBoard(board, player);
    if (depth >= 6) return standPat;
    if (standPat >= beta) return beta;
    if (standPat > alpha) alpha = standPat;

    // In quiescence, only search urgent tactical forcing moves
    const candidates = this.getOrderedCandidates(board, player, depth, -1, 4);
    const opponent: Player = player === 1 ? 2 : 1;

    for (const { index, score } of candidates) {
      if (score < PATTERN_SCORES.LIVE_THREE) break;

      const [x, y] = board.getCoords(index);
      if (board.checkWin(x, y, player)) {
        return WIN_SCORE - depth;
      }

      board.cells[index] = player;
      const val = -this.quiescence(board, opponent, -beta, -alpha, depth + 1);
      board.cells[index] = 0;

      if (val >= beta) return beta;
      if (val > alpha) alpha = val;
    }

    return alpha;
  }

  /**
   * Negamax with Alpha-Beta Pruning, Principal Variation Search (PVS) & Transposition Table.
   */
  private negamax(
    board: Board,
    player: Player,
    depth: number,
    maxDepth: number,
    alpha: number,
    beta: number,
    currentHash: bigint
  ): number {
    this.nodesVisited++;

    // Time check every 2048 nodes
    if ((this.nodesVisited & 2047) === 0 && Date.now() - this.startTime > this.timeLimit) {
      this.stopSearch = true;
      return 0;
    }

    const opponent: Player = player === 1 ? 2 : 1;
    const isRoot = depth === 0;

    // TT lookup
    const ttEntry = this.tt.get(currentHash);
    let ttMove = -1;
    if (ttEntry && !isRoot) {
      if (ttEntry.depth >= maxDepth - depth) {
        if (ttEntry.flag === TTFlag.EXACT) return ttEntry.score;
        if (ttEntry.flag === TTFlag.LOWERBOUND && ttEntry.score >= beta) return ttEntry.score;
        if (ttEntry.flag === TTFlag.UPPERBOUND && ttEntry.score <= alpha) return ttEntry.score;
      }
      ttMove = ttEntry.bestMove;
    }

    // Leaf node -> Quiescence
    if (depth >= maxDepth) {
      return this.quiescence(board, player, alpha, beta, 0);
    }

    // Dynamic branch factor: wider at root, lean at deeper plies
    const branchLimit = depth === 0 ? 14 : depth <= 2 ? 8 : depth <= 4 ? 6 : 4;
    const candidates = this.getOrderedCandidates(board, player, depth, ttMove, branchLimit);

    if (candidates.length === 0) {
      return 0;
    }

    let bestScore = -INF;
    let bestMove = candidates[0].index;
    const origAlpha = alpha;

    for (let i = 0; i < candidates.length; i++) {
      const idx = candidates[i].index;
      const [x, y] = board.getCoords(idx);

      // Check immediate win
      if (board.checkWin(x, y, player)) {
        bestScore = WIN_SCORE - depth;
        bestMove = idx;
        this.pvTable[depth] = [idx];
        break;
      }

      // Make move
      board.cells[idx] = player;
      const moveHash = currentHash ^ Zobrist.getKey(player, idx);

      let score: number;
      // Principal Variation Search (PVS)
      if (i === 0) {
        score = -this.negamax(board, opponent, depth + 1, maxDepth, -beta, -alpha, moveHash);
      } else {
        // Null window search
        score = -this.negamax(board, opponent, depth + 1, maxDepth, -alpha - 1, -alpha, moveHash);
        if (score > alpha && score < beta) {
          score = -this.negamax(board, opponent, depth + 1, maxDepth, -beta, -alpha, moveHash);
        }
      }

      // Undo move
      board.cells[idx] = 0;

      if (this.stopSearch) return 0;

      if (score > bestScore) {
        bestScore = score;
        bestMove = idx;
        this.pvTable[depth] = [idx, ...(this.pvTable[depth + 1] || [])];
      }

      if (score > alpha) {
        alpha = score;
      }

      // Beta cutoff
      if (alpha >= beta) {
        if (this.killerMoves[depth]) {
          if (this.killerMoves[depth][0] !== idx) {
            this.killerMoves[depth][1] = this.killerMoves[depth][0];
            this.killerMoves[depth][0] = idx;
          }
        }
        this.historyTable[idx] += depth * depth;
        break;
      }
    }

    // Store in TT
    let flag: TTFlag = TTFlag.EXACT;
    if (bestScore <= origAlpha) flag = TTFlag.UPPERBOUND;
    else if (bestScore >= beta) flag = TTFlag.LOWERBOUND;

    this.tt.set(currentHash, maxDepth - depth, bestScore, flag, bestMove);

    return bestScore;
  }

  /**
   * Main entry point to find the best move.
   */
  public findBestMove(
    board: Board,
    player: Player,
    options: SearchOptions
  ): { move: [number, number]; stats: AIStats } {
    this.startTime = Date.now();
    this.nodesVisited = 0;
    this.stopSearch = false;
    this.timeLimit = options.maxTimeMs ?? 1000;

    const currentHash = Zobrist.computeHash(board.cells);
    const candidates = board.getCandidates();

    // 0. Board completely empty -> play center (32, 32)
    if (board.minX > board.maxX && board.history.length === 0 && board.cells[board.getIndex(32, 32)] === 0) {
      return {
        move: [32, 32],
        stats: {
          depth: 1,
          nodes: 1,
          nps: 0,
          score: 0,
          pv: [[32, 32]],
          pvNotation: 'AG33',
          bestMove: [32, 32],
          tacticsNote: 'Center opening move',
          thinking: false,
        },
      };
    }

    // 1. Check immediate win, block of 5, Open Four, or Four-Three fork
    const opponent: Player = player === 1 ? 2 : 1;
    let immediateWin: number | null = null;
    let immediateBlock: number | null = null;
    let immediateLiveFour: number | null = null;
    let immediateFork: number | null = null;
    let oppHasUrgentThreat = false;

    for (const idx of candidates) {
      const [x, y] = board.getCoords(idx);
      if (board.checkWin(x, y, player)) {
        immediateWin = idx;
        break;
      }
      if (board.checkWin(x, y, opponent)) {
        immediateBlock = idx;
      }
      const cell = evaluateCellScore(board.cells, x, y, player);
      if (!immediateLiveFour && cell.hasLiveFour) {
        immediateLiveFour = idx;
      }
      if (!immediateFork && cell.hasFork && cell.hasFour) {
        immediateFork = idx; // Four-Three fork
      }
      if (cell.oppHasFive || cell.oppHasLiveFour) {
        oppHasUrgentThreat = true;
      }
    }

    if (immediateWin !== null) {
      const coords = board.getCoords(immediateWin);
      return {
        move: coords,
        stats: {
          depth: 1,
          nodes: candidates.length,
          nps: 0,
          score: WIN_SCORE,
          pv: [coords],
          pvNotation: coordsToNotation(coords[0], coords[1]),
          bestMove: coords,
          tacticsNote: 'Immediate winning 5-in-a-row!',
          thinking: false,
        },
      };
    }

    if (immediateBlock !== null) {
      const coords = board.getCoords(immediateBlock);
      return {
        move: coords,
        stats: {
          depth: 1,
          nodes: candidates.length,
          nps: 0,
          score: 0,
          pv: [coords],
          pvNotation: coordsToNotation(coords[0], coords[1]),
          bestMove: coords,
          tacticsNote: 'Immediate block of opponent win!',
          thinking: false,
        },
      };
    }

    // If AI can create an Open Four right now, it is an unstoppable win next turn!
    if (immediateLiveFour !== null) {
      const coords = board.getCoords(immediateLiveFour);
      return {
        move: coords,
        stats: {
          depth: 1,
          nodes: candidates.length,
          nps: 0,
          score: PATTERN_SCORES.LIVE_FOUR,
          pv: [coords],
          pvNotation: coordsToNotation(coords[0], coords[1]),
          bestMove: coords,
          tacticsNote: 'Open Four created! Guaranteed win next turn!',
          thinking: false,
        },
      };
    }

    // If AI can create a Four-Three fork right now and opponent has no urgent threat, execute the win!
    if (immediateFork !== null && !oppHasUrgentThreat) {
      const coords = board.getCoords(immediateFork);
      return {
        move: coords,
        stats: {
          depth: 1,
          nodes: candidates.length,
          nps: 0,
          score: PATTERN_SCORES.FOUR_THREE,
          pv: [coords],
          pvNotation: coordsToNotation(coords[0], coords[1]),
          bestMove: coords,
          tacticsNote: 'Winning Four-Three fork executed! Unstoppable combination!',
          thinking: false,
        },
      };
    }


    // 2. Beginner difficulty: Heuristic evaluation + slight randomness
    if (options.difficulty === 'beginner') {
      const scored = this.getOrderedCandidates(board, player, 0, -1, 10);
      const pickIdx = Math.min(scored.length - 1, Math.floor(Math.random() * 3));
      const chosen = scored[pickIdx]?.index ?? scored[0].index;
      const coords = board.getCoords(chosen);
      return {
        move: coords,
        stats: {
          depth: 1,
          nodes: scored.length,
          nps: 0,
          score: scored[pickIdx]?.score ?? 0,
          pv: [coords],
          pvNotation: coordsToNotation(coords[0], coords[1]),
          bestMove: coords,
          tacticsNote: 'Tactical heuristic move',
          thinking: false,
        },
      };
    }

    // 3. Bidirectional VCF Solver (Master difficulty)
    if (options.difficulty === 'master') {
      // 3a. Check if AI has a winning VCF sequence
      const vcfResult = solveVCF(board, player, 14);
      if (vcfResult.won && vcfResult.path.length > 0) {
        const bestIdx = vcfResult.path[0];
        const coords = board.getCoords(bestIdx);
        const pvCoords = vcfResult.path.map((idx) => board.getCoords(idx));
        return {
          move: coords,
          stats: {
            depth: vcfResult.path.length,
            nodes: this.nodesVisited,
            nps: 0,
            score: WIN_SCORE - vcfResult.path.length,
            pv: pvCoords,
            pvNotation: pvCoords.map(([x, y]) => coordsToNotation(x, y)).join(' '),
            bestMove: coords,
            tacticsNote: `VCF Solved! Forced win in ${vcfResult.path.length} plies`,
            thinking: false,
          },
        };
      }

      // 3b. Check if Opponent has a winning VCF sequence
      const oppVcf = solveVCF(board, opponent, 10);
      if (oppVcf.won && oppVcf.path.length > 0) {
        // Opponent has a forced winning sequence! AI must preempt or disrupt the first threat move
        const blockIdx = oppVcf.path[0];
        const coords = board.getCoords(blockIdx);
        return {
          move: coords,
          stats: {
            depth: oppVcf.path.length,
            nodes: this.nodesVisited,
            nps: 0,
            score: 0,
            pv: [coords],
            pvNotation: coordsToNotation(coords[0], coords[1]),
            bestMove: coords,
            tacticsNote: `Preempting opponent's ${oppVcf.path.length}-ply VCF threat sequence!`,
            thinking: false,
          },
        };
      }
    }

    // 4. Iterative Deepening Negamax
    const targetMaxDepth = options.difficulty === 'intermediate' ? 4 : (options.maxDepth ?? 10);
    let bestMoveIdx = candidates[0];
    let bestScore = 0;
    let completedDepth = 1;

    for (let depth = 1; depth <= targetMaxDepth; depth++) {
      const score = this.negamax(board, player, 0, depth, -INF, INF, currentHash);

      if (this.stopSearch && depth > 1) {
        break;
      }

      if (this.pvTable[0] && this.pvTable[0].length > 0) {
        bestMoveIdx = this.pvTable[0][0];
      }
      bestScore = score;
      completedDepth = depth;

      if (options.onProgress) {
        const elapsed = Math.max(1, Date.now() - this.startTime);
        const nps = Math.round((this.nodesVisited / elapsed) * 1000);
        const pvCoords = (this.pvTable[0] || []).map((idx) => board.getCoords(idx));
        options.onProgress({
          depth: completedDepth,
          nodes: this.nodesVisited,
          nps,
          score: bestScore,
          pv: pvCoords,
          pvNotation: pvCoords.map(([x, y]) => coordsToNotation(x, y)).join(' '),
          bestMove: board.getCoords(bestMoveIdx),
          thinking: true,
        });
      }

      if (bestScore >= WIN_SCORE - 30 || Date.now() - this.startTime >= this.timeLimit * 0.7) {
        break;
      }
    }

    const elapsed = Math.max(1, Date.now() - this.startTime);
    const nps = Math.round((this.nodesVisited / elapsed) * 1000);
    const bestCoords = board.getCoords(bestMoveIdx);
    const pvCoords = (this.pvTable[0] || []).map((idx) => board.getCoords(idx));

    let tacticsNote: string | undefined;
    if (bestScore >= WIN_SCORE - 30) {
      tacticsNote = 'Forced win sequence discovered!';
    } else if (bestScore >= PATTERN_SCORES.DOUBLE_THREE) {
      tacticsNote = 'Double threat fork!';
    }

    return {
      move: bestCoords,
      stats: {
        depth: completedDepth,
        nodes: this.nodesVisited,
        nps,
        score: bestScore,
        pv: pvCoords,
        pvNotation: pvCoords.map(([x, y]) => coordsToNotation(x, y)).join(' '),
        bestMove: bestCoords,
        tacticsNote,
        thinking: false,
      },
    };
  }
}

