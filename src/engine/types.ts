export const BOARD_SIZE = 64;
export const CELL_COUNT = BOARD_SIZE * BOARD_SIZE; // 4096
export const WIN_LENGTH = 5;

export type Player = 1 | 2; // 1 = Black/X, 2 = White/O
export type CellState = 0 | 1 | 2; // 0 = Empty, 1 = Black, 2 = White

export interface Move {
  x: number;
  y: number;
  player: Player;
  notation: string;
  timestamp: number;
}

export type GameStatus = 'playing' | 'won' | 'draw';

export interface WinInfo {
  winner: Player;
  line: Array<[number, number]>;
  direction: 'H' | 'V' | 'D1' | 'D2';
}

export type GameMode = 'local-1v1' | '1v-ai' | 'ai-v-ai' | 'online-1v1';
export type AIDifficulty = 'beginner' | 'intermediate' | 'master';
export type BoardTheme = 'cyber' | 'zen' | 'light';

export interface AIStats {
  depth: number;
  nodes: number;
  nps: number;
  score: number; // in centipawns / tactical score
  pv: Array<[number, number]>;
  pvNotation: string;
  bestMove: [number, number] | null;
  tacticsNote?: string;
  thinking: boolean;
}

export interface PeerMessage {
  type: 'MOVE' | 'RESTART' | 'UNDO_REQUEST' | 'UNDO_ACCEPT' | 'CHAT' | 'SYNC';
  payload?: any;
}
