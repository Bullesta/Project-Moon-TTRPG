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
  export const RANK_UP_LEVELS = [3, 6, 9, 12, 15]; 
  export const XP_PER_LEVEL = 8; 