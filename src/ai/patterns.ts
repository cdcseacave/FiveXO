import { BOARD_SIZE } from '../engine/types';
import type { Player } from '../engine/types';

export const PATTERN_SCORES = {
  FIVE: 10_000_000,
  LIVE_FOUR: 2_000_000,      // .XXXX. (unblockable win next move)
  DOUBLE_FOUR: 1_500_000,    // 2x Four (unstoppable fork)
  FOUR_THREE: 1_200_000,     // 1x Four + 1x Live Three (standard winning fork)
  DOUBLE_THREE: 1_000_000,   // 2x Live Three (unstoppable double threat)
  BLOCKED_FOUR: 150_000,     // OXXXX. or XX.XX (threatens five next move)
  LIVE_THREE: 80_000,        // .XXX. or .X.XX. (can become Live Four)
  BLOCKED_THREE: 8_000,      // OXXX.. or OX.XX.
  LIVE_TWO: 3_000,           // ..XX.. or .X.X.
  BLOCKED_TWO: 300,          // OXX...
};

export interface CellPatternScore {
  attack: number;
  defense: number;
  total: number;
  hasFive: boolean;
  hasLiveFour: boolean;
  hasFour: boolean;
  hasLiveThree: boolean;
  hasFork: boolean;
  oppHasFive: boolean;
  oppHasLiveFour: boolean;
  oppHasFour: boolean;
  oppHasLiveThree: boolean;
  oppHasFork: boolean;
}

// Direction offsets: [dx, dy]
export const DIRECTIONS: Array<[number, number]> = [
  [1, 0],   // Horizontal
  [0, 1],   // Vertical
  [1, 1],   // Diagonal \
  [1, -1],  // Diagonal /
];

// Pre-allocated static 9-cell buffer to avoid GC pressure in hot search loops
// Index 4 is the center (placed stone), indices 0..3 are steps -4..-1, indices 5..8 are steps +1..+4
const LINE_BUF = new Int8Array(9);

export interface DirectionalTactics {
  hasFive: boolean;
  hasLiveFour: boolean;
  fours: number;
  liveThrees: number;
  blockedThrees: number;
  liveTwos: number;
  score: number;
  threatIndices: number[]; // empty cell board indices that complete a 5
}

/**
 * Fast, zero-allocation directional pattern evaluator for cell (x, y) along (dx, dy).
 */
export function analyzeDirection(
  cells: Int8Array,
  x: number,
  y: number,
  dx: number,
  dy: number,
  player: Player
): DirectionalTactics {
  // Fill LINE_BUF with 9 cells centered on (x, y)
  for (let k = -4; k <= 4; k++) {
    const nx = x + dx * k;
    const ny = y + dy * k;
    if (nx < 0 || nx >= BOARD_SIZE || ny < 0 || ny >= BOARD_SIZE) {
      LINE_BUF[k + 4] = 3; // 3 = boundary / obstacle
    } else if (k === 0) {
      LINE_BUF[4] = player;
    } else {
      LINE_BUF[k + 4] = cells[ny * BOARD_SIZE + nx];
    }
  }

  // 1. Check consecutive stones through center (index 4)
  let left = 3;
  while (left >= 0 && LINE_BUF[left] === player) left--;
  let right = 5;
  while (right <= 8 && LINE_BUF[right] === player) right++;
  const consecutive = right - left - 1;

  if (consecutive >= 5) {
    return {
      hasFive: true,
      hasLiveFour: false,
      fours: 0,
      liveThrees: 0,
      blockedThrees: 0,
      liveTwos: 0,
      score: PATTERN_SCORES.FIVE,
      threatIndices: [],
    };
  }

  const leftOpen = left >= 0 && LINE_BUF[left] === 0;
  const rightOpen = right <= 8 && LINE_BUF[right] === 0;

  const threatIndices: number[] = [];

  if (consecutive === 4) {
    if (leftOpen && rightOpen) {
      // Open Four: both left and right endpoints threaten five
      threatIndices.push(
        (y + dy * (left - 4)) * BOARD_SIZE + (x + dx * (left - 4)),
        (y + dy * (right - 4)) * BOARD_SIZE + (x + dx * (right - 4))
      );
      return {
        hasFive: false,
        hasLiveFour: true,
        fours: 1,
        liveThrees: 0,
        blockedThrees: 0,
        liveTwos: 0,
        score: PATTERN_SCORES.LIVE_FOUR,
        threatIndices,
      };
    } else if (leftOpen) {
      threatIndices.push((y + dy * (left - 4)) * BOARD_SIZE + (x + dx * (left - 4)));
      return {
        hasFive: false,
        hasLiveFour: false,
        fours: 1,
        liveThrees: 0,
        blockedThrees: 0,
        liveTwos: 0,
        score: PATTERN_SCORES.BLOCKED_FOUR,
        threatIndices,
      };
    } else if (rightOpen) {
      threatIndices.push((y + dy * (right - 4)) * BOARD_SIZE + (x + dx * (right - 4)));
      return {
        hasFive: false,
        hasLiveFour: false,
        fours: 1,
        liveThrees: 0,
        blockedThrees: 0,
        liveTwos: 0,
        score: PATTERN_SCORES.BLOCKED_FOUR,
        threatIndices,
      };
    }
  }

  // 2. Check for jump fours across 5-cell windows containing center (w = 0..4)
  let foundJumpFour = false;
  for (let w = 0; w <= 4; w++) {
    let pCount = 0;
    let emptyStep = -1;
    let blocked = false;

    for (let i = 0; i < 5; i++) {
      const val = LINE_BUF[w + i];
      if (val === player) {
        pCount++;
      } else if (val === 0) {
        emptyStep = w + i;
      } else {
        blocked = true;
        break;
      }
    }

    if (!blocked && pCount === 4 && emptyStep !== -1) {
      foundJumpFour = true;
      const k = emptyStep - 4;
      threatIndices.push((y + dy * k) * BOARD_SIZE + (x + dx * k));
    }
  }

  if (foundJumpFour) {
    return {
      hasFive: false,
      hasLiveFour: false,
      fours: 1,
      liveThrees: 0,
      blockedThrees: 0,
      liveTwos: 0,
      score: PATTERN_SCORES.BLOCKED_FOUR,
      threatIndices,
    };
  }

  // 3. Check for Live Three across the four 6-cell spans containing center (s = 0..3)
  // An Open Three matches one of: 0PPP00, 00PPP0, 0P0PP0, 0PP0P0
  let foundLiveThree = false;
  for (let s = 0; s <= 3; s++) {
    if (LINE_BUF[s] === 0 && LINE_BUF[s + 5] === 0) {
      let pCount = 0;
      let eCount = 0;
      for (let i = 1; i <= 4; i++) {
        const val = LINE_BUF[s + i];
        if (val === player) pCount++;
        else if (val === 0) eCount++;
      }
      if (pCount === 3 && eCount === 1) {
        foundLiveThree = true;
        break;
      }
    }
  }

  if (foundLiveThree) {
    return {
      hasFive: false,
      hasLiveFour: false,
      fours: 0,
      liveThrees: 1,
      blockedThrees: 0,
      liveTwos: 0,
      score: PATTERN_SCORES.LIVE_THREE,
      threatIndices: [],
    };
  }

  // 4. Check for Blocked Three in 5-cell windows (w = 0..4)
  let foundBlockedThree = false;
  for (let w = 0; w <= 4; w++) {
    let pCount = 0;
    let eCount = 0;
    let blocked = false;

    for (let i = 0; i < 5; i++) {
      const val = LINE_BUF[w + i];
      if (val === player) pCount++;
      else if (val === 0) eCount++;
      else {
        blocked = true;
        break;
      }
    }

    if (!blocked && pCount === 3 && eCount === 2) {
      foundBlockedThree = true;
      break;
    }
  }

  if (foundBlockedThree) {
    return {
      hasFive: false,
      hasLiveFour: false,
      fours: 0,
      liveThrees: 0,
      blockedThrees: 1,
      liveTwos: 0,
      score: PATTERN_SCORES.BLOCKED_THREE,
      threatIndices: [],
    };
  }

  // 5. Check for Live Two in 6-cell spans (s = 0..3)
  let foundLiveTwo = false;
  for (let s = 0; s <= 3; s++) {
    if (LINE_BUF[s] === 0 && LINE_BUF[s + 5] === 0) {
      let pCount = 0;
      let eCount = 0;
      for (let i = 1; i <= 4; i++) {
        const val = LINE_BUF[s + i];
        if (val === player) pCount++;
        else if (val === 0) eCount++;
      }
      if (pCount === 2 && eCount === 2) {
        foundLiveTwo = true;
        break;
      }
    }
  }

  if (foundLiveTwo) {
    return {
      hasFive: false,
      hasLiveFour: false,
      fours: 0,
      liveThrees: 0,
      blockedThrees: 0,
      liveTwos: 1,
      score: PATTERN_SCORES.LIVE_TWO,
      threatIndices: [],
    };
  }

  return {
    hasFive: false,
    hasLiveFour: false,
    fours: 0,
    liveThrees: 0,
    blockedThrees: 0,
    liveTwos: 0,
    score: 0,
    threatIndices: [],
  };
}

/**
 * Fast evaluation of purely attack tactical score for player at (x, y).
 */
export function evaluateCellAttack(
  cells: Int8Array,
  x: number,
  y: number,
  player: Player
): number {
  const my = countAllTactics(cells, x, y, player);
  if (my.fives > 0) return PATTERN_SCORES.FIVE;
  if (my.liveFours > 0) return PATTERN_SCORES.LIVE_FOUR;
  if (my.fours >= 2) return PATTERN_SCORES.DOUBLE_FOUR;
  if (my.fours >= 1 && my.liveThrees >= 1) return PATTERN_SCORES.FOUR_THREE;
  if (my.liveThrees >= 2) return PATTERN_SCORES.DOUBLE_THREE;
  return (
    my.fours * PATTERN_SCORES.BLOCKED_FOUR +
    my.liveThrees * PATTERN_SCORES.LIVE_THREE +
    my.blockedThrees * PATTERN_SCORES.BLOCKED_THREE +
    my.liveTwos * PATTERN_SCORES.LIVE_TWO
  );
}


/**
 * Backward compatibility wrapper for single direction point evaluation.
 */
export function evaluatePointDirection(
  cells: Int8Array,
  x: number,
  y: number,
  dx: number,
  dy: number,
  player: Player
): number {
  return analyzeDirection(cells, x, y, dx, dy, player).score;
}

/**
 * Counts tactical elements across all 4 directions for player placing at (x, y).
 */
export function countAllTactics(
  cells: Int8Array,
  x: number,
  y: number,
  player: Player
) {
  let fives = 0;
  let liveFours = 0;
  let fours = 0;
  let liveThrees = 0;
  let blockedThrees = 0;
  let liveTwos = 0;
  const allThreatIndices: number[] = [];

  for (const [dx, dy] of DIRECTIONS) {
    const t = analyzeDirection(cells, x, y, dx, dy, player);
    if (t.hasFive) fives++;
    if (t.hasLiveFour) liveFours++;
    fours += t.fours;
    liveThrees += t.liveThrees;
    blockedThrees += t.blockedThrees;
    liveTwos += t.liveTwos;
    if (t.threatIndices.length > 0) {
      allThreatIndices.push(...t.threatIndices);
    }
  }

  return {
    fives,
    liveFours,
    fours,
    liveThrees,
    blockedThrees,
    liveTwos,
    threatIndices: allThreatIndices,
  };
}

/**
 * Evaluates tactical attack and defense values of an empty cell (x, y).
 */
export function evaluateCellScore(
  cells: Int8Array,
  x: number,
  y: number,
  player: Player
): CellPatternScore {
  const opponent: Player = player === 1 ? 2 : 1;

  const my = countAllTactics(cells, x, y, player);
  const opp = countAllTactics(cells, x, y, opponent);

  const hasFive = my.fives > 0;
  const hasLiveFour = my.liveFours > 0;
  const hasFour = my.fours > 0;
  const hasLiveThree = my.liveThrees > 0;

  const oppHasFive = opp.fives > 0;
  const oppHasLiveFour = opp.liveFours > 0;
  const oppHasFour = opp.fours > 0;
  const oppHasLiveThree = opp.liveThrees > 0;

  const hasFork = my.fours >= 2 || (my.fours >= 1 && my.liveThrees >= 1) || my.liveThrees >= 2;
  const oppHasFork = opp.fours >= 2 || (opp.fours >= 1 && opp.liveThrees >= 1) || opp.liveThrees >= 2;

  // 1. Calculate Attack Score
  let attack = 0;
  if (hasFive) {
    attack = PATTERN_SCORES.FIVE;
  } else if (hasLiveFour) {
    attack = PATTERN_SCORES.LIVE_FOUR;
  } else if (my.fours >= 2) {
    attack = PATTERN_SCORES.DOUBLE_FOUR;
  } else if (my.fours >= 1 && my.liveThrees >= 1) {
    attack = PATTERN_SCORES.FOUR_THREE;
  } else if (my.liveThrees >= 2) {
    attack = PATTERN_SCORES.DOUBLE_THREE;
  } else {
    attack =
      my.fours * PATTERN_SCORES.BLOCKED_FOUR +
      my.liveThrees * PATTERN_SCORES.LIVE_THREE +
      my.blockedThrees * PATTERN_SCORES.BLOCKED_THREE +
      my.liveTwos * PATTERN_SCORES.LIVE_TWO;
  }

  // 2. Calculate Defense Score (threat level if opponent played here)
  let defense = 0;
  if (oppHasFive) {
    defense = 9_000_000; // Mandatory block against opponent five
  } else if (oppHasLiveFour) {
    defense = 1_800_000; // Mandatory block against opponent open four
  } else if (opp.fours >= 2 || (opp.fours >= 1 && opp.liveThrees >= 1)) {
    defense = 1_400_000; // Fork defense (Four-Three or Double Four)
  } else if (opp.liveThrees >= 2) {
    defense = 1_200_000; // Double three fork defense
  } else if (oppHasLiveThree) {
    defense = 120_000 + (opp.fours > 0 ? 30_000 : 0); // Outranks simple attacks
  } else {
    defense =
      opp.fours * 70_000 +
      opp.blockedThrees * 6_000 +
      opp.liveTwos * 2_000;
  }

  // 3. Combined Total Score with tactical override logic
  let total: number;
  if (attack >= PATTERN_SCORES.LIVE_FOUR) {
    // Immediate win or unblockable Open 4 dominates everything
    total = attack;
  } else if (defense >= 9_000_000) {
    // Opponent 5 must be blocked unless we have our own 5 (caught above)
    total = defense + attack * 0.1;
  } else if (defense >= 1_800_000) {
    // Opponent Open 4 must be blocked
    total = defense + attack * 0.1;
  } else if (attack >= PATTERN_SCORES.FOUR_THREE) {
    // Our 4-4 or 4-3 fork creates forcing moves that opponent must respond to
    total = attack + defense * 0.2;
  } else if (defense >= 1_200_000) {
    // Opponent fork must be defused
    total = defense + attack * 0.2;
  } else {
    // Balance attack & defense; dual-purpose moves get substantial reward
    total = Math.max(attack, defense) + Math.min(attack, defense) * 0.5;
  }

  return {
    attack,
    defense,
    total,
    hasFive,
    hasLiveFour,
    hasFour,
    hasLiveThree,
    hasFork,
    oppHasFive,
    oppHasLiveFour,
    oppHasFour,
    oppHasLiveThree,
    oppHasFork,
  };
}


