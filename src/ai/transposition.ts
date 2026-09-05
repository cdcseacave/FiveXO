export const TTFlag = {
  EXACT: 0,
  LOWERBOUND: 1,
  UPPERBOUND: 2,
} as const;

export type TTFlag = typeof TTFlag[keyof typeof TTFlag];

export interface TTEntry {
  depth: number;
  score: number;
  flag: TTFlag;
  bestMove: number; // index
}

const DEFAULT_TT_SIZE_POWER = 19; // 2^19 = 524,288 entries (~8.4 MB)

export class TranspositionTable {
  private readonly capacity: number;
  private readonly mask: number;
  private keyHigh: Uint32Array;
  private keyLow: Uint32Array;
  private depth: Int8Array;
  private flag: Uint8Array; // 0 = empty, 1 = EXACT, 2 = LOWERBOUND, 3 = UPPERBOUND
  private score: Int32Array;
  private bestMove: Int16Array;

  // Reusable object to avoid allocating a new wrapper on every hit
  private entry: TTEntry = {
    depth: 0,
    score: 0,
    flag: TTFlag.EXACT,
    bestMove: -1,
  };

  private entryCount: number = 0;

  constructor(sizePower: number = DEFAULT_TT_SIZE_POWER) {
    this.capacity = 1 << sizePower;
    this.mask = this.capacity - 1;
    this.keyHigh = new Uint32Array(this.capacity);
    this.keyLow = new Uint32Array(this.capacity);
    this.depth = new Int8Array(this.capacity);
    this.flag = new Uint8Array(this.capacity);
    this.score = new Int32Array(this.capacity);
    this.bestMove = new Int16Array(this.capacity);
  }

  public get(hash: bigint): TTEntry | null {
    const kLow = Number(hash & 0xFFFFFFFFn) >>> 0;
    const kHigh = Number((hash >> 32n) & 0xFFFFFFFFn) >>> 0;
    const index = kLow & this.mask;

    if (this.flag[index] !== 0 && this.keyLow[index] === kLow && this.keyHigh[index] === kHigh) {
      this.entry.depth = this.depth[index];
      this.entry.score = this.score[index];
      this.entry.flag = (this.flag[index] - 1) as TTFlag;
      this.entry.bestMove = this.bestMove[index];
      return this.entry;
    }

    return null;
  }

  public set(hash: bigint, depth: number, score: number, flag: TTFlag, bestMove: number): void {
    const kLow = Number(hash & 0xFFFFFFFFn) >>> 0;
    const kHigh = Number((hash >> 32n) & 0xFFFFFFFFn) >>> 0;
    const index = kLow & this.mask;

    // Replacement strategy: Always replace if slot empty, or if new depth is >= stored depth, or if exact score
    if (this.flag[index] === 0 || depth >= this.depth[index] || flag === TTFlag.EXACT) {
      if (this.flag[index] === 0) {
        this.entryCount++;
      }
      this.keyLow[index] = kLow;
      this.keyHigh[index] = kHigh;
      this.depth[index] = depth;
      this.flag[index] = flag + 1;
      this.score[index] = score;
      if (bestMove >= 0) {
        this.bestMove[index] = bestMove;
      }
    }
  }

  public clear(): void {
    this.flag.fill(0);
    this.entryCount = 0;
  }

  public get size(): number {
    return this.entryCount;
  }
}

