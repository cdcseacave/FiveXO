import { CELL_COUNT } from '../engine/types';
import type { Player } from '../engine/types';

// Deterministic 64-bit XorShift PRNG to generate Zobrist random keys
class XorShift64 {
  private state: bigint;

  constructor(seed: bigint = 0x853c49e6748fea9bFn) {
    this.state = seed;
  }

  public next(): bigint {
    let x = this.state;
    x ^= x << 13n;
    x ^= x >> 7n;
    x ^= x << 17n;
    this.state = x;
    return x;
  }
}

// 2 players x 4096 cells
export class Zobrist {
  public static table: bigint[][] = [[], []];
  private static initialized: boolean = false;

  public static init(): void {
    if (this.initialized) return;
    const rng = new XorShift64();

    this.table[0] = new Array(CELL_COUNT);
    this.table[1] = new Array(CELL_COUNT);

    for (let i = 0; i < CELL_COUNT; i++) {
      this.table[0][i] = rng.next();
      this.table[1][i] = rng.next();
    }
    this.initialized = true;
  }

  public static getKey(player: Player, index: number): bigint {
    if (!this.initialized) this.init();
    return this.table[player - 1][index];
  }

  public static computeHash(cells: Int8Array): bigint {
    if (!this.initialized) this.init();
    let hash = 0n;
    for (let i = 0; i < CELL_COUNT; i++) {
      const p = cells[i];
      if (p === 1 || p === 2) {
        hash ^= this.table[p - 1][i];
      }
    }
    return hash;
  }
}

Zobrist.init();
