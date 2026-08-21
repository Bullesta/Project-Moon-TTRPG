/**
 * Progression functions
 */

// According to the PMTTRPG rules, the rank is calculated based on the level. Every three levels, the rank increases by 1.
export function getRankFromLevel(level) {
  const lv = Math.max(0, Number(level) || 0);
  return Math.min(5, Math.floor(lv / 3) + 1);
}
export function isRankUpLevel(level) {
  const lv = Number(level) || 0;
  return lv > 0 && lv % 3 === 0 && lv <= 15;
}
export function getStatCap(rank) {
  return Number(rank) + 2;
}

export const ACTION_ECONOMY_BY_RANK = Object.freeze({
  0: { actions: 1, reactions: 0 },
  1: { actions: 1, reactions: 1 },
  2: { actions: 1, reactions: 2 },
  3: { actions: 2, reactions: 3 },
  4: { actions: 2, reactions: 4 },
  5: { actions: 3, reactions: 5 },
});

/**
 * @param {number} rank
 * @returns {{ actions: number, reactions: number, movement: number }}
 */
export function getActionEconomyFromRank(rank) {
  const r = Math.clamp(Number(rank) || 0, 0, 5);
  const row = ACTION_ECONOMY_BY_RANK[r] ?? ACTION_ECONOMY_BY_RANK[0];
  return {
    actions: row.actions,
    reactions: row.reactions,
    movement: 1,
  };
}

export const RANK_UP_LEVELS = [3, 6, 9, 12, 15];
export const XP_PER_LEVEL = 8;

export const TACTICAL_SQUARES_BASE = 6;

export function squareTurnCap(squares) {
  if (!squares) return 0;
  const max = Math.max(0, Number(squares.max) || 0);
  const value = Math.max(0, Number(squares.value) || 0);
  const maxBase = Math.max(0, Number(squares.maxBase) || TACTICAL_SQUARES_BASE);
  return max + Math.max(0, value - Math.max(max, maxBase));
}
