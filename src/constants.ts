// average block time after the merge
export const SECONDS_PER_BLOCK = 12.07;

// 24 hr/day * 60 min/hr * 60 sec/min / 12.07s/block = 7158.24 block/day
export const DAY_IN_BLOCKS = (24 * 60 * 60) / SECONDS_PER_BLOCK;
